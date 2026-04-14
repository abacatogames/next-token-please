import random

import numpy as np
import pytest

from app.generator import embeddings
from app.generator.distractors import _random_pool, pick, pick_full


def _context(words: list[str]) -> frozenset[str]:
    return frozenset(w.lower() for w in words)


def test_random_pool_is_alpha_and_len_ge_3() -> None:
    pool = _random_pool()
    assert len(pool) > 1000
    assert all(w.isalpha() for w in pool)
    assert all(len(w) >= 3 for w in pool)


def test_never_returns_the_correct_word() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b = pick("scatter", "VB", _context([]), difficulty=0.5, rng=rng)
        assert a.lower() != "scatter" and b.lower() != "scatter"


def test_never_returns_inflected_form_of_correct_word() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b = pick("run", "VB", _context([]), difficulty=1.0, rng=rng)
        for distractor in (a, b):
            assert distractor.lower() not in {"run", "runs", "running", "ran"}


def test_filters_words_present_in_context() -> None:
    rng = random.Random(0)
    ctx = _context(["blue", "sky", "scatter", "light", "atmosphere", "molecules"])
    for _ in range(50):
        a, b = pick("scatter", "VB", ctx, difficulty=0.5, rng=rng)
        for distractor in (a, b):
            assert distractor.lower() not in ctx


def test_two_distractors_differ() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b = pick("scatter", "VB", _context([]), difficulty=0.5, rng=rng)
        assert a.lower() != b.lower()


def test_difficulty_zero_prefers_random_words() -> None:
    from nltk.corpus import wordnet as wn
    rng = random.Random(123)
    synonyms_of_scatter = {
        n.lower() for syn in wn.synsets("scatter", pos="v") for n in syn.lemma_names()
    }
    syn_count = 0
    total = 60
    for _ in range(total):
        a, b = pick("scatter", "VB", _context([]), difficulty=0.0, rng=rng)
        for distractor in (a, b):
            if distractor.lower() in synonyms_of_scatter:
                syn_count += 1
    assert syn_count <= total * 2 * 0.1


def test_difficulty_one_prefers_synonyms_when_available() -> None:
    from nltk.corpus import wordnet as wn
    rng = random.Random(7)
    synonyms_of_scatter = {
        n.lower() for syn in wn.synsets("scatter", pos="v") for n in syn.lemma_names()
    }
    syn_count = 0
    total = 60
    for _ in range(total):
        a, b = pick("scatter", "VB", _context([]), difficulty=1.0, rng=rng)
        for distractor in (a, b):
            if distractor.lower() in synonyms_of_scatter:
                syn_count += 1
    assert syn_count >= total * 2 * 0.6


def test_falls_back_to_random_when_no_synonyms() -> None:
    rng = random.Random(0)
    a, b = pick("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
    assert a.isalpha() and b.isalpha()
    assert a.lower() != b.lower()


def test_seeded_output_is_deterministic() -> None:
    r1 = pick("scatter", "VB", _context([]), difficulty=0.5, rng=random.Random(42))
    r2 = pick("scatter", "VB", _context([]), difficulty=0.5, rng=random.Random(42))
    assert r1 == r2


def test_multi_word_wordnet_lemmas_are_rejected() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b = pick("run", "VB", _context([]), difficulty=1.0, rng=rng)
        for distractor in (a, b):
            assert "_" not in distractor and "-" not in distractor


def test_no_pos_still_produces_distractors() -> None:
    rng = random.Random(0)
    a, b = pick("hello", "UH", _context([]), difficulty=0.5, rng=rng)
    assert a and b
    assert a.lower() != b.lower()


@pytest.fixture
def _install_technical_embeddings():
    vocab = [
        "backpropagation",
        "gradient",
        "descent",
        "optimization",
        "training",
        "epoch",
        "neuron",
        "carrot",
    ]
    rng = np.random.default_rng(1)
    base = rng.normal(size=(len(vocab), 32)).astype(np.float32)
    matrix = base / np.linalg.norm(base, axis=1, keepdims=True)
    anchor = matrix[0].copy()
    for i in (1, 2, 3, 4, 5, 6):
        matrix[i] = anchor + 0.15 * rng.normal(size=32).astype(np.float32)
        matrix[i] /= np.linalg.norm(matrix[i])
    embeddings.install_for_tests(vocab, matrix)
    yield vocab
    embeddings.reset_for_tests()


def test_embedding_pool_used_when_wordnet_empty(_install_technical_embeddings) -> None:
    from nltk.corpus import wordnet as wn

    assert wn.synsets("backpropagation", pos="n") == []

    rng = random.Random(0)
    used_embedding = 0
    trials = 40
    for _ in range(trials):
        _, _, sources = pick_full("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
        used_embedding += sum(1 for s in sources if s == "embedding")
    assert used_embedding >= trials * 2 * 0.5


def test_embedding_pool_skipped_when_disabled(monkeypatch, _install_technical_embeddings) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "embeddings_enabled", False)

    rng = random.Random(0)
    _, _, sources = pick_full("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
    assert "embedding" not in sources


def test_embedding_pool_ignored_when_wordnet_available() -> None:
    vocab = ["jog", "sprint", "race"]
    rng_np = np.random.default_rng(2)
    base = rng_np.normal(size=(len(vocab), 8)).astype(np.float32)
    matrix = base / np.linalg.norm(base, axis=1, keepdims=True)
    embeddings.install_for_tests(vocab, matrix)
    try:
        rng = random.Random(0)
        used_embedding = 0
        trials = 30
        for _ in range(trials):
            _, _, sources = pick_full("run", "VB", _context([]), difficulty=1.0, rng=rng)
            used_embedding += sum(1 for s in sources if s == "embedding")
        assert used_embedding == 0
    finally:
        embeddings.reset_for_tests()


def test_embedding_fallback_oov_degrades_to_random() -> None:
    vocab = ["alpha", "beta", "gamma"]
    rng_np = np.random.default_rng(3)
    base = rng_np.normal(size=(len(vocab), 8)).astype(np.float32)
    matrix = base / np.linalg.norm(base, axis=1, keepdims=True)
    embeddings.install_for_tests(vocab, matrix)
    try:
        rng = random.Random(0)
        a, b, sources = pick_full("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
        assert a and b
        assert all(src == "random" for src in sources)
    finally:
        embeddings.reset_for_tests()
