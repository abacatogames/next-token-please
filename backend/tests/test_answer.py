from unittest.mock import AsyncMock, patch

import pytest

from app.generator import answer

GOOD = (
    "The sky appears blue because of Rayleigh scattering. Short wavelengths of light "
    "collide with molecules of nitrogen and oxygen in the atmosphere and are "
    "scattered in all directions. Blue light dominates what reaches our eyes "
    "during the day, which is why the sky looks blue to us."
)

SHORT = "The sky is blue because of light."

PREAMBLE = (
    "Sure! The sky appears blue because of Rayleigh scattering. Short wavelengths "
    "of light collide with molecules of nitrogen and oxygen in the atmosphere and "
    "are scattered in all directions, giving the sky its blue color to our eyes."
)

TOO_LONG = " ".join([GOOD] * 3)


def _mock_generate(*responses: str):
    queue = list(responses)

    async def _fn(*_a, **_k):
        return queue.pop(0) if queue else queue and queue[0] or responses[-1]

    return AsyncMock(side_effect=_fn)


@pytest.mark.asyncio
async def test_passes_on_first_attempt() -> None:
    with patch("app.generator.answer.ollama_client.generate", _mock_generate(GOOD)) as m:
        out = await answer.generate_answer("why is the sky blue?")
    assert out.endswith(".")
    assert 30 <= len(out.split()) <= 80
    assert m.await_count == 1


@pytest.mark.asyncio
async def test_retries_on_preamble_then_accepts() -> None:
    with patch("app.generator.answer.ollama_client.generate",
               _mock_generate(PREAMBLE, GOOD)) as m:
        out = await answer.generate_answer("why is the sky blue?")
    assert not out.lower().startswith("sure")
    assert m.await_count == 2


@pytest.mark.asyncio
async def test_retries_on_short_answer() -> None:
    with patch("app.generator.answer.ollama_client.generate",
               _mock_generate(SHORT, SHORT, GOOD)) as m:
        out = await answer.generate_answer("why is the sky blue?")
    assert len(out.split()) >= 30
    assert m.await_count == 3


@pytest.mark.asyncio
async def test_truncates_overlong_to_sentence_boundary() -> None:
    with patch("app.generator.answer.ollama_client.generate",
               _mock_generate(TOO_LONG)) as m:
        out = await answer.generate_answer("why is the sky blue?")
    assert len(out.split()) <= 80
    assert out.endswith((".", "!", "?"))
    assert m.await_count == 1


@pytest.mark.asyncio
async def test_returns_best_effort_after_max_retries() -> None:
    with patch("app.generator.answer.ollama_client.generate",
               _mock_generate(SHORT, SHORT, SHORT)) as m:
        out = await answer.generate_answer("why is the sky blue?")
    assert out
    assert m.await_count == answer.RETRIES


@pytest.mark.asyncio
async def test_strips_surrounding_quotes() -> None:
    wrapped = f'"{GOOD}"'
    with patch("app.generator.answer.ollama_client.generate",
               _mock_generate(wrapped)):
        out = await answer.generate_answer("why is the sky blue?")
    assert not out.startswith('"')
    assert not out.endswith('"')


def test_has_preamble_detection() -> None:
    assert answer._has_preamble("Sure, the sky is blue because...")
    assert answer._has_preamble("Here is why the sky is blue.")
    assert answer._has_preamble("I'll explain why the sky is blue.")
    assert not answer._has_preamble("Rayleigh scattering explains it.")
    assert not answer._has_preamble("The sky is blue because...")


def test_truncate_to_sentence_keeps_whole_sentences() -> None:
    text = "One. Two. " + " ".join(["word"] * 200) + "."
    out = answer._truncate_to_sentence(text)
    assert out.endswith(".")
    assert len(out.split()) <= answer.MAX_WORDS + 10


def test_strip_wrappers_handles_curly_quotes() -> None:
    assert answer._strip_wrappers("\u201cHello\u201d") == "Hello"


def test_strip_wrappers_handles_single_quotes() -> None:
    assert answer._strip_wrappers("'Hello'") == "Hello"


def test_strip_wrappers_leaves_unmatched_alone() -> None:
    assert answer._strip_wrappers('"Hello') == '"Hello'
    assert answer._strip_wrappers("Hello") == "Hello"


def test_passes_rejects_missing_terminal_punctuation() -> None:
    no_period = " ".join(["word"] * 35)
    assert not answer._passes(no_period)


def test_passes_accepts_exclamation_and_question() -> None:
    text = " ".join(["word"] * 35)
    assert answer._passes(text + "!")
    assert answer._passes(text + "?")


def test_passes_rejects_short_text() -> None:
    assert not answer._passes("Too short.")


def test_passes_rejects_preamble() -> None:
    text = "Sure, " + " ".join(["word"] * 35) + "."
    assert not answer._passes(text)
