import random
from functools import lru_cache
from typing import Literal

import numpy as np
import wordfreq
from nltk.corpus import wordnet as wn
from nltk.stem import WordNetLemmatizer

from app.config import settings
from app.generator import embeddings

Source = Literal["synonym", "embedding", "random"]

_LEMMATIZER = WordNetLemmatizer()
_PENN_TO_WN = {"N": "n", "V": "v", "J": "a", "R": "r"}
_RANDOM_POOL_SIZE = 5000
_FALLBACK = ("something", "nothing")
_COHYPONYM_THRESHOLD = 1


def _penn_to_wn(pos: str) -> str | None:
    if not pos:
        return None
    return _PENN_TO_WN.get(pos[0].upper())


@lru_cache(maxsize=1)
def _random_pool() -> tuple[str, ...]:
    words = wordfreq.top_n_list("en", _RANDOM_POOL_SIZE)
    return tuple(w for w in words if w.isalpha() and len(w) >= 3)


@lru_cache(maxsize=8192)
def _lemma(word: str, wn_pos: str | None) -> str:
    return _LEMMATIZER.lemmatize(word.lower(), pos=wn_pos or "n")


def _build_acceptor(correct: str, pos: str, context: frozenset[str]):
    correct_lower = correct.lower()
    wn_pos = _penn_to_wn(pos)
    correct_lemma = _lemma(correct, wn_pos)

    def acceptable(candidate: str) -> bool:
        if "_" in candidate or "-" in candidate:
            return False
        if not candidate.isalpha():
            return False
        if len(candidate) < 3:
            return False
        low = candidate.lower()
        if low == correct_lower:
            return False
        if low in context:
            return False
        return _lemma(candidate, wn_pos) != correct_lemma

    return acceptable, wn_pos


@lru_cache(maxsize=4096)
def _cohyponym_names(word: str, wn_pos: str | None) -> tuple[str, ...]:
    if wn_pos is None:
        return ()
    seen: set[str] = set()
    result: list[str] = []
    for syn in wn.synsets(word, pos=wn_pos):
        for hypernym in syn.hypernyms():
            for sibling_syn in hypernym.hyponyms():
                for name in sibling_syn.lemma_names():
                    low = name.lower()
                    if low not in seen:
                        seen.add(low)
                        result.append(name)
    return tuple(result)


def _synonym_pool(correct: str, wn_pos: str | None, acceptable) -> list[str]:
    if wn_pos is None:
        return []
    pool: list[str] = []
    seen: set[str] = set()
    for syn in wn.synsets(correct, pos=wn_pos):
        for name in syn.lemma_names():
            low = name.lower()
            if low in seen:
                continue
            seen.add(low)
            if acceptable(name):
                pool.append(name)

    if len(pool) <= _COHYPONYM_THRESHOLD:
        for name in _cohyponym_names(correct, wn_pos):
            low = name.lower()
            if low in seen:
                continue
            seen.add(low)
            if acceptable(name):
                pool.append(name)

    return pool


def _embedding_pool(correct: str, acceptable) -> list[str]:
    if not settings.embeddings_enabled:
        return []
    candidates = embeddings.nearest(correct, k=settings.embeddings_top_k)
    pool: list[str] = []
    seen: set[str] = set()
    for cand in candidates:
        low = cand.lower()
        if low in seen:
            continue
        seen.add(low)
        if acceptable(cand):
            pool.append(cand)
    return pool


def _pick_one(
    syn_pool: list[str],
    syn_source: Source,
    rand_pool: tuple[str, ...],
    *,
    difficulty: float,
    used: set[str],
    acceptable,
    rng: random.Random,
) -> tuple[str, Source]:
    available_syns = [s for s in syn_pool if s.lower() not in used]

    def draw_from(pool: list[str] | tuple[str, ...], check: bool) -> str | None:
        if not pool:
            return None
        for candidate in rng.sample(pool, k=min(len(pool), 50)):
            if candidate.lower() in used:
                continue
            if check and not acceptable(candidate):
                continue
            return candidate
        return None

    prefer_syn = rng.random() < difficulty
    primary = available_syns if prefer_syn else rand_pool
    primary_source = syn_source if prefer_syn else "random"
    secondary = rand_pool if prefer_syn else available_syns
    secondary_source = "random" if prefer_syn else syn_source

    pick = draw_from(primary, check=not prefer_syn)
    if pick is not None:
        return pick, primary_source
    pick = draw_from(secondary, check=(secondary_source == "random"))
    if pick is not None:
        return pick, secondary_source
    pick = draw_from(rand_pool, check=False)
    if pick is not None:
        return pick, "random"
    fallback = _FALLBACK[0] if _FALLBACK[0] not in used else _FALLBACK[1]
    return fallback, "random"


def _context_vector(context_tokens: tuple[str, ...]) -> np.ndarray | None:
    if not settings.embeddings_enabled:
        return None
    vecs = []
    for token in context_tokens[-settings.distractor_context_window:]:
        if not token.isalpha():
            continue
        vec = embeddings.unit_vector(token)
        if vec is not None:
            vecs.append(vec)
    if not vecs:
        return None
    mean = np.mean(vecs, axis=0)
    norm = float(np.linalg.norm(mean))
    if norm == 0.0:
        return None
    return mean / norm


def _gather_candidates(
    correct: str, wn_pos: str | None, acceptable
) -> list[tuple[str, Source]]:
    pool: list[tuple[str, Source]] = []
    seen: set[str] = set()

    if wn_pos is not None:
        for syn in wn.synsets(correct, pos=wn_pos):
            for name in syn.lemma_names():
                low = name.lower()
                if low in seen:
                    continue
                seen.add(low)
                if acceptable(name):
                    pool.append((name, "synonym"))

    for name in _cohyponym_names(correct, wn_pos):
        low = name.lower()
        if low in seen:
            continue
        seen.add(low)
        if acceptable(name):
            pool.append((name, "synonym"))

    if settings.embeddings_enabled:
        for cand in embeddings.nearest(correct, k=settings.embeddings_top_k):
            low = cand.lower()
            if low in seen:
                continue
            seen.add(low)
            if acceptable(cand):
                pool.append((cand, "embedding"))

    return pool


def _score_candidate(
    cand: str,
    correct: str,
    correct_vec: np.ndarray | None,
    context_vec: np.ndarray | None,
    correct_zipf: float,
    wn_pos: str | None,
) -> float:
    alpha = settings.distractor_weight_similarity
    beta = settings.distractor_weight_context
    gamma = settings.distractor_weight_frequency
    delta = settings.distractor_penalty_lemma

    cand_vec = embeddings.unit_vector(cand)
    sim = float(np.dot(cand_vec, correct_vec)) if (cand_vec is not None and correct_vec is not None) else 0.0
    ctx = float(np.dot(cand_vec, context_vec)) if (cand_vec is not None and context_vec is not None) else 0.0
    cand_zipf = wordfreq.zipf_frequency(cand.lower(), "en")
    freq = 1.0 - min(1.0, abs(cand_zipf - correct_zipf) / 3.0)
    lemma_pen = 1.0 if _lemma(cand, wn_pos) == _lemma(correct, wn_pos) else 0.0

    return alpha * sim + beta * ctx + gamma * freq - delta * lemma_pen


def _pick_ranked(
    ranked: list[tuple[str, Source, float]],
    *,
    difficulty: float,
    used: set[str],
    rng: random.Random,
) -> tuple[str, Source] | None:
    n = len(ranked)
    if n == 0:
        return None
    target = int((1.0 - difficulty) * (n - 1))
    width = max(2, int(settings.distractor_rank_window_pct * n))
    lo = max(0, target - width)
    hi = min(n - 1, target + width)
    window = [(w, src, sc) for w, src, sc in ranked[lo: hi + 1] if w.lower() not in used]
    if not window:
        window = [(w, src, sc) for w, src, sc in ranked if w.lower() not in used]
    if not window:
        return None
    word, src, _ = rng.choice(window)
    return word, src


def pick_full(
    correct: str,
    pos: str,
    context: tuple[str, ...],
    difficulty: float,
    rng: random.Random,
    *,
    context_set: frozenset[str] | None = None,
) -> tuple[str, str, tuple[Source, Source]]:
    effective_context = context_set if context_set is not None else frozenset(
        w.lower() for w in context if w.isalpha()
    )
    acceptable, wn_pos = _build_acceptor(correct, pos, effective_context)

    if not settings.distractor_unified_pool:
        wordnet_pool = _synonym_pool(correct, wn_pos, acceptable)
        syn_pool: list[str]
        syn_source: Source
        if wordnet_pool:
            syn_pool, syn_source = wordnet_pool, "synonym"
        else:
            embedding_pool = _embedding_pool(correct, acceptable)
            if embedding_pool:
                syn_pool, syn_source = embedding_pool, "embedding"
            else:
                syn_pool, syn_source = [], "synonym"
        rand_pool = _random_pool()
        used_legacy: set[str] = set()
        a, source_a = _pick_one(syn_pool, syn_source, rand_pool, difficulty=difficulty,
                                used=used_legacy, acceptable=acceptable, rng=rng)
        used_legacy.add(a.lower())
        b, source_b = _pick_one(syn_pool, syn_source, rand_pool, difficulty=difficulty,
                                used=used_legacy, acceptable=acceptable, rng=rng)
        return a, b, (source_a, source_b)

    correct_vec = embeddings.unit_vector(correct)
    correct_zipf = wordfreq.zipf_frequency(correct.lower(), "en")
    context_vec = _context_vector(context)
    candidates = _gather_candidates(correct, wn_pos, acceptable)
    scored = sorted(
        [
            (w, src, _score_candidate(w, correct, correct_vec, context_vec, correct_zipf, wn_pos))
            for w, src in candidates
        ],
        key=lambda x: x[2],
        reverse=True,
    )

    used: set[str] = set()

    def fallback_pick(used: set[str]) -> tuple[str, Source]:
        rand_pool = _random_pool()
        for cand in rng.sample(rand_pool, k=min(len(rand_pool), 50)):
            if cand.lower() not in used and acceptable(cand):
                return cand, "random"
        word = next((f for f in _FALLBACK if f not in used), _FALLBACK[-1])
        return word, "random"

    if len(scored) < 2:
        a, source_a = fallback_pick(used)
        used.add(a.lower())
        b, source_b = fallback_pick(used)
        return a, b, (source_a, source_b)

    result_a = _pick_ranked(scored, difficulty=difficulty, used=used, rng=rng)
    a, source_a = result_a if result_a is not None else fallback_pick(used)
    used.add(a.lower())
    result_b = _pick_ranked(scored, difficulty=difficulty, used=used, rng=rng)
    b, source_b = result_b if result_b is not None else fallback_pick(used)

    return a, b, (source_a, source_b)
