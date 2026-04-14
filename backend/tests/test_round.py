from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.round import build_round

CANNED_ANSWER = (
    "The sky appears blue because of Rayleigh scattering. Short wavelengths of light "
    "collide with molecules of nitrogen and oxygen in the atmosphere and are scattered "
    "in all directions. Blue light dominates what reaches our eyes during the day, which "
    "is why the sky looks blue to observers on the ground below."
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def _mock_llm():
    with patch("app.round.generate_answer", new=AsyncMock(return_value=CANNED_ANSWER)):
        yield


def test_build_round_returns_valid_shape() -> None:
    import asyncio

    r = asyncio.run(build_round(prompt_id="sky-blue", difficulty=0.5, seed=1))
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


def test_opening_tokens_are_reveal() -> None:
    import asyncio
    r = asyncio.run(build_round(prompt_id="sky-blue", seed=1))
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
