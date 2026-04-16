import re

import nltk

_PREAMBLE_FIRST_WORDS = {"sure", "certainly", "absolutely", "okay", "alright"}
_PREAMBLE_PHRASES = (
    "here is", "here's", "here are", "i'd", "i will", "i'll",
    "let me", "of course",
)
_STRIP_WRAPPERS = ('"', "'", "\u201c", "\u201d")


def word_count(text: str) -> int:
    return len(text.split())


def strip_wrappers(text: str) -> str:
    if len(text) >= 2 and text[0] in _STRIP_WRAPPERS and text[-1] in _STRIP_WRAPPERS:
        return text[1:-1].strip()
    return text


def has_preamble(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower().lstrip()
    first_word = re.split(r"\W+", lowered, maxsplit=1)[0]
    if first_word in _PREAMBLE_FIRST_WORDS:
        return True
    return any(lowered.startswith(p) for p in _PREAMBLE_PHRASES)


def collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def truncate_to_sentence(text: str, max_words: int) -> str:
    if word_count(text) <= max_words:
        return text
    sentences = nltk.sent_tokenize(text)
    kept: list[str] = []
    total = 0
    for s in sentences:
        w = word_count(s)
        if kept and total + w > max_words:
            break
        kept.append(s)
        total += w
    return " ".join(kept).strip()
