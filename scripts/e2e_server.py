"""Start a disposable SQLite-backed API for browser tests; never use the user's database."""

import os
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

backend = Path(__file__).resolve().parents[1] / "backend"
os.chdir(backend)
sys.path.insert(0, str(backend))

with TemporaryDirectory(prefix="crm-browser-tests-") as directory:
    os.environ["DATABASE_URL"] = f"sqlite:///{Path(directory) / 'e2e.db'}"
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8011)
