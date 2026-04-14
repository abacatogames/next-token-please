from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.generator import ollama_client
from app.prompts import PROMPTS
from app.round import build_round
from app.schemas import Health, PromptSummary, Round

app = FastAPI(title="Next Token Please", version="0.1.0")

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
    try:
        return await build_round(prompt_id=prompt_id, difficulty=difficulty, seed=seed)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown prompt_id: {exc.args[0]}") from exc
