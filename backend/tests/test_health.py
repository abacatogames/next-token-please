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
