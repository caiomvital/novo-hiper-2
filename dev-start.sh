#!/usr/bin/env bash
# Ambiente de teste isolado: backend (127.0.0.1:4317) + Vite (127.0.0.1:5173)
cd "$(dirname "$0")"
export NODE_ENV=development
export DATA_DIR="$PWD/data-dev"
export DATABASE_PATH="$PWD/data-dev/novo-hiper-dev.db"
export UPLOADS_DIR="$PWD/uploads-dev"
export AUTH_USERNAME=Bernardo
export CORS_ORIGIN=
export DEV_API_PORT=4317
export DEV_API_TARGET="http://127.0.0.1:$DEV_API_PORT"
mkdir -p "$DATA_DIR" "$UPLOADS_DIR/plants"
docker rm -f novo-hiper-dev-api >/dev/null 2>&1
# Backend precisa de Node 22 (node:sqlite); roda em container isolado (imagem local de Node 22),
# montando SOMENTE este diretório. Porta publicada apenas em 127.0.0.1.
docker run -d --name novo-hiper-dev-api --restart no \
  -p 127.0.0.1:$DEV_API_PORT:$DEV_API_PORT \
  -v "$PWD":/app -w /app \
  -e DEV_API_BIND=0.0.0.0 -e NODE_ENV=development -e DEV_API_PORT -e AUTH_USERNAME=Bernardo \
  -e AUTH_DEV_INSECURE_PASSWORD=dev-only-test-password-1 \
  -e DATA_DIR=/app/data-dev -e DATABASE_PATH=/app/data-dev/novo-hiper-dev.db -e UPLOADS_DIR=/app/uploads-dev \
  --entrypoint npx novo-hiper-novo-hiper tsx dev-backend.ts > data-dev/backend.cid
nohup npx vite --host 127.0.0.1 --port 5173 --strictPort > data-dev/vite.log 2>&1 &
echo $! > data-dev/vite.pid
