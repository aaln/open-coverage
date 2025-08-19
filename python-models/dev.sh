#!/usr/bin/env bash
set -euo pipefail

# Simple dev helper for the Python utilization server
# - Creates a local venv under python-models/.venv if missing
# - Installs requirements
# - Runs FastAPI server with reload

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
PROJECT_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)
VENV_DIR="$SCRIPT_DIR/.venv"

PY=${PYTHON:-python3}

if [ ! -d "$VENV_DIR" ]; then
  echo "[py:dev] Creating virtualenv at $VENV_DIR"
  $PY -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "[py:dev] Upgrading pip/setuptools/wheel"
pip install --upgrade pip setuptools wheel >/dev/null

echo "[py:dev] Installing requirements"
pip install -r "$SCRIPT_DIR/requirements.txt"

HOST=${PY_HOST:-127.0.0.1}
PORT=${PY_PORT:-8001}

export PYTHONPATH="$PROJECT_ROOT"

echo "[py:dev] Starting server at http://$HOST:$PORT"
exec uvicorn python-models.server.server:app --host "$HOST" --port "$PORT" --reload


