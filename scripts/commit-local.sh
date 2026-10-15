#!/usr/bin/env bash
# Materialize eight focused LOCAL commits. This script never pushes or deploys.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
remote_url="https://github.com/AkshatKushwaha-exe/Devops-CRM.git"
if [[ ! -e .git ]]; then
  git init -b main
fi
if [[ "$(git rev-parse --show-toplevel)" != "$project_root" ]]; then
  echo "Refusing to operate on a different repository." >&2; exit 1
fi
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "This helper is for an empty local repository. Existing history was left untouched." >&2
  exit 1
fi
if [[ -n "$(git diff --cached --name-only)" ]]; then
  echo "The index already contains staged changes. Review those first." >&2; exit 1
fi
existing_remote="$(git remote get-url origin 2>/dev/null || true)"
if [[ -n "$existing_remote" && "$existing_remote" != "$remote_url" ]]; then
  echo "Origin already points elsewhere. Review the remote before continuing." >&2; exit 1
fi
if [[ -z "$existing_remote" ]]; then git remote add origin "$remote_url"; fi
git config user.name "AkshatKushwaha-exe"
git config user.email "akshatkushwaha0609@gmail.com"
export GIT_AUTHOR_NAME="AkshatKushwaha-exe"
export GIT_COMMITTER_NAME="AkshatKushwaha-exe"
export GIT_AUTHOR_EMAIL="akshatkushwaha0609@gmail.com"
export GIT_COMMITTER_EMAIL="akshatkushwaha0609@gmail.com"

git add .gitignore .editorconfig backend/pyproject.toml backend/uv.lock backend/requirements.txt frontend/package.json frontend/pnpm-lock.yaml frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/public
git commit -m "chore: initialize CRM workspace and lock application dependencies"

git add backend/.env.example backend/app/__init__.py backend/app/config.py backend/app/db.py backend/app/models.py backend/app/schemas.py backend/alembic.ini backend/alembic
git commit -m "feat: model contacts and sales opportunities with Alembic migrations"

git add backend/app/routes/__init__.py backend/app/routes/contacts.py backend/app/transactions.py
git commit -m "feat: add validated contact management and activity recording"

git add backend/app/routes/deals.py backend/app/routes/dashboard.py backend/app/main.py backend/app/seed.py
git commit -m "feat: implement deal stages and live CRM dashboard aggregates"

git add frontend/src/api.ts frontend/src/hooks.ts frontend/src/types.ts frontend/src/components.tsx frontend/src/styles.css
git commit -m "feat: create responsive CRM design system and API client"

git add frontend/src/Contacts.tsx frontend/src/ContactForm.tsx frontend/src/Pipeline.tsx frontend/src/DealForm.tsx
git commit -m "feat: build searchable contacts and editable sales pipeline"

git add frontend/src/App.tsx frontend/src/main.tsx frontend/src/Overview.tsx frontend/src/Activity.tsx
git commit -m "feat: connect workspace navigation to dashboard and activity views"

git add backend/tests frontend/src/flows.test.tsx frontend/src/test-setup.ts frontend/vitest.config.ts frontend/playwright.config.ts frontend/e2e scripts README.md docs
git commit -m "test: cover CRM workflows and document local development"

git log -8 --format='%h %an | %cn | %s'
echo "Eight local commits created. Nothing has been pushed or deployed."
