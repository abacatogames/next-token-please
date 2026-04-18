import asyncio
import json
import random
from pathlib import Path

import pytest

from app.prompt_store import PromptStore, make_id
from app.prompts import Prompt

SEEDS = [
    Prompt("seed-one", "Why is the sky blue?"),
    Prompt("seed-two", "What is gravity?"),
]


async def _wait_for(predicate, *, timeout: float = 2.0, step: float = 0.02) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        if predicate():
            return True
        await asyncio.sleep(step)
    return predicate()


def test_make_id_is_slugged_and_unique() -> None:
    a = make_id("Why do cats stare at nothing?")
    b = make_id("Why do cats stare at nothing?")
    assert a != b
    assert a.startswith("gen-")
    assert "why-do-cats-stare" in a


def test_seed_prompts_are_available_via_get_and_all() -> None:
    store = PromptStore(seeds=SEEDS)
    assert len(store.all()) == 2
    assert store.get("seed-one") == SEEDS[0]
    assert store.get("missing") is None


def test_add_appends_and_assigns_ids() -> None:
    store = PromptStore(seeds=SEEDS)
    added = store.add(["How does a neural net learn?", "What makes rain fall?"])
    assert added == 2
    assert store.size == 4
    generated_ids = [p.id for p in store.all() if p.id not in {s.id for s in SEEDS}]
    assert all(g.startswith("gen-") for g in generated_ids)


def test_add_skips_duplicates_by_text() -> None:
    store = PromptStore(seeds=SEEDS)
    store.add(["What makes rain fall?"])
    again = store.add(["What makes rain fall?"])
    assert again == 0
    assert store.size == 3


def test_add_respects_max_size_fifo_eviction() -> None:
    store = PromptStore(seeds=SEEDS, max_size=3)
    store.add(["First generated prompt?", "Second generated prompt?",
               "Third generated prompt?", "Fourth generated prompt?"])
    assert store.generated_size == 3
    texts = [p.text for p in store.all()]
    assert "First generated prompt?" not in texts
    assert "Fourth generated prompt?" in texts


def test_seeds_survive_eviction() -> None:
    store = PromptStore(seeds=SEEDS, max_size=1)
    store.add(["One?", "Two?", "Three?"])
    ids = [p.id for p in store.all()]
    assert "seed-one" in ids
    assert "seed-two" in ids


def test_pick_uses_rng_for_deterministic_selection() -> None:
    store = PromptStore(seeds=SEEDS)
    a = store.pick(random.Random(0))
    b = store.pick(random.Random(0))
    assert a.id == b.id


def test_pick_falls_back_to_seeds_below_threshold() -> None:
    store = PromptStore(seeds=SEEDS, prefer_generated_at=5)
    store.add(["Generated only one?"])
    seed_ids = {s.id for s in SEEDS}
    rng = random.Random(0)
    saw_seed = any(store.pick(rng).id in seed_ids for _ in range(50))
    assert saw_seed


def test_pick_prefers_generated_once_threshold_reached() -> None:
    store = PromptStore(seeds=SEEDS, prefer_generated_at=2)
    store.add(["Generated A?", "Generated B?", "Generated C?"])
    seed_ids = {s.id for s in SEEDS}
    rng = random.Random(0)
    for _ in range(50):
        assert store.pick(rng).id not in seed_ids


def test_pick_raises_if_empty() -> None:
    store = PromptStore(seeds=[])
    with pytest.raises(RuntimeError):
        store.pick(random.Random(0))


def test_persist_and_reload_roundtrip(tmp_path: Path) -> None:
    cache = tmp_path / "cache.json"
    first = PromptStore(seeds=SEEDS, cache_path=cache)
    first.add(["Generated prompt A?", "Generated prompt B?"])
    assert cache.exists()

    second = PromptStore(seeds=SEEDS, cache_path=cache)
    texts = [p.text for p in second.all()]
    assert "Generated prompt A?" in texts
    assert "Generated prompt B?" in texts


def test_load_tolerates_corrupt_cache(tmp_path: Path) -> None:
    cache = tmp_path / "cache.json"
    cache.write_text("not json", encoding="utf-8")
    store = PromptStore(seeds=SEEDS, cache_path=cache)
    assert store.size == 2


def test_persisted_cache_drops_seed_duplicates(tmp_path: Path) -> None:
    cache = tmp_path / "cache.json"
    cache.write_text(
        json.dumps(
            {
                "version": 1,
                "prompts": [
                    {"id": "seed-one", "text": "dup"},
                    {"id": "gen-real-abc123", "text": "real generated?"},
                ],
            }
        ),
        encoding="utf-8",
    )
    store = PromptStore(seeds=SEEDS, cache_path=cache)
    ids = [p.id for p in store.all()]
    assert ids.count("seed-one") == 1
    assert "gen-real-abc123" in ids


@pytest.mark.asyncio
async def test_refill_loop_calls_batch_producer_and_adds(tmp_path: Path) -> None:
    calls = {"n": 0}

    async def producer(existing):
        calls["n"] += 1
        return [f"Generated prompt {calls['n']}?"], {}

    store = PromptStore(
        seeds=SEEDS, cache_path=tmp_path / "c.json", max_size=3,
        idle_sleep=0.02, error_sleep=0.02, batch_producer=producer,
    )
    store.start()
    try:
        assert await _wait_for(lambda: store.generated_size >= 1)
    finally:
        await store.stop()
    assert calls["n"] >= 1


@pytest.mark.asyncio
async def test_refill_loop_survives_producer_errors(tmp_path: Path) -> None:
    calls = {"n": 0}

    async def producer(existing):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("flaky")
        return ["Recovered prompt?"], {}

    store = PromptStore(
        seeds=SEEDS, cache_path=tmp_path / "c.json", max_size=2,
        idle_sleep=0.02, error_sleep=0.02, batch_producer=producer,
    )
    store.start()
    try:
        assert await _wait_for(lambda: store.generated_size >= 1, timeout=3.0)
        assert calls["n"] >= 2
    finally:
        await store.stop()


@pytest.mark.asyncio
async def test_refill_loop_idles_when_full(tmp_path: Path) -> None:
    async def producer(existing):
        return ["a?", "b?", "c?", "d?"], {}

    store = PromptStore(
        seeds=SEEDS, cache_path=tmp_path / "c.json", max_size=2,
        idle_sleep=0.02, error_sleep=0.02, batch_producer=producer,
    )
    store.start()
    try:
        assert await _wait_for(lambda: store.generated_size == store._max_size)
        await asyncio.sleep(0.1)
        assert store.generated_size == store._max_size
    finally:
        await store.stop()


@pytest.mark.asyncio
async def test_stop_cancels_refill() -> None:
    async def producer(existing):
        await asyncio.sleep(0.01)
        return ["prompt?"], {}

    store = PromptStore(
        seeds=SEEDS, max_size=10, idle_sleep=0.02,
        error_sleep=0.02, batch_producer=producer,
    )
    store.start()
    assert store.running
    await store.stop()
    assert not store.running


def test_start_is_noop_without_producer() -> None:
    store = PromptStore(seeds=SEEDS)
    store.start()
    assert not store.running
