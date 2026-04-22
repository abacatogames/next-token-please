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
cd .. && docker compose up -d ollama
```

The `ollama` image pulls `llama3.2:1b` (~1 GB) at build time. Wait for the healthcheck to pass before hitting `/api/round`.

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

Run from repo root:

```bash
docker compose up --build
```

Frontend container exposes `:80` (no host port by default so Coolify/Traefik can front it in prod). For local smoke testing, publish it with `docker compose run --service-ports frontend` or add a temporary `ports: ["8080:80"]` override.

On Coolify, deploy this repo as a Docker Compose resource; Coolify detects the frontend's exposed `:80` and routes a domain to it via its built-in Traefik proxy. Configure env vars (e.g. `OLLAMA_MODEL`) through the Coolify UI.

## Environment

Copy `.env.example` to `.env` to customise. Keys: `OLLAMA_URL`, `OLLAMA_MODEL`, `DEFAULT_DIFFICULTY`, `CHOICE_TARGET`, `OPENING_REVEAL`, `LOG_LEVEL`, `ROUND_POOL_ENABLED`, `ROUND_POOL_SIZE`, `EMBEDDINGS_ENABLED`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_POOL_SIZE`, `EMBEDDINGS_TOP_K`.
