#!/usr/bin/env bash
# Run from any directory. All data stays inside this project.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
database_mode="postgres"
seed_data=false
for option in "$@"; do
  case "$option" in
    --sqlite) database_mode="sqlite" ;;
    --seed) seed_data=true ;;
    *) echo "Usage: bash scripts/dev.sh [--sqlite] [--seed]" >&2; exit 1 ;;
  esac
done
for program in uv pnpm node; do
  command -v "$program" >/dev/null || { echo "Install $program first; see README.md." >&2; exit 1; }
done
mkdir -p .local
(cd backend && uv sync --frozen --python 3.12)
(cd frontend && pnpm install --frozen-lockfile)
processes=()
cleanup() {
  trap - EXIT INT TERM
  for pid in "${processes[@]:-}"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  done
  wait || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ "$database_mode" == "sqlite" ]]; then
  export DATABASE_URL="sqlite:///$project_root/.local/crm.db"
else
  (cd scripts && pnpm install --frozen-lockfile)
  node scripts/local-db.mjs >.local/postgres.log 2>&1 &
  processes+=("$!")
  export DATABASE_URL="postgresql+psycopg://crm:crm_local_only@127.0.0.1:${CRM_DB_PORT:-55433}/crm"
  backend/.venv/bin/python - <<'PY'
import os
import time
import psycopg
for attempt in range(60):
    try:
        with psycopg.connect(os.environ["DATABASE_URL"].replace("postgresql+psycopg", "postgresql"), connect_timeout=1):
            break
    except psycopg.OperationalError:
        time.sleep(0.5)
else:
    raise SystemExit("PostgreSQL did not start. See .local/postgres.log, or use --sqlite for a preview.")
PY
fi
(cd backend && .venv/bin/alembic upgrade head)
if [[ "$seed_data" == "true" ]]; then
  (cd backend && .venv/bin/python -m app.seed)
fi
# exec keeps the saved PIDs attached to the actual servers for clean Ctrl+C handling.
(cd backend && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) >.local/backend.log 2>&1 &
processes+=("$!")
(cd frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort) >.local/frontend.log 2>&1 &
processes+=("$!")
backend/.venv/bin/python - <<'PY'
import time
from urllib.error import URLError
from urllib.request import urlopen
for url in ("http://127.0.0.1:8000/ready", "http://127.0.0.1:3000"):
    for attempt in range(40):
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    break
        except (URLError, TimeoutError):
            time.sleep(0.25)
    else:
        raise SystemExit(f"Server not ready: {url}. Check .local/backend.log and .local/frontend.log.")
PY
echo "CRM: http://127.0.0.1:3000"
echo "API docs: http://127.0.0.1:8000/docs"
echo "Database mode: $database_mode. Press Ctrl+C to stop. Data is preserved in .local/."
while true; do
  for pid in "${processes[@]}"; do
    kill -0 "$pid" 2>/dev/null || { echo "A local service stopped. Check .local/*.log." >&2; exit 1; }
  done
  sleep 2
done
