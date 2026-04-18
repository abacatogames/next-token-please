import random
import re
from dataclasses import dataclass

from app.generator import ollama_client
from app.generator.text import collapse_whitespace, has_preamble, strip_wrappers, word_count

SYSTEM = (
    "You generate short, creative prompts for a word-guessing game.\n"
    "Strict format:\n"
    "- one prompt per line\n"
    "- no numbering, no bullets, no quotes\n"
    "- 4 to 20 words each\n"
    "- start with a capital letter\n"
    "- start with a wh-word (Why/How/What/When/Where/Which/Who),"
    " a question auxiliary (Is/Are/Do/Does/Can/Could/Would/Should...),"
    " or an imperative verb (Describe/Explain/Imagine/Picture/Compare...)\n"
    "- end '?' for questions, '.' for imperatives\n"
    "- complete sentence, no fragments or bare statements of fact\n"
    "- no preamble, no meta-commentary, no 'Sure' or 'Here are'\n"
    "- each prompt standalone and self-contained"
)

THEMES: dict[str, str] = {
    "science": "natural sciences, physics, biology, chemistry, astronomy",
    "technology": "software, computers, the internet, AI, engineering",
    "philosophy": "ethics, meaning, consciousness, existence",
    "everyday_life": "mundane objects, routines, habits, small rituals",
    "history": "historical events, figures, eras, turning points",
    "arts_culture": "music, painting, literature, cinema, cultural practices",
    "absurd_fiction": "surreal, impossible, whimsical, dreamlike scenarios",
    "self_reflection": "introspection, memory, identity, emotions",
}

TONES: dict[str, str] = {
    "factual": "direct, informative, asks for an explanation",
    "playful": "light, witty, a little silly",
    "imaginative": "creative, vivid, invites a descriptive answer",
    "hypothetical": "'what if' style, counterfactual, speculative",
}

DIFFICULTIES: dict[str, str] = {
    "easy": "widely known topic, answer uses simple vocabulary",
    "medium": "somewhat specialized topic, answer uses moderate vocabulary",
    "hard": "niche or abstract topic, answer uses precise or technical vocabulary",
}

MIN_WORDS = 4
MAX_WORDS = 20
RETRIES = 2
DEFAULT_TEMPERATURE = 0.95
DEFAULT_TOP_P = 0.95
DEFAULT_BATCH_SIZE = 5
DUPLICATE_JACCARD = 0.8

WH_WORDS = frozenset({"how", "why", "what", "when", "where", "which", "who", "whose"})
QUESTION_AUX = frozenset({
    "is", "are", "was", "were", "am",
    "do", "does", "did",
    "can", "could", "will", "would", "should", "shall",
    "may", "might", "must",
    "has", "have", "had",
})
IMPERATIVE_VERBS = frozenset({
    "describe", "explain", "imagine", "picture", "compare", "contrast",
    "list", "name", "tell", "predict", "suggest", "consider", "invent",
    "design", "draw", "guess", "pretend", "create", "define", "outline",
    "summarize", "rank", "choose", "recall", "recount", "narrate",
    "sketch", "estimate", "rate", "argue", "convince", "justify",
})
ALLOWED_STARTERS = WH_WORDS | QUESTION_AUX | IMPERATIVE_VERBS

_FIRST_WORD = re.compile(r"\s*([A-Za-z][A-Za-z']*)")


@dataclass(frozen=True)
class Cell:
    theme: str
    tone: str
    difficulty: str


@dataclass
class BatchResult:
    prompts: list[str]
    cell: Cell
    requested: int
    accepted: int
    rejected: int
    retries: int


def sample_cell(rng: random.Random) -> Cell:
    return Cell(
        theme=rng.choice(list(THEMES.keys())),
        tone=rng.choice(list(TONES.keys())),
        difficulty=rng.choice(list(DIFFICULTIES.keys())),
    )


def build_user_prompt(cell: Cell, count: int) -> str:
    return (
        f"Theme: {THEMES[cell.theme]}\n"
        f"Tone: {TONES[cell.tone]}\n"
        f"Difficulty: {DIFFICULTIES[cell.difficulty]}\n"
        f"Generate {count} distinct prompts matching this theme, tone, and difficulty. "
        "One per line."
    )


_LEADING_MARK = re.compile(r"^\s*(?:[-*\u2022]|\d+[.)])\s+")


def _clean_line(line: str) -> str:
    line = _LEADING_MARK.sub("", line.strip())
    line = strip_wrappers(line)
    return collapse_whitespace(line)


def parse_batch(raw: str) -> list[str]:
    return [c for c in (_clean_line(line) for line in raw.splitlines()) if c]


def _tokens(text: str) -> frozenset[str]:
    return frozenset(re.findall(r"[a-z0-9]+", text.lower()))


def _is_duplicate(text: str, existing_tokens: list[frozenset[str]]) -> bool:
    candidate = _tokens(text)
    if not candidate:
        return True
    for prior in existing_tokens:
        union = candidate | prior
        if not union:
            continue
        jaccard = len(candidate & prior) / len(union)
        if jaccard >= DUPLICATE_JACCARD:
            return True
    return False


def _first_word(text: str) -> str:
    m = _FIRST_WORD.match(text)
    return m.group(1) if m else ""


def _starts_with_capital(text: str) -> bool:
    stripped = text.lstrip()
    return bool(stripped) and stripped[0].isupper()


def _has_allowed_starter(text: str) -> bool:
    return _first_word(text).lower() in ALLOWED_STARTERS


def validate(
    text: str,
    *,
    existing_tokens: list[frozenset[str]],
    min_words: int = MIN_WORDS,
    max_words: int = MAX_WORDS,
) -> bool:
    if not text:
        return False
    if has_preamble(text):
        return False
    if not text.endswith((".", "?", "!")):
        return False
    if not _starts_with_capital(text):
        return False
    if not _has_allowed_starter(text):
        return False
    wc = word_count(text)
    if wc < min_words or wc > max_words:
        return False
    return not _is_duplicate(text, existing_tokens)


async def generate_batch(
    cell: Cell,
    *,
    count: int = DEFAULT_BATCH_SIZE,
    existing_texts: frozenset[str] = frozenset(),
    temperature: float = DEFAULT_TEMPERATURE,
    top_p: float = DEFAULT_TOP_P,
    min_words: int = MIN_WORDS,
    max_words: int = MAX_WORDS,
    retries: int = RETRIES,
) -> BatchResult:
    accepted: list[str] = []
    accepted_tokens: list[frozenset[str]] = [_tokens(t) for t in existing_texts]
    rejected = 0
    attempts = 0
    user_prompt = build_user_prompt(cell, count)
    num_predict = max(64, count * (max_words + 4))

    for _ in range(retries):
        attempts += 1
        raw = await ollama_client.generate(
            prompt=user_prompt,
            system=SYSTEM,
            temperature=temperature,
            top_p=top_p,
            num_predict=num_predict,
        )
        for candidate in parse_batch(raw):
            if validate(
                candidate,
                existing_tokens=accepted_tokens,
                min_words=min_words,
                max_words=max_words,
            ):
                accepted.append(candidate)
                accepted_tokens.append(_tokens(candidate))
            else:
                rejected += 1
            if len(accepted) >= count:
                break
        if len(accepted) >= count:
            break

    return BatchResult(
        prompts=accepted[:count],
        cell=cell,
        requested=count,
        accepted=len(accepted[:count]),
        rejected=rejected,
        retries=attempts - 1,
    )
