import logging
import random
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query

from app.config import settings
from app.generator import embeddings, ollama_client
from app.generator import prompt as prompt_gen
from app.pool import RoundPool
from app.prompt_store import PromptStore
from app.prompts import SEED_PROMPTS
from app.round import build_round
from app.schemas import Health, PromptSummary, Round
from app.store import get_store, reset_store, set_store
from app.telemetry import (
    ErrorEvent,
    PromptGenEvent,
    configure_logging,
    log_error,
    log_prompt_gen,
    log_round,
)

LOGGER = logging.getLogger("ntp.main")


def _build_batch_producer():
    rng = random.Random()

    async def producer(existing_texts: frozenset[str]) -> tuple[list[str], dict]:
        cell = prompt_gen.sample_cell(rng)
        t0 = time.perf_counter()
        result = await prompt_gen.generate_batch(
            cell,
            count=settings.prompt_generation_batch_size,
            existing_texts=existing_texts,
            temperature=settings.prompt_generation_temperature,
            top_p=settings.prompt_generation_top_p,
            min_words=settings.prompt_min_words,
            max_words=settings.prompt_max_words,
        )
        latency_ms = int((time.perf_counter() - t0) * 1000)
        log_prompt_gen(PromptGenEvent(
            theme=cell.theme, tone=cell.tone, difficulty=cell.difficulty,
            requested=result.requested, accepted=result.accepted,
            rejected=result.rejected, retries=result.retries,
            latency_ms=latency_ms,
        ))
        return result.prompts, {}

    return producer


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    if settings.embeddings_enabled:
        try:
            embeddings.load(
                pool_size=settings.embeddings_pool_size,
                model_name=settings.embeddings_model,
            )
        except Exception as exc:
            LOGGER.warning(
                "embeddings_load_failed",
                extra={"event": {"error": type(exc).__name__, "message": str(exc)}},
            )

    producer = _build_batch_producer() if settings.prompt_generation_enabled else None
    store = PromptStore(
        seeds=SEED_PROMPTS,
        cache_path=Path(settings.prompt_store_cache_path),
        max_size=settings.prompt_store_size,
        idle_sleep=settings.prompt_store_idle_sleep,
        error_sleep=settings.prompt_store_error_sleep,
        batch_producer=producer,
        prefer_generated_at=settings.prompt_store_prefer_generated_at,
    )
    set_store(store)
    if producer is not None:
        store.start()

    pool = RoundPool(
        size=settings.round_pool_size,
        builder=build_round,
        idle_sleep=settings.round_pool_idle_sleep,
        error_sleep=settings.round_pool_error_sleep,
    )
    if settings.round_pool_enabled and settings.round_pool_size > 0:
        pool.start()
    app.state.round_pool = pool
    app.state.prompt_store = store
    try:
        yield
    finally:
        await pool.stop()
        await store.stop()
        reset_store()


app = FastAPI(title="Next Token Please", version="0.1.0", lifespan=lifespan)
api = APIRouter(prefix="/api")


def _current_pool() -> RoundPool | None:
    return getattr(app.state, "round_pool", None)


def _is_pool_request(difficulty: float | None, prompt_id: str | None, seed: int | None) -> bool:
    if prompt_id is not None or seed is not None:
        return False
    return difficulty is None or difficulty == settings.default_difficulty


@api.get("/health", response_model=Health)
async def health() -> Health:
    reachable = await ollama_client.is_reachable()
    pool = _current_pool()
    return Health(
        ok=True,
        model=settings.ollama_model,
        ollama_reachable=reachable,
        pool_size=pool.size if pool else 0,
        pool_ready=pool.ready if pool else False,
    )


@api.get("/prompts", response_model=list[PromptSummary])
async def list_prompts() -> list[PromptSummary]:
    return [PromptSummary(id=p.id, prompt=p.text) for p in get_store().all()]


@api.get("/round", response_model=Round)
async def get_round(
    difficulty: float | None = Query(default=None, ge=0.0, le=1.0),
    prompt_id: str | None = Query(default=None),
    seed: int | None = Query(default=None),
) -> Round:
    t0 = time.perf_counter()
    pool = _current_pool()
    pool_hit = False
    try:
        item = None
        if pool is not None and _is_pool_request(difficulty, prompt_id, seed):
            item = pool.try_get()
        if item is not None:
            round_obj, event = item
            pool_hit = True
        else:
            round_obj, event = await build_round(
                prompt_id=prompt_id, difficulty=difficulty, seed=seed
            )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown prompt_id: {exc.args[0]}") from exc
    except Exception as exc:
        log_error(
            ErrorEvent(
                round_id="unassigned",
                prompt_id=prompt_id,
                error_type=type(exc).__name__,
                message=str(exc),
                stage="build_round",
                total_latency_ms=int((time.perf_counter() - t0) * 1000),
            ),
            exc,
        )
        raise

    log_round(replace(
        event,
        pool_hit=pool_hit,
        total_latency_ms=int((time.perf_counter() - t0) * 1000),
    ))
    return round_obj


app.include_router(api)
