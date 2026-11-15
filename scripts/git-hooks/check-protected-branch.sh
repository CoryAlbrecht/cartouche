#!/usr/bin/env bash
# Refuses commits while HEAD is a protected branch (main or release/*), per
# ADR 0031: every change is made on its own branch and fast-forward merged.
# Concluding an in-progress merge (MERGE_HEAD present) is allowed so a spec
# branch merge that needed conflict resolution can still be committed.
# Detached HEAD is allowed. Humans may bypass with `git commit --no-verify`;
# agents never do.
set -e

BRANCH=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) || exit 0

if [[ "$BRANCH" == "main" || "$BRANCH" == release/* ]]; then
  if git rev-parse --quiet --verify MERGE_HEAD >/dev/null 2>&1; then
    exit 0
  fi
  {
    echo "Direct commits to '$BRANCH' are prohibited (ADR 0031)."
    echo "Move the work to a branch first; uncommitted changes come along:"
    echo "  git switch -c <type>/<issue-id>-<slug>   # or <type>/<slug> without a ticket"
  } >&2
  exit 1
fi

exit 0
