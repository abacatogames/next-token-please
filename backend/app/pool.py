import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable

from app.schemas import Round
from app.telemetry import RoundEvent, log_warning_event

PoolItem = tuple[Round, RoundEvent]
Builder = Callable[[float], Awaitable[PoolItem]]

LOGGER = logging.getLogger("ntp.pool")


class RoundPool:
    def __init__(
        self,
        *,
        size: int,
        builder: Builder,
        difficulties: list[float],
        idle_sleep: float = 0.5,
        error_sleep: float = 5.0,
        max_concurrent_builds: int = 1,
    ) -> None:
        self._size = size
        self._builder = builder
        self._difficulties = list(difficulties)
        self._queues = {d: asyncio.Queue(maxsize=size) for d in self._difficulties}
        self._tasks: dict[float, asyncio.Task[None]] = {}
        self._idle_sleep = idle_sleep
        self._error_sleep = error_sleep
        self._build_semaphore = asyncio.Semaphore(max_concurrent_builds)

    @property
    def difficulties(self) -> list[float]:
        return list(self._difficulties)

    @property
    def size(self) -> int:
        return sum(q.qsize() for q in self._queues.values())

    @property
    def ready(self) -> bool:
        return all(q.qsize() >= self._size for q in self._queues.values())

    @property
    def running(self) -> bool:
        return any(task is not None and not task.done() for task in self._tasks.values())

    def supports(self, difficulty: float) -> bool:
        return difficulty in self._queues

    def try_get(self, difficulty: float) -> PoolItem | None:
        queue = self._queues.get(difficulty)
        if queue is None:
            return None
        try:
            return queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def put_nowait(self, item: PoolItem, difficulty: float) -> None:
        self._queues[difficulty].put_nowait(item)

    def start(self) -> None:
        for difficulty in self._difficulties:
            if difficulty in self._tasks:
                continue
            self._tasks[difficulty] = asyncio.create_task(
                self._refill_loop(difficulty),
                name=f"round-pool-refill-{difficulty}",
            )

    async def stop(self) -> None:
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(
            *(self._suppress_cancel(task) for task in tasks),
            return_exceptions=True,
        )
        self._tasks.clear()

    @staticmethod
    async def _suppress_cancel(task: asyncio.Task[None]) -> None:
        with contextlib.suppress(asyncio.CancelledError):
            await task

    async def _refill_loop(self, difficulty: float) -> None:
        queue = self._queues[difficulty]
        try:
            while True:
                if queue.qsize() >= self._size:
                    await asyncio.sleep(self._idle_sleep)
                    continue
                try:
                    async with self._build_semaphore:
                        item = await self._builder(difficulty=difficulty)
                    await queue.put(item)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    log_warning_event(LOGGER, "pool_refill_failed", exc)
                    await asyncio.sleep(self._error_sleep)
        except asyncio.CancelledError:
            return
