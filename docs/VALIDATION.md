# Validation record

Each phase records what was executed, where, and the observed result. Evidence screenshots live under [`docs/evidence/`](evidence/).

## Phase 1 — Local application against PostgreSQL

Validated on 16 October 2026 on macOS (Apple silicon) with Python 3.12, Node 24, and PostgreSQL 18.4 started by `scripts/dev.sh` (embedded-postgres).

### Automated checks

| Check | Command | Result |
|---|---|---|
| Backend tests | `uv run pytest` | 31 passed (isolated SQLite databases built by the real Alembic migration) |
| Backend lint/format | `uv run ruff check …` / `ruff format --check …` | Passed |
| Frontend component tests | `pnpm test` | 10 passed |
| Type check + production build | `pnpm build` | Passed |
| Frontend formatting | `pnpm format:check` | Passed |
| Browser tests (Playwright, Chromium) | `pnpm test:e2e` | 2 passed after the fixes below |

The browser suite had never been executed before this phase. Its first run found two defects, both fixed:

1. **Dialog focus (application bug).** React's `autoFocus` focused the first field before `dialog.showModal()` ran; `showModal()` then moved focus to the close button, so keyboard users started on "Close" instead of "Full name". `Modal` now focuses the element marked `data-autofocus` after opening.
2. **Ambiguous test locator.** `getByText("Browser Test Opportunity")` also matched the screen-reader label "Stage for Browser Test Opportunity". The test now targets the card's button by role and exact name.

### Runtime verification against PostgreSQL

Performed in Chrome against `http://127.0.0.1:3000`, with the API at `:8000` connected to PostgreSQL on `127.0.0.1:55433`.

| Step | Expected | Observed |
|---|---|---|
| Starting dashboard (seeded) | 8 contacts · 6 active · ₹5,30,000 pipeline · ₹1,35,000 won · 66.7% | Matched |
| Create contact `Neha.Verma@Lumen.example` (Customer) | Created; email normalized to lowercase; count 9 | Matched; dialog opened with focus on Full name |
| Create deal ₹2,50,000.75 (New) for that contact | 7 active · pipeline ₹7,80,000.75 | Matched (`780000.75`) |
| Move the deal New → Won | 6 active · pipeline ₹5,30,000 · won ₹3,85,000.75 · win rate 3/4 = 75% | Matched; activity feed records the creation and stage change |
| Direct SQL check | Rows present in PostgreSQL, `alembic_version = 0001` | `contacts.id=9`, `deals.id=10 value=250000.75 stage=won` |
| Ctrl+C the launcher | API, UI, and PostgreSQL stop; clean database shutdown | All three exited in 2 s; log ends with `database system is shut down` |
| Relaunch without `--seed` | All records and aggregates persist | 9 contacts, ₹3,85,000.75 won, 75% win rate |

### Screenshots

Captured after the restart with `frontend/scripts/capture-screenshots.mjs` (Chromium, full page):

| View | Desktop (1440 × 900) | Mobile (390 × 844) |
|---|---|---|
| Overview | [desktop-overview](evidence/phase-1-local/desktop-overview.png) | [mobile-overview](evidence/phase-1-local/mobile-overview.png) |
| Contacts | [desktop-contacts](evidence/phase-1-local/desktop-contacts.png) | [mobile-contacts](evidence/phase-1-local/mobile-contacts.png) |
| Pipeline | [desktop-pipeline](evidence/phase-1-local/desktop-pipeline.png) | [mobile-pipeline](evidence/phase-1-local/mobile-pipeline.png) |
| Activity | [desktop-activity](evidence/phase-1-local/desktop-activity.png) | [mobile-activity](evidence/phase-1-local/mobile-activity.png) |
| Navigation drawer | — | [mobile-navigation](evidence/phase-1-local/mobile-navigation.png) |

The desktop sidebar is `position: sticky`, so full-page captures show it only for the first viewport height; in the browser it stays pinned while scrolling.

### Known notes

- Pytest emits a Starlette deprecation warning about its HTTPX test-client shim. It affects only the test client, not the runtime.

## Phase 2 — Containers and Docker Compose

Validated on 16 October 2026 with Docker Desktop 29.6 (linux/arm64) and Trivy 0.75.

| Check | Result |
|---|---|
| Backend image | `python:3.12.15-alpine3.24`, dependencies from `uv.lock`, pip removed, runs as `uid=10001(crm)`, 185 MB |
| Frontend image | `node:24.22-alpine3.24` build → `nginx-unprivileged:1.30-alpine3.24`, runs as `uid=101(nginx)`, 91 MB |
| Trivy, HIGH/CRITICAL (fixed **and** unfixed) | Backend 0 · Frontend 0. The first backend build on `python:3.12-slim` (Debian 13) had 44 unfixed HIGH OS findings, so the base moved to Alpine instead of weakening the gate with `--ignore-unfixed` |
| `docker compose up --build` | `db` healthy → `migrate` exited 0 (`Migrations applied; schema is at head.`) → `backend` healthy (`/ready`) → `frontend` healthy |
| Nginx routes | `/` 200 HTML · `/api/dashboard` 200 JSON · `/api/docs` 200 · `/healthz` 200; `nosniff`, `X-Frame-Options: DENY`, no server version |
| UI through Nginx (Chrome) | Created contact *Arjun Nair* and a ₹1,80,000 Proposal deal; dashboard showed 1 contact, 1 active deal, ₹1,80,000 pipeline |
| Container recreation | `docker compose down` removed all containers and the network; after `docker compose up -d` the contact, deal, and activity were intact; migrate reported `Schema is already at head.` |
| Concurrent migrations | Three `migrate` containers started at once against an empty database: one applied `0001`, two waited on the advisory lock and reported the schema already at head |
| Fresh checkout | Clean `git clone` of this branch, `docker compose -p crm-fresh up --build` on port 8081 → all services healthy (see below) |

Evidence: [compose-status.txt](evidence/phase-2-compose/compose-status.txt) · [desktop overview](evidence/phase-2-compose/desktop-overview.png) · [desktop pipeline](evidence/phase-2-compose/desktop-pipeline.png) · [desktop contacts](evidence/phase-2-compose/desktop-contacts.png) · [mobile overview](evidence/phase-2-compose/mobile-overview.png) · [mobile navigation](evidence/phase-2-compose/mobile-navigation.png)
