import logging
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.generator.answer import AnswerResult
from app.main import app
from app.round import build_round

CANNED_ANSWER = (
    "The sky appears blue because of Rayleigh scattering. Short wavelengths of light "
    "collide with molecules of nitrogen and oxygen in the atmosphere and are scattered "
    "in all directions. Blue light dominates what reaches our eyes during the day, which "
    "is why the sky looks blue to observers on the ground below."
)


def _canned_result(personality_name: str | None = "witty") -> AnswerResult:
    return AnswerResult(
        text=CANNED_ANSWER,
        retries=0,
        word_count=len(CANNED_ANSWER.split()),
        personality_name=personality_name,
    )


client = TestClient(app)


@pytest.fixture(autouse=True)
def _mock_llm():
    with patch("app.round.generate_answer_full", new=AsyncMock(return_value=_canned_result())):
        yield


def test_build_round_returns_valid_shape() -> None:
    import asyncio

    r, metrics = asyncio.run(build_round(prompt_id="sky-blue", difficulty=0.5, seed=1))
    assert r.id.startswith("round-")
    assert r.prompt == "Explain why the sky is blue."
    assert len(r.tokens) > 0

    choices = [t for t in r.tokens if t.kind == "choice"]
    reveals = [t for t in r.tokens if t.kind == "reveal"]
    assert 10 <= len(choices) <= 20
    assert len(reveals) > 0

    for c in choices:
        assert len(c.distractors) == 2
        assert c.correct.lower() not in {d.lower() for d in c.distractors}
        assert c.distractors[0].lower() != c.distractors[1].lower()

    assert metrics.prompt_id == "sky-blue"
    assert metrics.difficulty == 0.5
    assert metrics.choice_count == len(choices)
    assert sum(metrics.distractor_sources.values()) == len(choices) * 2


def test_distractor_leading_case_matches_correct() -> None:
    import asyncio

    r, _ = asyncio.run(build_round(prompt_id="sky-blue", difficulty=0.5, seed=1))
    for c in (t for t in r.tokens if t.kind == "choice"):
        for d in c.distractors:
            assert d[0].isupper() == c.correct[0].isupper()


def test_opening_tokens_are_reveal() -> None:
    import asyncio
    r, _ = asyncio.run(build_round(prompt_id="sky-blue", seed=1))
    assert r.tokens[0].kind == "reveal"
    assert r.tokens[1].kind == "reveal"
    assert r.tokens[2].kind == "reveal"


def test_get_round_endpoint_returns_schema_valid_round() -> None:
    r = client.get("/round?prompt_id=sky-blue&difficulty=0.5&seed=7")
    assert r.status_code == 200
    body = r.json()
    assert "id" in body and "prompt" in body and "tokens" in body
    for tok in body["tokens"]:
        assert tok["kind"] in {"reveal", "choice"}
        if tok["kind"] == "reveal":
            assert "word" in tok
        else:
            assert "correct" in tok
            assert isinstance(tok["distractors"], list)
            assert len(tok["distractors"]) == 2


def test_get_round_rejects_unknown_prompt_id() -> None:
    r = client.get("/round?prompt_id=does-not-exist")
    assert r.status_code == 404


def test_get_round_rejects_difficulty_out_of_range() -> None:
    r = client.get("/round?difficulty=1.5")
    assert r.status_code == 422


def test_round_is_deterministic_under_seed() -> None:
    r1 = client.get("/round?prompt_id=sky-blue&difficulty=0.5&seed=42").json()
    r2 = client.get("/round?prompt_id=sky-blue&difficulty=0.5&seed=42").json()
    r1.pop("id")
    r2.pop("id")
    assert r1 == r2


def test_random_prompt_selection_when_omitted() -> None:
    r = client.get("/round?seed=0").json()
    prompts = {p["prompt"] for p in client.get("/prompts").json()}
    assert r["prompt"] in prompts


def test_build_context_lowercases_and_filters_non_alpha() -> None:
    from app.round import _build_context

    ctx = _build_context(["Hello", "World", "123", ".", "foo-bar", "sky"])
    assert "hello" in ctx
    assert "world" in ctx
    assert "sky" in ctx
    assert "123" not in ctx
    assert "." not in ctx
    assert "foo-bar" not in ctx
    assert isinstance(ctx, frozenset)


def test_round_endpoint_emits_telemetry_event(caplog: pytest.LogCaptureFixture) -> None:
    from app.telemetry import LOGGER_NAME

    with caplog.at_level(logging.INFO, logger=LOGGER_NAME):
        r = client.get("/round?prompt_id=sky-blue&difficulty=0.5&seed=7")
    assert r.status_code == 200

    records = [rec for rec in caplog.records if rec.name == LOGGER_NAME and rec.message == "round"]
    assert len(records) == 1
    event = records[0].event
    assert event["prompt_id"] == "sky-blue"
    assert event["difficulty"] == 0.5
    assert event["seed"] == 7
    assert event["pool_hit"] is False
    assert event["answer_retries"] == 0
    assert event["answer_word_count"] > 0
    assert event["choice_count"] > 0
    assert event["answer_latency_ms"] >= 0
    assert event["total_latency_ms"] >= event["answer_latency_ms"]
    assert set(event["distractor_sources"]) == {"synonym", "embedding", "random"}
    assert event["distractor_sources"]["embedding"] == 0


def test_error_event_emitted_on_unexpected_failure(caplog: pytest.LogCaptureFixture) -> None:
    from app.telemetry import LOGGER_NAME

    async def boom(_: str, **_kw):
        raise RuntimeError("ollama down")

    strict_client = TestClient(app, raise_server_exceptions=False)
    with (
        patch("app.round.generate_answer_full", new=boom),
        caplog.at_level(logging.ERROR, logger=LOGGER_NAME),
    ):
        r = strict_client.get("/round?prompt_id=sky-blue&seed=1")
    assert r.status_code == 500

    error_records = [
        rec for rec in caplog.records if rec.name == LOGGER_NAME and rec.levelname == "ERROR"
    ]
    assert len(error_records) == 1
    event = error_records[0].event
    assert event["error_type"] == "RuntimeError"
    assert event["stage"] == "build_round"
    assert "ollama down" in event["message"]


def test_build_round_surfaces_personality_on_round_and_event() -> None:
    import asyncio

    r, event = asyncio.run(build_round(prompt_id="sky-blue", seed=1))
    assert r.personality == "witty"
    assert event.personality == "witty"


def test_round_endpoint_exposes_personality_field() -> None:
    body = client.get("/round?prompt_id=sky-blue&seed=1").json()
    assert body.get("personality") == "witty"


def test_build_round_personality_is_none_when_fallback() -> None:
    import asyncio

    fallback = AsyncMock(return_value=_canned_result(personality_name=None))
    with patch("app.round.generate_answer_full", new=fallback):
        r, event = asyncio.run(build_round(prompt_id="sky-blue", seed=1))
    assert r.personality is None
    assert event.personality is None


def test_metrics_report_distractor_sources() -> None:
    import asyncio

    _, event = asyncio.run(build_round(prompt_id="sky-blue", difficulty=1.0, seed=3))
    assert event.distractor_sources["embedding"] == 0
    assert (
        event.distractor_sources["synonym"] + event.distractor_sources["random"]
        == event.choice_count * 2
    )


def test_round_endpoint_uses_pool_when_available(caplog: pytest.LogCaptureFixture) -> None:
    from app.pool import RoundPool
    from app.schemas import RevealToken
    from app.telemetry import LOGGER_NAME
    from tests.conftest import make_pool_item

    cached = make_pool_item(
        round_id="round-cached", prompt="cached", prompt_id="cached-prompt",
        tokens=[RevealToken(word="hello")],
        answer_latency_ms=42, answer_retries=1, answer_word_count=55,
        choice_count=12,
        distractor_sources={"synonym": 5, "embedding": 0, "random": 19},
    )

    async def never_build():
        raise AssertionError("pool hit should skip build_round")

    pool = RoundPool(size=1, builder=never_build)
    pool.put_nowait(cached)
    app.state.round_pool = pool

    try:
        with caplog.at_level(logging.INFO, logger=LOGGER_NAME):
            r = client.get("/round")
        assert r.status_code == 200
        assert r.json()["id"] == "round-cached"
        records = [
            rec for rec in caplog.records if rec.name == LOGGER_NAME and rec.message == "round"
        ]
        assert len(records) == 1
        assert records[0].event["pool_hit"] is True
        assert records[0].event["prompt_id"] == "cached-prompt"
        assert records[0].event["answer_retries"] == 1
    finally:
        if hasattr(app.state, "round_pool"):
            delattr(app.state, "round_pool")


def test_round_endpoint_bypasses_pool_when_overrides_present(
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.pool import RoundPool
    from app.schemas import RevealToken
    from app.telemetry import LOGGER_NAME
    from tests.conftest import make_pool_item

    cached = make_pool_item(
        round_id="round-cached", prompt="cached", prompt_id="cached-prompt",
        tokens=[RevealToken(word="hello")],
        answer_latency_ms=1, answer_word_count=5,
    )

    async def builder():
        return cached

    pool = RoundPool(size=1, builder=builder)
    pool.put_nowait(cached)
    app.state.round_pool = pool

    try:
        with caplog.at_level(logging.INFO, logger=LOGGER_NAME):
            r = client.get("/round?prompt_id=sky-blue&seed=1")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] != "round-cached"
        assert body["prompt"] == "Explain why the sky is blue."
        assert pool.size == 1
        records = [
            rec for rec in caplog.records if rec.name == LOGGER_NAME and rec.message == "round"
        ]
        assert records[0].event["pool_hit"] is False
    finally:
        if hasattr(app.state, "round_pool"):
            delattr(app.state, "round_pool")


def test_round_endpoint_falls_back_to_build_when_pool_empty(
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.pool import RoundPool
    from app.telemetry import LOGGER_NAME

    async def builder():
        raise AssertionError("builder should not be driven in this test")

    pool = RoundPool(size=1, builder=builder)
    app.state.round_pool = pool

    try:
        with caplog.at_level(logging.INFO, logger=LOGGER_NAME):
            r = client.get("/round")
        assert r.status_code == 200
        records = [
            rec for rec in caplog.records if rec.name == LOGGER_NAME and rec.message == "round"
        ]
        assert records[0].event["pool_hit"] is False
    finally:
        if hasattr(app.state, "round_pool"):
            delattr(app.state, "round_pool")
