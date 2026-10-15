# Local validation record

Validated on 15 October 2026 using Python 3.12 and Node 24.

| Check | Result |
|---|---|
| Backend Pytest suite | 31 tests passed; isolated SQLite databases created from Alembic migrations |
| Frontend component workflows | 10 tests passed using jsdom and mocked HTTP responses |
| TypeScript and Vite production build | Passed |
| Python Ruff lint and formatting | Passed |
| Frontend Prettier formatting | Passed |
| Alembic schema drift check | Passed against the local SQLite preview database |
| Alembic upgrade/downgrade | Passed in automated migration tests |
| PostgreSQL migration SQL generation | Passed in offline mode; not executed against PostgreSQL |
| Fictional seed data | Idempotence checked; contacts, deals, and dashboard return 200 with seeded data |
| Bash syntax and ShellCheck | Passed for the launcher and commit helper |
| Playwright test discovery | Two browser scenarios discovered successfully |

## Environment limitations still to resolve

- The workspace's `.git` path is read-only. `git init -b main` failed with `Operation not permitted`. **No commits were created.** `scripts/commit-local.sh` prepares eight explicit commit groups for execution in a normal terminal, attributed to the requested author and committer, with no co-author trailers.
- The sandbox denies binding to `127.0.0.1:8000`; therefore a live local preview and the full browser suite could not run here. Launching the installed Chrome through Playwright also failed in this environment. The interface has not received a real-browser visual review yet.
- PostgreSQL initialization reached the bootstrap step but failed on `shmget` with `Operation not permitted`. PostgreSQL models, configuration, and migrations are included, but a real PostgreSQL runtime check remains pending. The local launcher and PostgreSQL shutdown behavior also need a smoke test outside the sandbox.
- GitHub repository contents were not accessible: the unauthenticated API returned 404, and the authenticated CLI could not connect. No remote history was changed, and nothing was pushed.
- Pytest currently emits a dependency deprecation warning from Starlette's HTTPX compatibility layer. All 31 tests pass; the warning does not affect the application runtime.

## Finish runtime validation from a normal terminal

```bash
bash scripts/dev.sh --seed
```

Open http://127.0.0.1:3000. Create a contact, create a linked deal, move it to Won, and confirm the dashboard updates. Restart the launcher to verify persistence. Confirm the UI at desktop and mobile widths. Ctrl+C should stop the API, UI, and local PostgreSQL processes.

In a separate terminal, execute the isolated browser suite:

```bash
cd frontend
pnpm exec playwright install chromium
pnpm test:e2e
```

Then create the eight local commits:

```bash
bash scripts/commit-local.sh
```

Run that last command from the project root. The script never pushes or deploys.
