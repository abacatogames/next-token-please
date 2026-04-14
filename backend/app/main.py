import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.generator import ollama_client
from app.prompts import PROMPTS
from app.round import build_round
from app.schemas import Health, PromptSummary, Round
from app.telemetry import ErrorEvent, RoundEvent, configure_logging, log_error, log_round


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging(settings.log_level)
    yield


app = FastAPI(title="Next Token Please", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health", response_model=Health)
async def health() -> Health:
    reachable = await ollama_client.is_reachable()
    return Health(ok=True, model=settings.ollama_model, ollama_reachable=reachable)


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
    try:
        round_obj, metrics = await build_round(
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
        RoundEvent(
            round_id=round_obj.id,
            prompt_id=metrics.prompt_id,
            difficulty=metrics.difficulty,
            seed=metrics.seed,
            pool_hit=False,
            answer_latency_ms=metrics.answer_latency_ms,
            answer_retries=metrics.answer_retries,
            answer_word_count=metrics.answer_word_count,
            choice_count=metrics.choice_count,
            distractor_sources=metrics.distractor_sources,
            total_latency_ms=int((time.perf_counter() - t0) * 1000),
        )
    )
    return round_obj
