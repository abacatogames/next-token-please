#!/bin/sh
set -eu

ollama serve &
SERVE_PID=$!

until ollama list >/dev/null 2>&1; do
  sleep 1
done

ollama pull "${OLLAMA_MODEL:-llama3.2:1b}"

wait "$SERVE_PID"
