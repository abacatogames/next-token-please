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
