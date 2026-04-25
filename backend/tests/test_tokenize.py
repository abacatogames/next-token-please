from app.generator.tokenize import TaggedWord, analyze, tokenize


def test_splits_punctuation_as_separate_tokens() -> None:
    assert tokenize("Hello, world.") == ["Hello", ",", "world", "."]


def test_splits_clitics() -> None:
    assert tokenize("The Moon's gravity.") == ["The", "Moon", "'s", "gravity", "."]


def test_keeps_hyphenated_words_whole() -> None:
    assert tokenize("A real-life example.") == ["A", "real-life", "example", "."]


def test_separates_em_dash() -> None:
    tokens = tokenize("Short — but sweet.")
    assert "—" in tokens
    assert tokens.index("—") == 1


def test_converts_treebank_quotes_to_regular_quote() -> None:
    tokens = tokenize('She said "hi" quickly.')
    assert "``" not in tokens and "''" not in tokens
    assert tokens.count('"') == 2


def test_analyze_returns_indexed_pos_tagged_words() -> None:
    words = analyze("The sky is blue.")
    assert [w.word for w in words] == ["The", "sky", "is", "blue", "."]
    assert [w.index for w in words] == [0, 1, 2, 3, 4]
    assert all(w.pos for w in words)


def test_tagged_word_classifies_punct_and_digits() -> None:
    assert TaggedWord(0, ".", ".").is_punct
    assert TaggedWord(0, ",", ",").is_punct
    assert TaggedWord(0, "—", ":").is_punct
    assert not TaggedWord(0, "sky", "NN").is_punct
    assert TaggedWord(0, "2026", "CD").is_digit
    assert not TaggedWord(0, "sky", "NN").is_digit


def _spacing(text: str) -> list[tuple[str, bool]]:
    return [(tw.word, tw.leading_space) for tw in analyze(text)]


def test_leading_space_first_token_is_false() -> None:
    assert _spacing("Hello world.")[0] == ("Hello", False)


def test_leading_space_glues_contraction_suffix() -> None:
    assert _spacing("Don't worry.") == [
        ("Do", False),
        ("n't", False),
        ("worry", True),
        (".", False),
    ]
    assert _spacing("He doesn't care.") == [
        ("He", False),
        ("does", True),
        ("n't", False),
        ("care", True),
        (".", False),
    ]


def test_leading_space_glues_parentheses() -> None:
    assert _spacing("It (probably) works.") == [
        ("It", False),
        ("(", True),
        ("probably", False),
        (")", False),
        ("works", True),
        (".", False),
    ]


def test_leading_space_glues_quoted_word() -> None:
    assert _spacing('She said "hi" quickly.') == [
        ("She", False),
        ("said", True),
        ('"', True),
        ("hi", False),
        ('"', False),
        ("quickly", True),
        (".", False),
    ]


def test_leading_space_glues_possessive_clitic() -> None:
    assert _spacing("The Moon's gravity.") == [
        ("The", False),
        ("Moon", True),
        ("'s", False),
        ("gravity", True),
        (".", False),
    ]
