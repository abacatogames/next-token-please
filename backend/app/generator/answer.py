from dataclasses import dataclass

from app.generator import ollama_client
from app.generator.personality import Personality, build_system
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
    personality_name: str | None = None

SYSTEM = (
    "You write short factual answers. Strict format:\n"
    "- 35 to 55 words\n"
    "- plain prose, no lists, no markdown, no headings\n"
    "- answer directly; do not begin with \"Sure\", \"Here\", \"I\"\n"
    "- stop at the period of the final sentence"
)

MIN_WORDS = 25
MAX_WORDS = 75
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


async def generate_answer_full(
    prompt: str, *, personality: Personality | None = None
) -> AnswerResult:
    last: str = ""
    attempts = 0
    persona_name = personality.name if personality is not None else None
    for i in range(RETRIES):
        attempts += 1
        is_final_attempt = i == RETRIES - 1
        system = build_system(SYSTEM, None if is_final_attempt else personality)
        raw = await ollama_client.generate(prompt=prompt, system=system)
        text = _post_process(raw)
        last = text
        if _passes(text):
            used = None if is_final_attempt else persona_name
            return AnswerResult(
                text=text,
                retries=attempts - 1,
                word_count=word_count(text),
                personality_name=used,
            )
    final = last or "No answer available."
    return AnswerResult(
        text=final,
        retries=attempts - 1,
        word_count=word_count(final),
        personality_name=None,
    )
