import logging
import random
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

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
        log_prompt_gen(
            PromptGenEvent(
                theme=cell.theme,
                tone=cell.tone,
                difficulty=cell.difficulty,
                requested=result.requested,
                accepted=result.accepted,
                rejected=result.rejected,
                retries=result.retries,
                latency_ms=latency_ms,
            )
        )
        return result.prompts, {}

    return producer


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    if settings.embeddings_enabled:
        embeddings.load(
            pool_size=settings.embeddings_pool_size,
            model_name=settings.embeddings_model,
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
        difficulties=sorted(set(settings.round_pool_difficulties) | {settings.default_difficulty}),
        idle_sleep=settings.round_pool_idle_sleep,
        error_sleep=settings.round_pool_error_sleep,
        max_concurrent_builds=settings.round_pool_max_concurrent_builds,
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

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_RATE_LIMIT = f"{settings.rate_limit_per_minute}/minute"

api = APIRouter(prefix="/api")


def _current_pool() -> RoundPool | None:
    return getattr(app.state, "round_pool", None)


def _is_pool_request(
    pool: RoundPool | None, difficulty: float, prompt_id: str | None, seed: int | None
) -> bool:
    if pool is None or prompt_id is not None or seed is not None:
        return False
    return pool.supports(difficulty)


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
@limiter.limit(_RATE_LIMIT)
async def list_prompts(request: Request) -> list[PromptSummary]:
    return [PromptSummary(id=p.id, prompt=p.text) for p in get_store().all()]


@api.get("/round", response_model=Round)
@limiter.limit(_RATE_LIMIT)
async def get_round(
    request: Request,
    difficulty: float | None = Query(default=None, ge=0.0, le=1.0),
    prompt_id: str | None = Query(default=None),
    seed: int | None = Query(default=None),
) -> Round:
    t0 = time.perf_counter()
    pool = _current_pool()
    diff = difficulty if difficulty is not None else settings.default_difficulty
    pool_hit = False
    try:
        item = None
        if _is_pool_request(pool, diff, prompt_id, seed):
            item = pool.try_get(diff)
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

    log_round(
        replace(
            event,
            pool_hit=pool_hit,
            total_latency_ms=int((time.perf_counter() - t0) * 1000),
        )
    )
    return round_obj


app.include_router(api)
