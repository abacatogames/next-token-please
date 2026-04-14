import re
from dataclasses import dataclass

import nltk

_QUOTE_FIXES = {"``": '"', "''": '"'}
_PUNCT_RE = re.compile(r"^[^\w]+$")
_DIGIT_RE = re.compile(r"^\d+$")


@dataclass(frozen=True)
class TaggedWord:
    index: int
    word: str
    pos: str

    @property
    def is_punct(self) -> bool:
        return bool(_PUNCT_RE.match(self.word))

    @property
    def is_digit(self) -> bool:
        return bool(_DIGIT_RE.match(self.word))


def tokenize(text: str) -> list[str]:
    raw = nltk.word_tokenize(text)
    return [_QUOTE_FIXES.get(t, t) for t in raw]


def analyze(text: str) -> list[TaggedWord]:
    words = tokenize(text)
    tagged = nltk.pos_tag(words)
    return [TaggedWord(index=i, word=w, pos=p) for i, (w, p) in enumerate(tagged)]
