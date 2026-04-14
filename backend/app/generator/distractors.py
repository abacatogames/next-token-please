import random
from functools import lru_cache

import wordfreq
from nltk.corpus import wordnet as wn
from nltk.stem import WordNetLemmatizer

_LEMMATIZER = WordNetLemmatizer()
_PENN_TO_WN = {"N": "n", "V": "v", "J": "a", "R": "r"}
_RANDOM_POOL_SIZE = 5000
_FALLBACK = ("something", "nothing")


def _penn_to_wn(pos: str) -> str | None:
    if not pos:
        return None
    return _PENN_TO_WN.get(pos[0].upper())


@lru_cache(maxsize=1)
def _random_pool() -> tuple[str, ...]:
    words = wordfreq.top_n_list("en", _RANDOM_POOL_SIZE)
    return tuple(w for w in words if w.isalpha() and len(w) >= 3)


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
        low = candidate.lower()
        if low == correct_lower:
            return False
        if low in context:
            return False
        return _lemma(candidate, wn_pos) != correct_lemma

    return acceptable, wn_pos


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
    return pool


def _pick_one(syn_pool: list[str], rand_pool: tuple[str, ...], *,
              difficulty: float, used: set[str], acceptable,
              rng: random.Random) -> tuple[str, str]:
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
    primary = available_syns if prefer_syn else list(rand_pool)
    primary_source = "synonym" if prefer_syn else "random"
    secondary = list(rand_pool) if prefer_syn else available_syns
    secondary_source = "random" if prefer_syn else "synonym"

    pick = draw_from(primary, check=not prefer_syn)
    if pick is not None:
        return pick, primary_source
    pick = draw_from(secondary, check=(secondary_source == "random"))
    if pick is not None:
        return pick, secondary_source
    pick = draw_from(list(rand_pool), check=False)
    if pick is not None:
        return pick, "random"
    fallback = _FALLBACK[0] if _FALLBACK[0] not in used else _FALLBACK[1]
    return fallback, "random"


def pick_full(correct: str, pos: str, context: frozenset[str], difficulty: float,
              rng: random.Random) -> tuple[str, str, tuple[str, str]]:
    acceptable, wn_pos = _build_acceptor(correct, pos, context)
    syn_pool = _synonym_pool(correct, wn_pos, acceptable)
    rand_pool = _random_pool()

    used: set[str] = set()
    a, source_a = _pick_one(syn_pool, rand_pool, difficulty=difficulty, used=used,
                            acceptable=acceptable, rng=rng)
    used.add(a.lower())
    b, source_b = _pick_one(syn_pool, rand_pool, difficulty=difficulty, used=used,
                            acceptable=acceptable, rng=rng)
    return a, b, (source_a, source_b)


def pick(correct: str, pos: str, context: frozenset[str], difficulty: float,
         rng: random.Random) -> tuple[str, str]:
    a, b, _ = pick_full(correct, pos, context, difficulty, rng)
    return a, b
