from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_model_and_ok() -> None:
    with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=True)):
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["model"]
    assert body["ollama_reachable"] is True
    assert body["pool_size"] == 0
    assert body["pool_ready"] is False


def test_health_reports_pool_state_when_present() -> None:
    from app.pool import RoundPool
    from app.schemas import RevealToken
    from tests.conftest import make_pool_item

    async def builder():
        raise AssertionError("health should not drive builder")

    pool = RoundPool(size=2, builder=builder)
    pool.put_nowait(
        make_pool_item(
            round_id="round-x", prompt="x", prompt_id="x",
            tokens=[RevealToken(word="x")],
            answer_latency_ms=1, answer_word_count=1,
        )
    )
    from app.main import app as fastapi_app

    fastapi_app.state.round_pool = pool
    try:
        with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=True)):
            body = client.get("/health").json()
        assert body["pool_size"] == 1
        assert body["pool_ready"] is False
    finally:
        if hasattr(fastapi_app.state, "round_pool"):
            delattr(fastapi_app.state, "round_pool")


def test_health_when_ollama_down() -> None:
    with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=False)):
        r = client.get("/health")
    assert r.json()["ollama_reachable"] is False


def test_prompts_endpoint_returns_list() -> None:
    r = client.get("/prompts")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert {"id", "prompt"} <= set(body[0].keys())


@pytest.mark.parametrize("origin", ["http://localhost:5173"])
def test_cors_preflight(origin: str) -> None:
    r = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == origin
