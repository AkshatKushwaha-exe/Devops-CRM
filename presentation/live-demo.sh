#!/usr/bin/env bash
# The live demo: change the brand accent from green to indigo and ship it through the pipeline.
# Captures every command and its real output to presentation/captures/commit.txt.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT=presentation/captures/commit.txt
BRANCH=demo/indigo-accent

git checkout -q main
git pull -q --ff-only origin main
git checkout -q -b "$BRANCH"

# The change: four CSS variables drive the sidebar and the primary buttons.
sed -i '' \
  -e 's/--sidebar: #173e32;/--sidebar: #1f2a5c;/' \
  -e 's/--sidebar-hover: #285140;/--sidebar-hover: #2d3b7a;/' \
  -e 's/--accent: #2c624a;/--accent: #4338ca;/' \
  -e 's/--accent-hover: #214e39;/--accent-hover: #3730a3;/' \
  frontend/src/styles.css

show() { local label=$1; shift; echo "\$ $label"; "$@" 2>&1; echo; }
{
  show "git diff --stat" git --no-pager diff --stat
  show "git diff" bash -c 'git --no-pager diff -U0 frontend/src/styles.css | grep -E "^[-+]  --"'
  show "git commit -am \"feat: switch the brand accent from green to indigo\"" \
    git commit -am "feat: switch the brand accent from green to indigo"
  show "git push -u origin $BRANCH" bash -c "git push -u origin $BRANCH 2>&1 | grep -v '^remote: *$'"
  show "gh pr create --fill" gh pr create --fill --base main --head "$BRANCH"
  show "gh pr merge --merge" gh pr merge --merge --subject "Merge: switch the brand accent from green to indigo"
} | tee "$OUT"
