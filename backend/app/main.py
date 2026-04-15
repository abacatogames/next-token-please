import logging
import time
from contextlib import asynccontextmanager
from dataclasses import replace

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.generator import embeddings, ollama_client
from app.pool import RoundPool
from app.prompts import PROMPTS
from app.round import build_round
from app.schemas import Health, PromptSummary, Round
from app.telemetry import ErrorEvent, configure_logging, log_error, log_round

LOGGER = logging.getLogger("ntp.main")


async def _pool_builder():
    return await build_round()


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
    pool = RoundPool(
        size=settings.round_pool_size,
        builder=_pool_builder,
        idle_sleep=settings.round_pool_idle_sleep,
        error_sleep=settings.round_pool_error_sleep,
    )
    if settings.round_pool_enabled and settings.round_pool_size > 0:
        pool.start()
    app.state.round_pool = pool
    try:
        yield
    finally:
        await pool.stop()


app = FastAPI(title="Next Token Please", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _current_pool() -> RoundPool | None:
    return getattr(app.state, "round_pool", None)


def _is_pool_request(difficulty: float | None, prompt_id: str | None, seed: int | None) -> bool:
    if prompt_id is not None or seed is not None:
        return False
    return not (difficulty is not None and difficulty != settings.default_difficulty)


@app.get("/health", response_model=Health)
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


@app.get("/prompts", response_model=list[PromptSummary])
async def list_prompts() -> list[PromptSummary]:
    return [PromptSummary(id=p.id, prompt=p.text) for p in PROMPTS]


@app.get("/round", response_model=Round)
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
