#!/usr/bin/env bash
set -e

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || exit 0)

# Check if branch matches: version-W.X.Y-(dev|rc|stable|lts)
REGEX="^version-([0-9]+\.[0-9]+\.[0-9]+)-(dev|rc|stable|lts)$"

if [[ "$BRANCH" =~ $REGEX ]]; then
  BASE_VER="${BASH_REMATCH[1]}"
  TYPE="${BASH_REMATCH[2]}"
  TARGET_VER="${BASE_VER}-${TYPE}"

  # Read current version from package.json without modifying formatting
  CURRENT_VER=$(node -p "require('./package.json').version" 2>/dev/null || exit 0)

  if [ "$CURRENT_VER" != "$TARGET_VER" ]; then
    echo "⚙️ Syncing package.json version: $CURRENT_VER -> $TARGET_VER (from branch $BRANCH)"

    # Update package.json without creating a git tag
    npm version --no-git-tag-version "$TARGET_VER" >/dev/null 2>&1

    # If running inside pre-commit, stage the updated package files
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git add package.json package-lock.json
    fi
  fi
fi

exit 0
