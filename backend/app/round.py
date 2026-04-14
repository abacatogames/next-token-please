import random
import time
import uuid
from dataclasses import dataclass, field

from app.config import settings
from app.generator.answer import generate_answer_full
from app.generator.choice import assign_kinds
from app.generator.distractors import pick_full as pick_distractors_full
from app.generator.tokenize import analyze
from app.prompts import PROMPTS, Prompt, get
from app.schemas import ChoiceToken, RevealToken, Round, Token


@dataclass
class RoundMetrics:
    prompt_id: str
    difficulty: float
    seed: int | None
    answer_latency_ms: int
    answer_retries: int
    answer_word_count: int
    choice_count: int
    distractor_sources: dict[str, int] = field(
        default_factory=lambda: {"synonym": 0, "embedding": 0, "random": 0}
    )


def _pick_prompt(prompt_id: str | None, rng: random.Random) -> Prompt:
    if prompt_id is not None:
        p = get(prompt_id)
        if p is None:
            raise KeyError(prompt_id)
        return p
    return rng.choice(PROMPTS)


def _build_context(words: list[str]) -> frozenset[str]:
    return frozenset(w.lower() for w in words if w.isalpha())


async def build_round(*, prompt_id: str | None = None, difficulty: float | None = None,
                      seed: int | None = None) -> tuple[Round, RoundMetrics]:
    rng = random.Random(seed)
    selected = _pick_prompt(prompt_id, rng)
    diff = difficulty if difficulty is not None else settings.default_difficulty

    t0 = time.perf_counter()
    answer = await generate_answer_full(selected.text)
    answer_latency_ms = int((time.perf_counter() - t0) * 1000)

    tagged = analyze(answer.text)
    kinds = assign_kinds(
        tagged,
        opening=settings.opening_reveal,
        choice_target=settings.choice_target,
        rng=rng,
    )
    context = _build_context([tw.word for tw in tagged])

    sources = {"synonym": 0, "embedding": 0, "random": 0}
    tokens: list[Token] = []
    for tw, kind in zip(tagged, kinds, strict=True):
        if kind == "reveal":
            tokens.append(RevealToken(word=tw.word))
            continue
        d1, d2, src = pick_distractors_full(tw.word, tw.pos, context, diff, rng)
        sources[src[0]] += 1
        sources[src[1]] += 1
        tokens.append(ChoiceToken(correct=tw.word, distractors=(d1, d2)))

    choice_count = sum(1 for t in tokens if t.kind == "choice")
    round_obj = Round(id=f"round-{uuid.uuid4().hex[:12]}", prompt=selected.text, tokens=tokens)
    metrics = RoundMetrics(
        prompt_id=selected.id,
        difficulty=diff,
        seed=seed,
        answer_latency_ms=answer_latency_ms,
        answer_retries=answer.retries,
        answer_word_count=answer.word_count,
        choice_count=choice_count,
        distractor_sources=sources,
    )
    return round_obj, metrics
