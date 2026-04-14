import random
import uuid

from app.config import settings
from app.generator.answer import generate_answer
from app.generator.choice import assign_kinds
from app.generator.distractors import pick as pick_distractors
from app.generator.tokenize import analyze
from app.prompts import PROMPTS, Prompt, get
from app.schemas import ChoiceToken, RevealToken, Round, Token


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
                      seed: int | None = None) -> Round:
    rng = random.Random(seed)
    selected = _pick_prompt(prompt_id, rng)
    answer_text = await generate_answer(selected.text)

    tagged = analyze(answer_text)
    kinds = assign_kinds(
        tagged,
        opening=settings.opening_reveal,
        choice_target=settings.choice_target,
        rng=rng,
    )
    context = _build_context([tw.word for tw in tagged])
    diff = difficulty if difficulty is not None else settings.default_difficulty

    tokens: list[Token] = []
    for tw, kind in zip(tagged, kinds, strict=True):
        if kind == "reveal":
            tokens.append(RevealToken(word=tw.word))
            continue
        d1, d2 = pick_distractors(tw.word, tw.pos, context, diff, rng)
        tokens.append(ChoiceToken(correct=tw.word, distractors=(d1, d2)))

    return Round(id=f"round-{uuid.uuid4().hex[:12]}", prompt=selected.text, tokens=tokens)
