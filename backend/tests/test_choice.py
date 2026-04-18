import random

from app.generator.choice import _target_choice_count, assign_kinds
from app.generator.tokenize import analyze

SAMPLE = (
    "The sky appears blue because of a phenomenon called Rayleigh scattering. "
    "When sunlight enters the atmosphere, it collides with molecules of nitrogen "
    "and oxygen. Shorter wavelengths of light, like blue and violet, are scattered "
    "more than longer wavelengths."
)


def test_target_count_is_percentage_of_total() -> None:
    assert _target_choice_count(50, 0.30) == 15
    assert _target_choice_count(50, 0.40) == 20
    assert _target_choice_count(10, 0.30) == 3
    assert _target_choice_count(0, 0.30) == 1
    assert _target_choice_count(100, 0.0) == 1


def test_opening_words_are_always_reveal() -> None:
    tagged = analyze(SAMPLE)
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    assert kinds[0] == "reveal"
    assert kinds[1] == "reveal"
    assert kinds[2] == "reveal"


def test_punctuation_is_always_reveal() -> None:
    tagged = analyze(SAMPLE)
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    for tw, k in zip(tagged, kinds, strict=True):
        if tw.is_punct:
            assert k == "reveal", f"expected reveal for {tw.word!r}"


def test_short_words_are_always_reveal() -> None:
    tagged = analyze(SAMPLE)
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    for tw, k in zip(tagged, kinds, strict=True):
        if len(tw.word) < 3:
            assert k == "reveal", f"expected reveal for short word {tw.word!r}"


def test_choice_count_lands_in_expected_band() -> None:
    tagged = analyze(SAMPLE)
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    choices = sum(1 for k in kinds if k == "choice")
    assert 10 <= choices <= 20, f"got {choices} choices"


def test_deterministic_with_seed() -> None:
    tagged = analyze(SAMPLE)
    a = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(42))
    b = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(42))
    assert a == b


def test_all_candidates_forced_reveal_means_no_choices() -> None:
    tagged = analyze("is on a at by to in it of or .")
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    assert all(k == "reveal" for k in kinds)


def test_digit_tokens_are_always_reveal() -> None:
    from app.generator.choice import _is_forced_reveal
    from app.generator.tokenize import TaggedWord

    assert _is_forced_reveal(TaggedWord(5, "2026", "CD"), opening=3)
    assert _is_forced_reveal(TaggedWord(5, "42", "CD"), opening=3)


def test_no_consecutive_choices() -> None:
    tagged = analyze(SAMPLE)
    kinds = assign_kinds(tagged, opening=3, choice_target_pct=0.30, rng=random.Random(0))
    for a, b in zip(kinds, kinds[1:], strict=False):
        assert not (a == "choice" and b == "choice"), "consecutive choices found"


def test_three_char_word_is_forced_reveal() -> None:
    from app.generator.choice import _is_forced_reveal
    from app.generator.tokenize import TaggedWord

    assert _is_forced_reveal(TaggedWord(5, "the", "DT"), opening=3)
    assert not _is_forced_reveal(TaggedWord(5, "blue", "JJ"), opening=3)
