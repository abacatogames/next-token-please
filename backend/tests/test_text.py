from app.generator.text import has_unresolved_pronoun


def test_flags_bare_it_at_start_without_antecedent() -> None:
    assert has_unresolved_pronoun("Why does it keep happening every morning?")


def test_flags_bare_their_without_antecedent() -> None:
    assert has_unresolved_pronoun(
        "Could their existence change our perceptions of personal identity and responsibility?"
    )


def test_flags_dangling_one_after_instead_of() -> None:
    assert has_unresolved_pronoun(
        "When might a peaceful American Civil War have occurred instead of one?"
    )


def test_flags_dangling_one_after_than() -> None:
    assert has_unresolved_pronoun("Would a small city be better than one?")


def test_accepts_pronoun_with_prior_noun_antecedent() -> None:
    assert not has_unresolved_pronoun(
        "Can a mainframe outlive the engineers who built it?"
    )


def test_accepts_their_with_prior_noun() -> None:
    assert not has_unresolved_pronoun(
        "Why do bees find their way back to the hive?"
    )


def test_accepts_prompt_with_no_pronouns() -> None:
    assert not has_unresolved_pronoun("Why do stars twinkle at night?")


def test_accepts_one_not_dangling() -> None:
    assert not has_unresolved_pronoun("Why is one planet brighter than another?")
