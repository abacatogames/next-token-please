import random
import time
import uuid

from app.config import settings
from app.generator import personality as personality_module
from app.generator.answer import generate_answer_full
from app.generator.choice import assign_kinds
from app.generator.distractors import pick_full as pick_distractors_full
from app.generator.tokenize import analyze
from app.prompts import Prompt
from app.schemas import ChoiceToken, RevealToken, Round, Token
from app.store import get_store
from app.telemetry import RoundEvent


def _pick_prompt(prompt_id: str | None, rng: random.Random) -> Prompt:
    store = get_store()
    if prompt_id is not None:
        p = store.get(prompt_id)
        if p is None:
            raise KeyError(prompt_id)
        return p
    return store.pick(rng)


def _build_context(words: list[str]) -> frozenset[str]:
    return frozenset(w.lower() for w in words if w.isalpha())


async def build_round(*, prompt_id: str | None = None, difficulty: float | None = None,
                      seed: int | None = None) -> tuple[Round, RoundEvent]:
    rng = random.Random(seed)
    selected = _pick_prompt(prompt_id, rng)
    diff = difficulty if difficulty is not None else settings.default_difficulty
    personality = personality_module.pick(rng)

    t0 = time.perf_counter()
    answer = await generate_answer_full(selected.text, personality=personality)
    answer_latency_ms = int((time.perf_counter() - t0) * 1000)

    tagged = analyze(answer.text)
    kinds = assign_kinds(
        tagged,
        opening=settings.opening_reveal,
        choice_target_pct=settings.choice_target_pct,
        rng=rng,
    )
    context = _build_context([tw.word for tw in tagged])

    sources = {"synonym": 0, "embedding": 0, "random": 0}
    tokens: list[Token] = []
    prefix: list[str] = []
    for tw, kind in zip(tagged, kinds, strict=True):
        if kind == "reveal":
            tokens.append(RevealToken(word=tw.word, leading_space=tw.leading_space))
            prefix.append(tw.word)
            continue
        d1, d2, src = pick_distractors_full(
            tw.word, tw.pos, tuple(prefix), diff, rng, context_set=context,
        )
        sources[src[0]] += 1
        sources[src[1]] += 1
        tokens.append(
            ChoiceToken(correct=tw.word, distractors=(d1, d2), leading_space=tw.leading_space)
        )
        prefix.append(tw.word)

    choice_count = sum(1 for t in tokens if t.kind == "choice")
    round_obj = Round(
        id=f"round-{uuid.uuid4().hex[:12]}",
        prompt=selected.text,
        tokens=tokens,
        personality=answer.personality_name,
    )
    event = RoundEvent(
        round_id=round_obj.id,
        prompt_id=selected.id,
        difficulty=diff,
        seed=seed,
        pool_hit=False,
        answer_latency_ms=answer_latency_ms,
        answer_retries=answer.retries,
        answer_word_count=answer.word_count,
        choice_count=choice_count,
        distractor_sources=sources,
        total_latency_ms=0,
        personality=answer.personality_name,
    )
    return round_obj, event
