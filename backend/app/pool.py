import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable

from app.schemas import Round
from app.telemetry import RoundEvent, log_warning_event

PoolItem = tuple[Round, RoundEvent]
Builder = Callable[[], Awaitable[PoolItem]]

LOGGER = logging.getLogger("ntp.pool")


class RoundPool:
    def __init__(
        self,
        *,
        size: int,
        builder: Builder,
        idle_sleep: float = 0.5,
        error_sleep: float = 5.0,
    ) -> None:
        self._size = size
        self._builder = builder
        self._idle_sleep = idle_sleep
        self._error_sleep = error_sleep
        self._queue: asyncio.Queue[PoolItem] = asyncio.Queue(maxsize=size)
        self._task: asyncio.Task[None] | None = None

    @property
    def size(self) -> int:
        return self._queue.qsize()

    @property
    def ready(self) -> bool:
        return self._queue.qsize() >= self._size

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def try_get(self) -> PoolItem | None:
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def put_nowait(self, item: PoolItem) -> None:
        self._queue.put_nowait(item)

    def start(self) -> None:
        if self.running:
            return
        self._task = asyncio.create_task(self._refill_loop(), name="round-pool-refill")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _refill_loop(self) -> None:
        try:
            while True:
                if self._queue.qsize() >= self._size:
                    await asyncio.sleep(self._idle_sleep)
                    continue
                try:
                    item = await self._builder()
                    await self._queue.put(item)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    log_warning_event(LOGGER, "pool_refill_failed", exc)
                    await asyncio.sleep(self._error_sleep)
        except asyncio.CancelledError:
            return
