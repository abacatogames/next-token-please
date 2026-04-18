import random

import numpy as np
import pytest
import wordfreq

from app.generator import embeddings
from app.generator.distractors import _random_pool, pick_full


def _context(words: list[str]) -> tuple[str, ...]:
    return tuple(w.lower() for w in words)


def test_random_pool_is_alpha_and_len_ge_3() -> None:
    pool = _random_pool()
    assert len(pool) > 1000
    assert all(w.isalpha() for w in pool)
    assert all(len(w) >= 3 for w in pool)


def test_never_returns_the_correct_word() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("scatter", "VB", _context([]), difficulty=0.5, rng=rng)
        assert a.lower() != "scatter" and b.lower() != "scatter"


def test_never_returns_inflected_form_of_correct_word() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("run", "VB", _context([]), difficulty=1.0, rng=rng)
        for distractor in (a, b):
            assert distractor.lower() not in {"run", "runs", "running", "ran"}


def test_filters_words_present_in_context() -> None:
    rng = random.Random(0)
    ctx = _context(["blue", "sky", "scatter", "light", "atmosphere", "molecules"])
    for _ in range(50):
        a, b, _ = pick_full("scatter", "VB", ctx, difficulty=0.5, rng=rng)
        for distractor in (a, b):
            assert distractor.lower() not in ctx


def test_two_distractors_differ() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("scatter", "VB", _context([]), difficulty=0.5, rng=rng)
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
        a, b, _ = pick_full("scatter", "VB", _context([]), difficulty=0.0, rng=rng)
        for distractor in (a, b):
            if distractor.lower() in synonyms_of_scatter:
                syn_count += 1
    assert syn_count <= total * 2 * 0.15


def test_difficulty_one_prefers_synonyms_when_available() -> None:
    rng = random.Random(7)
    synonym_count = 0
    total = 60
    for _ in range(total):
        _, _, (src_a, src_b) = pick_full("scatter", "VB", _context([]), difficulty=1.0, rng=rng)
        synonym_count += (src_a == "synonym") + (src_b == "synonym")
    assert synonym_count >= total * 2 * 0.6


def test_falls_back_to_random_when_no_synonyms() -> None:
    rng = random.Random(0)
    a, b, _ = pick_full("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
    assert a.isalpha() and b.isalpha()
    assert a.lower() != b.lower()


def test_distractors_match_leading_capital_of_correct() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("Paris", "NN", _context([]), difficulty=0.5, rng=rng)
        assert a[0].isupper() and b[0].isupper()


def test_distractors_match_leading_lowercase_of_correct() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("river", "NN", _context([]), difficulty=0.5, rng=rng)
        assert a[0].islower() and b[0].islower()


def test_seeded_output_is_deterministic() -> None:
    r1 = pick_full("scatter", "VB", _context([]), difficulty=0.5, rng=random.Random(42))
    r2 = pick_full("scatter", "VB", _context([]), difficulty=0.5, rng=random.Random(42))
    assert r1 == r2


def test_multi_word_wordnet_lemmas_are_rejected() -> None:
    rng = random.Random(0)
    for _ in range(50):
        a, b, _ = pick_full("run", "VB", _context([]), difficulty=1.0, rng=rng)
        for distractor in (a, b):
            assert "_" not in distractor and "-" not in distractor


def test_no_pos_still_produces_distractors() -> None:
    rng = random.Random(0)
    a, b, _ = pick_full("hello", "UH", _context([]), difficulty=0.5, rng=rng)
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
        synonym_source_count = 0
        trials = 30
        for _ in range(trials):
            _, _, sources = pick_full("run", "VB", _context([]), difficulty=1.0, rng=rng)
            synonym_source_count += sum(1 for s in sources if s == "synonym")
        assert synonym_source_count >= trials * 2 * 0.5
    finally:
        embeddings.reset_for_tests()


def test_cohyponym_pool_used_when_synonyms_absent() -> None:
    """oxygen has no acceptable direct synonyms (only 'o', filtered by len<3).
    Co-hyponyms (chemical elements) should fill the pool at high difficulty."""
    from nltk.corpus import wordnet as wn

    expected_cohyps = {
        name.lower()
        for syn in wn.synsets("oxygen", pos="n")
        for hypernym in syn.hypernyms()
        for sib in hypernym.hyponyms()
        for name in sib.lemma_names()
        if name.isalpha() and "_" not in name and len(name) >= 3
        and name.lower() != "oxygen"
    }
    assert "hydrogen" in expected_cohyps
    assert "helium" in expected_cohyps

    rng = random.Random(0)
    hit_count = 0
    trials = 40
    for _ in range(trials):
        a, b, _ = pick_full("oxygen", "NN", _context([]), difficulty=1.0, rng=rng)
        for d in (a, b):
            if d.lower() in expected_cohyps:
                hit_count += 1
    assert hit_count >= trials * 2 * 0.8


def test_cohyponym_source_is_synonym() -> None:
    """Co-hyponyms should carry 'synonym' source label."""
    rng = random.Random(99)
    total = 40
    synonym_source_count = 0
    for _ in range(total):
        _, _, (src_a, src_b) = pick_full(
            "oxygen", "NN", _context([]), difficulty=1.0, rng=rng
        )
        synonym_source_count += (src_a == "synonym") + (src_b == "synonym")
    assert synonym_source_count >= total * 2 * 0.8


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


def test_unified_pool_includes_both_wordnet_and_embeddings() -> None:
    # oxygen has rich WN co-hyponyms (chemical elements → synonym source)
    # voltage/current/torque are NOT WN co-hyponyms of oxygen → embedding source
    # oxygen must be in vocab so nearest("oxygen") returns neighbors
    # With seed 10, voltage scores high (idx=1) so diff=1.0 window covers it
    vocab = ["oxygen", "helium", "hydrogen", "nitrogen", "voltage", "current", "torque"]
    rng_np = np.random.default_rng(10)
    base = rng_np.normal(size=(len(vocab), 8)).astype(np.float32)
    matrix = base / np.linalg.norm(base, axis=1, keepdims=True)
    embeddings.install_for_tests(vocab, matrix)
    try:
        rng = random.Random(42)
        sources_seen: set[str] = set()
        for _ in range(50):
            _, _, (s1, s2) = pick_full("oxygen", "NN", _context([]), difficulty=1.0, rng=rng)
            sources_seen.add(s1)
            sources_seen.add(s2)
        assert "synonym" in sources_seen
        assert "embedding" in sources_seen
    finally:
        embeddings.reset_for_tests()


def test_high_difficulty_picks_rank_above_median(_install_technical_embeddings) -> None:
    cluster_words = {"gradient", "descent", "optimization", "training", "epoch", "neuron"}
    rng = random.Random(42)
    cluster_hits = 0
    trials = 30
    for _ in range(trials):
        a, b, _ = pick_full("backpropagation", "NN", _context([]), difficulty=1.0, rng=rng)
        for pick in (a, b):
            if pick.lower() in cluster_words:
                cluster_hits += 1
    assert cluster_hits >= trials * 2 * 0.5


def test_low_difficulty_picks_rank_below_median(_install_technical_embeddings) -> None:
    cluster_words = {"gradient", "descent", "optimization", "training", "epoch", "neuron"}
    trials = 30
    cluster_count_low = 0
    cluster_count_high = 0
    for _ in range(trials):
        a, b, _ = pick_full("backpropagation", "NN", _context([]), difficulty=0.0,
                            rng=random.Random(42))
        for pick in (a, b):
            if pick.lower() in cluster_words:
                cluster_count_low += 1
    for _ in range(trials):
        a, b, _ = pick_full("backpropagation", "NN", _context([]), difficulty=1.0,
                            rng=random.Random(42))
        for pick in (a, b):
            if pick.lower() in cluster_words:
                cluster_count_high += 1
    assert cluster_count_high > cluster_count_low


def test_frequency_matching_shifts_pool() -> None:
    import wordfreq as wf

    correct = "scatter"
    correct_zipf = wf.zipf_frequency(correct.lower(), "en")

    rng_high = random.Random(42)
    rng_low = random.Random(42)
    high_gaps: list[float] = []
    low_gaps: list[float] = []

    for _ in range(40):
        a, b, _ = pick_full(correct, "VB", _context([]), difficulty=1.0, rng=rng_high)
        for w in (a, b):
            z = wf.zipf_frequency(w.lower(), "en")
            if z > 0:
                high_gaps.append(abs(z - correct_zipf))

    for _ in range(40):
        a, b, _ = pick_full(correct, "VB", _context([]), difficulty=0.0, rng=rng_low)
        for w in (a, b):
            z = wf.zipf_frequency(w.lower(), "en")
            if z > 0:
                low_gaps.append(abs(z - correct_zipf))

    if high_gaps and low_gaps:
        assert np.mean(high_gaps) <= np.mean(low_gaps) + 0.5


def test_same_lemma_never_top_ranked() -> None:
    from app.generator.distractors import _penn_to_wn, _score_candidate

    correct = "run"
    wn_pos = _penn_to_wn("VB")
    correct_vec = embeddings.unit_vector(correct)
    correct_zipf = wordfreq.zipf_frequency(correct.lower(), "en")

    running_score = _score_candidate("running", correct, correct_vec, None, correct_zipf, wn_pos)
    jog_score = _score_candidate("jog", correct, correct_vec, None, correct_zipf, wn_pos)

    assert running_score < jog_score


def test_difficulty_monotonicity(_install_technical_embeddings) -> None:
    difficulties = [0.0, 0.25, 0.5, 0.75, 1.0]
    mean_sims: list[float] = []

    for diff in difficulties:
        sims: list[float] = []
        for _ in range(20):
            a, b, _ = pick_full("backpropagation", "NN", _context([]), difficulty=diff,
                                rng=random.Random(42))
            for pick in (a, b):
                vec_p = embeddings.unit_vector(pick)
                vec_c = embeddings.unit_vector("backpropagation")
                if vec_p is not None and vec_c is not None:
                    sims.append(float(np.dot(vec_p, vec_c)))
        mean_sims.append(float(np.mean(sims)) if sims else 0.0)

    for i in range(len(mean_sims) - 1):
        assert mean_sims[i] <= mean_sims[i + 1] + 0.1


def test_context_vector_influences_ranking(_install_technical_embeddings) -> None:
    from app.generator.distractors import _context_vector, _penn_to_wn, _score_candidate

    correct = "backpropagation"
    wn_pos = _penn_to_wn("NN")
    correct_vec = embeddings.unit_vector(correct)
    correct_zipf = wordfreq.zipf_frequency(correct.lower(), "en")

    ml_context = ("gradient", "training", "optimization", "descent", "epoch")
    ctx_vec = _context_vector(ml_context)
    assert ctx_vec is not None

    gradient_with = _score_candidate("gradient", correct, correct_vec, ctx_vec, correct_zipf, wn_pos)
    gradient_without = _score_candidate("gradient", correct, correct_vec, None, correct_zipf, wn_pos)
    carrot_with = _score_candidate("carrot", correct, correct_vec, ctx_vec, correct_zipf, wn_pos)
    carrot_without = _score_candidate("carrot", correct, correct_vec, None, correct_zipf, wn_pos)

    assert gradient_with >= gradient_without
    assert (gradient_with - gradient_without) >= (carrot_with - carrot_without)


def test_form_penalty_penalizes_ing_mismatch() -> None:
    from app.generator.distractors import _form_penalty

    assert _form_penalty("jog", "running", "VBG") == 1.0
    assert _form_penalty("jogging", "running", "VBG") == 0.0
    assert _form_penalty("jog", "run", "VB") == 0.0
    assert _form_penalty("jogging", "run", "VB") == 1.0


def test_form_penalty_penalizes_plural_mismatch() -> None:
    from app.generator.distractors import _form_penalty

    assert _form_penalty("cat", "dogs", "NNS") == 1.0
    assert _form_penalty("cats", "dogs", "NNS") == 0.0
    assert _form_penalty("cat", "dog", "NN") == 0.0
    assert _form_penalty("dogs", "cat", "NN") == 1.0


def test_determinism_under_unified_scoring(_install_technical_embeddings) -> None:
    r1 = pick_full("backpropagation", "NN", _context([]), difficulty=0.7, rng=random.Random(99))
    r2 = pick_full("backpropagation", "NN", _context([]), difficulty=0.7, rng=random.Random(99))
    assert r1 == r2
