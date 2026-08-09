import asyncio

import pytest

from app.pool import RoundPool
from tests.conftest import make_pool_item


def _item(i: int):
    return make_pool_item(
        round_id=f"round-{i}",
        prompt="ping",
        prompt_id="ping",
        answer_latency_ms=10,
        answer_word_count=5,
    )


async def _wait_for(predicate, *, timeout: float = 2.0, step: float = 0.02) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        if predicate():
            return True
        await asyncio.sleep(step)
    return predicate()


@pytest.mark.asyncio
async def test_pool_fills_up_to_max_size() -> None:
    counter = {"n": 0}

    async def builder(difficulty: float):
        counter["n"] += 1
        return _item(counter["n"])

    pool = RoundPool(
        size=3,
        builder=builder,
        difficulties=[1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    pool.start()
    try:
        filled = await _wait_for(lambda: pool.ready)
        assert filled
        assert pool.size == 3
    finally:
        await pool.stop()


@pytest.mark.asyncio
async def test_pool_fills_each_difficulty_with_matching_builder() -> None:
    counter = {"n": 0}
    seen = []

    async def builder(difficulty: float):
        counter["n"] += 1
        seen.append(difficulty)
        return _item(counter["n"])

    pool = RoundPool(
        size=2,
        builder=builder,
        difficulties=[0.8, 1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    pool.start()
    try:
        assert await _wait_for(lambda: pool.ready, timeout=3.0)
        assert pool.size == 4
        assert sorted(seen) == [0.8, 0.8, 1.0, 1.0]
    finally:
        await pool.stop()


@pytest.mark.asyncio
async def test_try_get_returns_none_when_empty() -> None:
    async def builder(difficulty: float):
        await asyncio.sleep(10)
        return _item(0)

    pool = RoundPool(
        size=1,
        builder=builder,
        difficulties=[1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    assert pool.try_get(1.0) is None


@pytest.mark.asyncio
async def test_try_get_returns_none_for_unsupported_difficulty() -> None:
    async def builder(difficulty: float):
        await asyncio.sleep(10)
        return _item(0)

    pool = RoundPool(size=1, builder=builder, difficulties=[1.0])
    assert pool.try_get(0.5) is None


@pytest.mark.asyncio
async def test_pool_refills_after_get() -> None:
    counter = {"n": 0}

    async def builder(difficulty: float):
        counter["n"] += 1
        return _item(counter["n"])

    pool = RoundPool(
        size=2,
        builder=builder,
        difficulties=[1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    pool.start()
    try:
        assert await _wait_for(lambda: pool.ready)
        first = pool.try_get(1.0)
        assert first is not None
        assert pool.size == 1
        assert await _wait_for(lambda: pool.ready)
    finally:
        await pool.stop()


@pytest.mark.asyncio
async def test_pool_survives_builder_errors() -> None:
    calls = {"n": 0}

    async def builder(difficulty: float):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("flaky")
        return _item(calls["n"])

    pool = RoundPool(
        size=1,
        builder=builder,
        difficulties=[1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    pool.start()
    try:
        assert await _wait_for(lambda: pool.ready, timeout=3.0)
        assert calls["n"] >= 2
    finally:
        await pool.stop()


@pytest.mark.asyncio
async def test_stop_cancels_background_task() -> None:
    async def builder(difficulty: float):
        await asyncio.sleep(0.01)
        return _item(0)

    pool = RoundPool(
        size=1,
        builder=builder,
        difficulties=[1.0],
        idle_sleep=0.02,
        error_sleep=0.02,
    )
    pool.start()
    assert pool.running
    await pool.stop()
    assert not pool.running


@pytest.mark.asyncio
async def test_put_nowait_allows_test_preloading() -> None:
    async def builder(difficulty: float):
        await asyncio.sleep(10)
        return _item(0)

    pool = RoundPool(size=2, builder=builder, difficulties=[1.0])
    pool.put_nowait(_item(1), 1.0)
    pool.put_nowait(_item(2), 1.0)
    assert pool.size == 2
    a = pool.try_get(1.0)
    b = pool.try_get(1.0)
    assert a is not None and b is not None
    assert a[0].id != b[0].id


@pytest.mark.asyncio
async def test_try_get_returns_matching_difficulty() -> None:
    async def builder(difficulty: float):
        await asyncio.sleep(10)
        return _item(0)

    pool = RoundPool(size=2, builder=builder, difficulties=[0.8, 1.0])
    pool.put_nowait(_item(8), 0.8)
    pool.put_nowait(_item(10), 1.0)
    assert pool.try_get(0.8)[0].id == "round-8"
    assert pool.try_get(1.0)[0].id == "round-10"
