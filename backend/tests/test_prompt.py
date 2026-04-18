import random
from unittest.mock import AsyncMock, patch

import pytest

from app.generator import prompt as prompt_gen

GOOD_BATCH = (
    "Why do stars twinkle at night?\n"
    "How does lightning form in storm clouds?\n"
    "What makes glass transparent to visible light?\n"
    "Why does water expand when frozen?\n"
    "How do bees find their way back to the hive?\n"
)

BATCH_WITH_NOISE = (
    "Sure! Here are five prompts:\n"
    "1. Why do stars twinkle at night?\n"
    "- How does lightning form in storm clouds?\n"
    "* What makes glass transparent to visible light?\n"
    "\"Why does water expand when frozen?\"\n"
    "How do bees find their way back to the hive?\n"
)

BAD_PREAMBLE = (
    "Sure, here is one about stars.\n"
    "Why do stars twinkle at night?\n"
)

ALL_BAD = (
    "Sure, here are prompts.\n"
    "Short?\n"
    "i'll explain.\n"
)


def _mock_generate(*responses: str):
    queue = list(responses)

    async def _fn(*_a, **_k):
        return queue.pop(0) if queue else responses[-1]

    return AsyncMock(side_effect=_fn)


def test_sample_cell_is_deterministic_under_seed() -> None:
    a = prompt_gen.sample_cell(random.Random(42))
    b = prompt_gen.sample_cell(random.Random(42))
    assert a == b
    assert a.theme in prompt_gen.THEMES
    assert a.tone in prompt_gen.TONES
    assert a.difficulty in prompt_gen.DIFFICULTIES


def test_build_user_prompt_includes_taxonomy_descriptions() -> None:
    cell = prompt_gen.Cell(theme="science", tone="playful", difficulty="easy")
    out = prompt_gen.build_user_prompt(cell, count=5)
    assert prompt_gen.THEMES["science"] in out
    assert prompt_gen.TONES["playful"] in out
    assert prompt_gen.DIFFICULTIES["easy"] in out
    assert "5" in out


def test_parse_batch_strips_bullets_numbers_and_quotes() -> None:
    out = prompt_gen.parse_batch(BATCH_WITH_NOISE)
    assert "Why do stars twinkle at night?" in out
    assert "How does lightning form in storm clouds?" in out
    assert any(p.startswith("What makes glass") for p in out)
    assert any(p.startswith("Why does water expand") for p in out)


def test_parse_batch_skips_blank_lines() -> None:
    assert prompt_gen.parse_batch("a\n\n\nb\n") == ["a", "b"]


def test_validate_rejects_preamble_short_long_missing_punctuation() -> None:
    et: list = []
    assert not prompt_gen.validate("Sure, why do stars twinkle at night?", existing_tokens=et)
    assert not prompt_gen.validate("Too short?", existing_tokens=et)
    long_words = " ".join(["word"] * 30) + "?"
    assert not prompt_gen.validate(long_words, existing_tokens=et)
    assert not prompt_gen.validate("Why do stars twinkle at night", existing_tokens=et)


def test_validate_accepts_good_prompt() -> None:
    assert prompt_gen.validate("Why do stars twinkle at night?", existing_tokens=[])


def test_validate_rejects_lowercase_fragment() -> None:
    assert not prompt_gen.validate("of our perception of time?", existing_tokens=[])


def test_validate_rejects_bare_declarative_statement() -> None:
    assert not prompt_gen.validate(
        "Mainframe data streams flow through fiber optic cables.",
        existing_tokens=[],
    )


def test_validate_accepts_imperative_starter() -> None:
    assert prompt_gen.validate(
        "Describe how mainframe data streams travel through fiber.",
        existing_tokens=[],
    )


def test_validate_accepts_question_auxiliary_starter() -> None:
    assert prompt_gen.validate(
        "Can a mainframe outlive the engineers who built it?",
        existing_tokens=[],
    )


def test_validate_rejects_all_uppercase() -> None:
    assert not prompt_gen.validate(
        "WHY DO STARS TWINKLE AT NIGHT?", existing_tokens=[]
    )


def test_validate_rejects_multiple_terminal_punctuation() -> None:
    assert not prompt_gen.validate(
        "Why do stars twinkle at night??", existing_tokens=[]
    )
    assert not prompt_gen.validate(
        "Describe how lightning forms in storm clouds...", existing_tokens=[]
    )
    assert not prompt_gen.validate(
        "Describe how lightning forms in storm clouds..", existing_tokens=[]
    )
    assert not prompt_gen.validate(
        "Why do stars twinkle at night?!", existing_tokens=[]
    )


def test_validate_rejects_near_duplicates() -> None:
    existing = [prompt_gen._tokens("Why do stars twinkle at night?")]
    assert not prompt_gen.validate(
        "Why do stars twinkle at the night?", existing_tokens=existing
    )


def test_validate_rejects_dangling_one() -> None:
    assert not prompt_gen.validate(
        "When might a peaceful American Civil War have occurred instead of one?",
        existing_tokens=[],
    )


def test_validate_rejects_unresolved_their() -> None:
    assert not prompt_gen.validate(
        "Could their existence change our perceptions of personal identity and responsibility?",
        existing_tokens=[],
    )


def test_validate_rejects_bare_it_without_antecedent() -> None:
    assert not prompt_gen.validate(
        "Why does it keep happening every morning?",
        existing_tokens=[],
    )


def test_validate_accepts_pronoun_with_antecedent() -> None:
    assert prompt_gen.validate(
        "Can a mainframe outlive the engineers who built it?",
        existing_tokens=[],
    )


def test_validate_allows_distinct_prompts() -> None:
    existing = [prompt_gen._tokens("Why do stars twinkle at night?")]
    assert prompt_gen.validate(
        "How does a black hole bend light around itself?", existing_tokens=existing
    )


@pytest.mark.asyncio
async def test_generate_batch_accepts_clean_response() -> None:
    cell = prompt_gen.Cell(theme="science", tone="factual", difficulty="easy")
    with patch(
        "app.generator.prompt.ollama_client.generate", _mock_generate(GOOD_BATCH)
    ) as m:
        result = await prompt_gen.generate_batch(cell, count=5)
    assert result.accepted == 5
    assert result.rejected == 0
    assert result.retries == 0
    assert m.await_count == 1


@pytest.mark.asyncio
async def test_generate_batch_filters_noise_and_preamble_lines() -> None:
    cell = prompt_gen.Cell(theme="science", tone="factual", difficulty="easy")
    with patch(
        "app.generator.prompt.ollama_client.generate", _mock_generate(BATCH_WITH_NOISE)
    ):
        result = await prompt_gen.generate_batch(cell, count=5)
    for p in result.prompts:
        assert not p.lower().startswith("sure")
        assert p.endswith((".", "?", "!"))


@pytest.mark.asyncio
async def test_generate_batch_retries_on_empty_yield() -> None:
    cell = prompt_gen.Cell(theme="science", tone="factual", difficulty="easy")
    with patch(
        "app.generator.prompt.ollama_client.generate",
        _mock_generate(BAD_PREAMBLE, GOOD_BATCH),
    ) as m:
        result = await prompt_gen.generate_batch(cell, count=5)
    assert m.await_count == 2
    assert result.retries == 1
    assert result.accepted >= 1


@pytest.mark.asyncio
async def test_generate_batch_respects_existing_texts_for_dedup() -> None:
    cell = prompt_gen.Cell(theme="science", tone="factual", difficulty="easy")
    existing = frozenset({"Why do stars twinkle at night?"})
    with patch(
        "app.generator.prompt.ollama_client.generate", _mock_generate(GOOD_BATCH)
    ):
        result = await prompt_gen.generate_batch(cell, count=5, existing_texts=existing)
    assert "Why do stars twinkle at night?" not in result.prompts
    assert result.accepted == 4


@pytest.mark.asyncio
async def test_generate_batch_returns_empty_if_all_invalid() -> None:
    cell = prompt_gen.Cell(theme="science", tone="factual", difficulty="easy")
    with patch(
        "app.generator.prompt.ollama_client.generate",
        _mock_generate(ALL_BAD, ALL_BAD),
    ):
        result = await prompt_gen.generate_batch(cell, count=5)
    assert result.accepted == 0
    assert result.rejected > 0
