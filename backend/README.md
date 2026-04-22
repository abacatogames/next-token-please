# next-token-please backend

FastAPI service that generates game rounds for the Next Token Please frontend.

## Requirements

- Python 3.11+
- Docker (for Ollama)

## First-time setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,embeddings]"
python scripts/bootstrap.py            # WordNet + tokenizers + GloVe-100 (~200 MB)
# or `python scripts/bootstrap.py --skip-embeddings` for a lighter setup
docker compose up -d ollama ollama-init
```

The `ollama-init` one-shot pulls `llama3.2:1b` (~1 GB) on first boot. Wait for it to finish before hitting `/round`.

## Develop

```bash
uvicorn app.main:app --reload --port 8000
```

Smoke test:

```bash
curl -s http://localhost:8000/api/health | jq
curl -s http://localhost:8000/api/prompts | jq
```

## Test / lint

```bash
pytest
ruff check
```

## Full Docker stack (frontend + backend + Ollama)

```bash
docker compose --profile full up --build
```

Frontend served at `http://localhost/`, API at `http://localhost/api/`.

## Environment

Copy `.env.example` to `.env` to customise. Keys: `OLLAMA_URL`, `OLLAMA_MODEL`, `DEFAULT_DIFFICULTY`, `CHOICE_TARGET`, `OPENING_REVEAL`, `LOG_LEVEL`, `ROUND_POOL_ENABLED`, `ROUND_POOL_SIZE`, `EMBEDDINGS_ENABLED`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_POOL_SIZE`, `EMBEDDINGS_TOP_K`.
