import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app, limiter

client = TestClient(app)


@pytest.fixture
def enabled_limiter():
    limiter._storage.reset()
    previous = limiter.enabled
    limiter.enabled = True
    try:
        yield
    finally:
        limiter.enabled = previous
        limiter._storage.reset()


def test_prompts_rate_limit_returns_429_after_threshold(enabled_limiter) -> None:
    threshold = settings.rate_limit_per_minute
    statuses = [client.get("/api/prompts").status_code for _ in range(threshold + 1)]
    assert statuses[:threshold] == [200] * threshold
    assert statuses[threshold] == 429


def test_health_endpoint_is_not_rate_limited(enabled_limiter) -> None:
    threshold = settings.rate_limit_per_minute
    statuses = [client.get("/api/health").status_code for _ in range(threshold + 5)]
    assert all(s == 200 for s in statuses)
