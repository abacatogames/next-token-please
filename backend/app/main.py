from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.generator import ollama_client
from app.prompts import PROMPTS
from app.schemas import Health, PromptSummary

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


@app.get("/round")
async def get_round() -> dict:
    raise HTTPException(status_code=501, detail="Round generation lands in Phase E.")
