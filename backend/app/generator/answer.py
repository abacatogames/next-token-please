from dataclasses import dataclass

from app.generator import ollama_client
from app.generator.text import (
    collapse_whitespace,
    has_preamble,
    strip_wrappers,
    truncate_to_sentence,
    word_count,
)


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


_has_preamble = has_preamble
_strip_wrappers = strip_wrappers


def _truncate_to_sentence(text: str) -> str:
    return truncate_to_sentence(text, MAX_WORDS)


def _post_process(raw: str) -> str:
    text = strip_wrappers(raw.strip())
    text = collapse_whitespace(text)
    return truncate_to_sentence(text, MAX_WORDS)


def _passes(text: str) -> bool:
    if has_preamble(text):
        return False
    if word_count(text) < MIN_WORDS:
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
            return AnswerResult(text=text, retries=attempts - 1, word_count=word_count(text))
    final = last or "No answer available."
    return AnswerResult(text=final, retries=attempts - 1, word_count=word_count(final))
