import pytest

from app.schemas import RevealToken, Round, Token
from app.telemetry import RoundEvent


@pytest.fixture(autouse=True)
def _disable_rate_limiter():
    from app.main import limiter

    previous = limiter.enabled
    limiter.enabled = False
    try:
        yield
    finally:
        limiter.enabled = previous
        limiter._storage.reset()


def make_pool_item(
    *,
    round_id: str = "round-test",
    prompt: str = "prompt",
    prompt_id: str = "prompt-id",
    tokens: list[Token] | None = None,
    difficulty: float = 0.5,
    seed: int | None = None,
    answer_latency_ms: int = 0,
    answer_retries: int = 0,
    answer_word_count: int = 0,
    choice_count: int = 0,
    distractor_sources: dict[str, int] | None = None,
) -> tuple[Round, RoundEvent]:
    round_obj = Round(
        id=round_id,
        prompt=prompt,
        tokens=tokens if tokens is not None else [RevealToken(word="hi", leading_space=False)],
    )
    event = RoundEvent(
        round_id=round_id,
        prompt_id=prompt_id,
        difficulty=difficulty,
        seed=seed,
        pool_hit=False,
        answer_latency_ms=answer_latency_ms,
        answer_retries=answer_retries,
        answer_word_count=answer_word_count,
        choice_count=choice_count,
        distractor_sources=distractor_sources
        if distractor_sources is not None
        else {"synonym": 0, "embedding": 0, "random": 0},
        total_latency_ms=0,
    )
    return round_obj, event
