import re
from dataclasses import dataclass

import nltk
from nltk.tokenize import PunktSentenceTokenizer
from nltk.tokenize.treebank import TreebankWordTokenizer

_PUNCT_RE = re.compile(r"^[^\w]+$")
_DIGIT_RE = re.compile(r"^\d+$")
_WORD_TOKENIZER = TreebankWordTokenizer()
_SENT_TOKENIZER = PunktSentenceTokenizer()


@dataclass(frozen=True)
class TaggedWord:
    index: int
    word: str
    pos: str
    leading_space: bool = False

    @property
    def is_punct(self) -> bool:
        return bool(_PUNCT_RE.match(self.word))

    @property
    def is_digit(self) -> bool:
        return bool(_DIGIT_RE.match(self.word))


def _token_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    for sent_start, sent_end in _SENT_TOKENIZER.span_tokenize(text):
        sub = text[sent_start:sent_end]
        for ws, we in _WORD_TOKENIZER.span_tokenize(sub):
            spans.append((sent_start + ws, sent_start + we))
    return spans


def _tokenize_with_spaces(text: str) -> tuple[list[str], list[bool]]:
    spans = _token_spans(text)
    words = [text[start:end] for start, end in spans]
    leading = [False] + [spans[i][0] > spans[i - 1][1] for i in range(1, len(spans))]
    return words, leading


def tokenize(text: str) -> list[str]:
    words, _ = _tokenize_with_spaces(text)
    return words


def analyze(text: str) -> list[TaggedWord]:
    words, leading = _tokenize_with_spaces(text)
    tagged = nltk.pos_tag(words)
    return [
        TaggedWord(index=i, word=w, pos=p, leading_space=leading[i])
        for i, (w, p) in enumerate(tagged)
    ]
