# DevOps CRM

A local sales workspace for managing contacts, tracking opportunities, and understanding a small sales pipeline. Built for Akshat Kushwaha's DevOps capstone.

Repository: https://github.com/AkshatKushwaha-exe/Devops-CRM

## What works

- Dashboard with contact count, open deals, pipeline value, won revenue, win rate, and value by stage.
- Contact creation, editing, deletion, company/name/email search, relationship filters, and pagination.
- Deals connected to contacts, exact decimal INR values, expected close dates, and notes.
- Five pipeline stages: New, Qualified, Proposal, Won, and Lost. Change stages from the cards.
- Activity history recorded together with each successful data change.
- Responsive navigation, keyboard-accessible dialogs, loading/empty/error states, and retry controls.
- Validation, case-insensitive unique email addresses, and protection against deleting contacts with linked deals.

This phase is a **local, single-user application**. The workspace name is a display label; authentication and multi-user permissions are not implemented. Servers bind to loopback. Cloud hosting, Docker packaging, CI/CD, Terraform, Kubernetes, and monitoring installations are reserved for the next phase.

## Stack

React + TypeScript + Vite · FastAPI · SQLAlchemy · Alembic · PostgreSQL · Pytest

PostgreSQL is the primary database. SQLite is also supported for a lightweight preview and isolated tests. Switching database URLs selects a different database; it does not transfer records. UI fonts and icons are bundled locally, with no runtime CDN dependency.

## Start locally

Prerequisites: Node.js 22.12+ (Node 24 recommended), pnpm 10, uv, and Python 3.12. `uv` can install Python 3.12 automatically. Dependency downloads need internet access on the first run.

From the project root:

```bash
bash scripts/dev.sh --seed
```

The launcher installs locked dependencies, starts a private local PostgreSQL process on `127.0.0.1:55433`, applies migrations, inserts fictional demo data into an empty database, and starts the API and UI. The local PostgreSQL helper downloads platform-specific PostgreSQL binaries through `embedded-postgres`; no Docker or system database service is required. macOS arm64/x64 and Linux arm64/x64 are the intended environments for this Bash launcher.

- Application: **http://127.0.0.1:3000**
- API reference: **http://127.0.0.1:8000/docs**
- Health: http://127.0.0.1:8000/health
- Readiness: http://127.0.0.1:8000/ready
- Application metrics: http://127.0.0.1:8000/metrics

Press **Ctrl+C** to stop all three processes. Data persists under `.local/postgres/`. Logs are in `.local/`. Omit `--seed` to start with your current data or an empty workspace. Seeding never overwrites existing records.

For a preview without PostgreSQL:

```bash
bash scripts/dev.sh --sqlite --seed
```

This stores data in `.local/crm.db`. A restricted agent sandbox may block both PostgreSQL shared memory and localhost listeners; run the launcher from your normal terminal in that case.

### Use an existing PostgreSQL installation

Create an empty local database and user with permission to manage its schema. Then use separate terminals:

```bash
cd backend
uv sync --frozen --python 3.12
cp .env.example .env
# Edit DATABASE_URL in .env for your local database.
uv run alembic upgrade head
uv run python -m app.seed   # optional, fictional sample data
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Vite proxies `/api` to the backend on port 8000. The browser uses same-origin requests. You can set `API_PROXY_TARGET` when launching Vite if the API uses a different port.

## Validation

Backend tests use a new temporary SQLite database **with real Alembic migrations for every test**. They never touch the development database.

```bash
cd backend
uv run pytest -v
uv run ruff check app alembic tests
uv run ruff format --check app alembic tests
```

```bash
cd frontend
pnpm test
pnpm build
pnpm format:check
```

The frontend component tests cover forms, API error handling, linked-contact deletion protection, stage changes, empty states, and retries. They use mocked HTTP responses. Browser tests run the real UI against the real API with a disposable database on ports 3011/8011:

```bash
cd frontend
pnpm exec playwright install chromium
pnpm test:e2e
```

Capture desktop and mobile screenshots of any running instance (local, Compose, Kubernetes, or AWS):

```bash
cd frontend
node scripts/capture-screenshots.mjs http://127.0.0.1:3000 ../docs/evidence/<name>
```

See the [validation record](docs/VALIDATION.md) for every check that was executed, including the PostgreSQL runtime verification, restart persistence, and screenshots.

## Data rules

- Each contact has a unique email, normalized to lowercase.
- A deal must reference an existing contact. Reassign or delete deals before deleting their contact.
- Values use `NUMERIC(12,2)`, accept at most two decimal places, and cannot be negative. Currency is INR throughout this version.
- Pipeline value and active-deal counts exclude Won and Lost. Won revenue is the sum of Won deals. These are all-time totals, not monthly totals.
- Win rate is won deals divided by all closed deals (Won + Lost); it is zero if no deals are closed.
- “On the horizon” lists the earliest expected close dates for open deals, including overdue deals.
- Activity is written in the same transaction as the change. Failed operations do not create activity entries.
- Demo data is fictional and explicitly opt-in; the application never seeds automatically on startup.

## Project layout

```text
backend/app/             API routes, models, validation, metrics, demo seed
backend/alembic/         Versioned schema migration
backend/tests/           API, business-rule, and migration tests
frontend/src/            React screens, components, styling, component tests
frontend/e2e/            Browser workflows
frontend/scripts/        Evidence screenshot capture
scripts/                 Local launch and database helper, browser-test server
docs/                    Architecture, API map, validation record, evidence screenshots
```
