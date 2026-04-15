import re
from dataclasses import dataclass

import nltk

from app.generator import ollama_client


@dataclass
class AnswerResult:
    text: str
    retries: int
    word_count: int

SYSTEM = (
    "You write short factual answers. Strict format:\n"
    "- 40 to 60 words\n"
    "- plain prose, no lists, no markdown, no headings\n"
    "- answer directly; do not begin with \"Sure\", \"Here\", \"I\"\n"
    "- stop at the period of the final sentence"
)

MIN_WORDS = 30
MAX_WORDS = 80
RETRIES = 3

_PREAMBLE_FIRST_WORDS = {"sure", "certainly", "absolutely", "okay", "alright"}
_PREAMBLE_PHRASES = ("here is", "here's", "here are", "i'd", "i will", "i'll",
                     "let me", "of course")
_STRIP_WRAPPERS = ('"', "'", "“", "”")


def _word_count(text: str) -> int:
    return len(text.split())


def _strip_wrappers(text: str) -> str:
    if len(text) >= 2 and text[0] in _STRIP_WRAPPERS and text[-1] in _STRIP_WRAPPERS:
        return text[1:-1].strip()
    return text


def _has_preamble(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower().lstrip()
    first_word = re.split(r"\W+", lowered, maxsplit=1)[0]
    if first_word in _PREAMBLE_FIRST_WORDS:
        return True
    return any(lowered.startswith(p) for p in _PREAMBLE_PHRASES)


def _truncate_to_sentence(text: str) -> str:
    if _word_count(text) <= MAX_WORDS:
        return text
    sentences = nltk.sent_tokenize(text)
    kept: list[str] = []
    word_total = 0
    for s in sentences:
        w = _word_count(s)
        if kept and word_total + w > MAX_WORDS:
            break
        kept.append(s)
        word_total += w
    return " ".join(kept).strip()


def _post_process(raw: str) -> str:
    text = _strip_wrappers(raw.strip())
    text = re.sub(r"\s+", " ", text).strip()
    return _truncate_to_sentence(text)


def _passes(text: str) -> bool:
    if _has_preamble(text):
        return False
    if _word_count(text) < MIN_WORDS:
        return False
    return text.endswith((".", "!", "?"))


async def generate_answer_full(prompt: str) -> AnswerResult:
    last: str = ""
    attempts = 0
    for _ in range(RETRIES):
        attempts += 1
        raw = await ollama_client.generate(prompt=prompt, system=SYSTEM)
        text = _post_process(raw)
        last = text
        if _passes(text):
            return AnswerResult(text=text, retries=attempts - 1, word_count=_word_count(text))
    final = last or "No answer available."
    return AnswerResult(text=final, retries=attempts - 1, word_count=_word_count(final))
