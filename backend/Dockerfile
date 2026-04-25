FROM python:3.11-slim

ARG INSTALL_EMBEDDINGS=false

WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY pyproject.toml ./
RUN if [ "$INSTALL_EMBEDDINGS" = "true" ]; then \
      pip install --no-cache-dir ".[embeddings]"; \
    else \
      pip install --no-cache-dir .; \
    fi

COPY app ./app
COPY scripts ./scripts
RUN if [ "$INSTALL_EMBEDDINGS" = "true" ]; then \
      python scripts/bootstrap.py; \
    else \
      python scripts/bootstrap.py --skip-embeddings; \
    fi

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
