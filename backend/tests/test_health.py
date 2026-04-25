from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_model_and_ok() -> None:
    with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=True)):
        r = client.get("/api/health")
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
            tokens=[RevealToken(word="x", leading_space=False)],
            answer_latency_ms=1, answer_word_count=1,
        )
    )
    from app.main import app as fastapi_app

    fastapi_app.state.round_pool = pool
    try:
        with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=True)):
            body = client.get("/api/health").json()
        assert body["pool_size"] == 1
        assert body["pool_ready"] is False
    finally:
        if hasattr(fastapi_app.state, "round_pool"):
            delattr(fastapi_app.state, "round_pool")


def test_health_when_ollama_down() -> None:
    with patch("app.main.ollama_client.is_reachable", new=AsyncMock(return_value=False)):
        r = client.get("/api/health")
    assert r.json()["ollama_reachable"] is False


def test_prompts_endpoint_returns_list() -> None:
    r = client.get("/api/prompts")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert {"id", "prompt"} <= set(body[0].keys())
