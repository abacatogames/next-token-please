import asyncio
import contextlib
import json
import logging
import random
import re
import uuid
from collections.abc import Awaitable, Callable, Iterable
from pathlib import Path

from app.prompts import Prompt
from app.telemetry import log_warning_event

LOGGER = logging.getLogger("ntp.prompt_store")

GeneratedBatch = tuple[list[str], dict]
BatchProducer = Callable[[frozenset[str]], Awaitable[GeneratedBatch]]

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slug(text: str, max_len: int = 24) -> str:
    s = _SLUG_RE.sub("-", text.lower()).strip("-")
    return s[:max_len].rstrip("-") or "prompt"


def make_id(text: str) -> str:
    return f"gen-{_slug(text)}-{uuid.uuid4().hex[:6]}"


def _serialize(prompts: list[Prompt]) -> str:
    return json.dumps(
        {"version": 1, "prompts": [{"id": p.id, "text": p.text} for p in prompts]},
        indent=2,
    )


def _deserialize(data: str) -> list[Prompt]:
    parsed = json.loads(data)
    items = parsed.get("prompts", [])
    return [Prompt(id=item["id"], text=item["text"]) for item in items]


class PromptStore:
    def __init__(
        self,
        *,
        seeds: Iterable[Prompt],
        cache_path: Path | None = None,
        max_size: int = 100,
        refill_below: int = 30,
        idle_sleep: float = 2.0,
        error_sleep: float = 10.0,
        batch_producer: BatchProducer | None = None,
        prefer_generated_at: int = 0,
    ) -> None:
        self._seeds: list[Prompt] = list(seeds)
        self._seed_ids: frozenset[str] = frozenset(p.id for p in self._seeds)
        self._cache_path = cache_path
        self._max_size = max_size
        self._refill_below = refill_below
        self._idle_sleep = idle_sleep
        self._error_sleep = error_sleep
        self._prefer_generated_at = prefer_generated_at
        self._batch_producer = batch_producer
        self._generated: dict[str, Prompt] = {}
        self._generated_order: list[str] = []
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self._seed_map = {p.id: p for p in self._seeds}
        self._load_from_disk()

    @property
    def size(self) -> int:
        return len(self._seed_map) + len(self._generated)

    @property
    def generated_size(self) -> int:
        return len(self._generated)

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def all(self) -> list[Prompt]:
        return list(self._seed_map.values()) + list(self._generated.values())

    def get(self, prompt_id: str) -> Prompt | None:
        if prompt_id in self._seed_map:
            return self._seed_map[prompt_id]
        return self._generated.get(prompt_id)

    def pick(self, rng: random.Random) -> Prompt:
        if (
            self._prefer_generated_at > 0
            and len(self._generated) >= self._prefer_generated_at
        ):
            return rng.choice(list(self._generated.values()))
        pool = self.all()
        if not pool:
            raise RuntimeError("prompt store is empty")
        return rng.choice(pool)

    def _existing_texts(self) -> frozenset[str]:
        return frozenset(p.text for p in self.all())

    def add(self, texts: Iterable[str]) -> int:
        added = 0
        existing_texts = {p.text for p in self.all()}
        for text in texts:
            if not text or text in existing_texts:
                continue
            new_id = make_id(text)
            self._generated[new_id] = Prompt(id=new_id, text=text)
            self._generated_order.append(new_id)
            existing_texts.add(text)
            added += 1
            while len(self._generated) > self._max_size:
                oldest = self._generated_order.pop(0)
                self._generated.pop(oldest, None)
        if added > 0:
            self._persist()
        return added

    def _load_from_disk(self) -> None:
        if self._cache_path is None or not self._cache_path.exists():
            return
        try:
            data = self._cache_path.read_text(encoding="utf-8")
            prompts = _deserialize(data)
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            log_warning_event(LOGGER, "prompt_cache_load_failed", exc)
            return
        for p in prompts:
            if p.id in self._seed_ids or p.id in self._generated:
                continue
            self._generated[p.id] = p
            self._generated_order.append(p.id)
            if len(self._generated) >= self._max_size:
                break

    def _persist(self) -> None:
        if self._cache_path is None:
            return
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(
                _serialize(list(self._generated.values())), encoding="utf-8"
            )
        except OSError as exc:
            log_warning_event(LOGGER, "prompt_cache_write_failed", exc)

    def start(self) -> None:
        if self._batch_producer is None or self.running:
            return
        self._task = asyncio.create_task(self._refill_loop(), name="prompt-store-refill")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _refill_loop(self) -> None:
        assert self._batch_producer is not None
        try:
            while True:
                if self.generated_size >= self._max_size:
                    await asyncio.sleep(self._idle_sleep)
                    continue
                try:
                    texts, _meta = await self._batch_producer(self._existing_texts())
                    added = self.add(texts) if texts else 0
                    if added == 0:
                        await asyncio.sleep(self._idle_sleep)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    log_warning_event(LOGGER, "prompt_refill_failed", exc)
                    await asyncio.sleep(self._error_sleep)
        except asyncio.CancelledError:
            return
