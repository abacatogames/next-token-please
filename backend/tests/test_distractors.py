import random

from app.generator.distractors import _random_pool, pick


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
