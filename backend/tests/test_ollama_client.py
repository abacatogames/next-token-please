from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.generator import ollama_client


@pytest.mark.asyncio
async def test_is_reachable_returns_true_on_200() -> None:
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await ollama_client.is_reachable()

    assert result is True


@pytest.mark.asyncio
async def test_is_reachable_returns_false_on_non_200() -> None:
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await ollama_client.is_reachable()

    assert result is False


@pytest.mark.asyncio
async def test_is_reachable_returns_false_on_http_error() -> None:
    mock_client = AsyncMock()
    mock_client.get.side_effect = httpx.ConnectError("unreachable")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await ollama_client.is_reachable()

    assert result is False


@pytest.mark.asyncio
async def test_generate_returns_stripped_response() -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "  The sky is blue.  "}
    mock_response.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await ollama_client.generate(prompt="why?", system="answer")

    assert result == "The sky is blue."


@pytest.mark.asyncio
async def test_generate_sends_model_and_prompt_in_payload() -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "answer"}
    mock_response.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        await ollama_client.generate(prompt="why?", system="be brief")

    _url, kwargs = mock_client.post.call_args[0], mock_client.post.call_args[1]
    payload = kwargs.get("json") or mock_client.post.call_args[1].get("json")
    assert payload["prompt"] == "why?"
    assert payload["system"] == "be brief"
    assert payload["stream"] is False


@pytest.mark.asyncio
async def test_generate_returns_empty_string_when_response_key_missing() -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {}
    mock_response.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.generator.ollama_client.httpx.AsyncClient", return_value=mock_client):
        result = await ollama_client.generate(prompt="why?", system="answer")

    assert result == ""
