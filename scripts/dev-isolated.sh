#!/usr/bin/env bash
# @file dev-isolated.sh
# @module scripts/dev-isolated
# @description Starts and stops an isolated Cartouche dev instance for driving the live app (CDP scripts, focus audit) without touching the developer's own instance. `start` snapshots the checkout, uncommitted and untracked changes included, into a throw-away git worktree outside the repository, symlinks node_modules, and runs `npm run dev` there in its own process group on separate CDP and inspector ports with its own user data directory, so the checkout's dist-electron/ and the developer's preferences are never rebuilt or read. It refuses to start while its previous instance is alive or a port it needs is taken. `stop` kills only that process group and removes the worktree. Sourcing the script (from inside the checkout) defines its functions and turns on `set -euo pipefail` in the sourcing shell without running a command, so tests can drive `snapshot` alone.
#
# Usage:
#   scripts/dev-isolated.sh start   # prints the CDP port once the renderer page is up
#   scripts/dev-isolated.sh stop
#   scripts/dev-isolated.sh status
# Environment: CARTOUCHE_CDP_PORT (default 9333), CARTOUCHE_INSPECT_PORT (default 5860),
#   CARTOUCHE_ISOLATED_DIR (default ${XDG_CACHE_HOME:-~/.cache}/cartouche/dev-isolated).
# The Vite dev server always uses port 5173, so only one `npm run dev` (isolated or not) runs at a time.
# @author Cory Albrecht <cory@albrecht.name>
# @date 2026-11-18
# @updated 2026-11-22
# @since 0.1.0-dev
# @see scripts/cdp-client.js
# @see scripts/cdp-focus-audit.js
set -euo pipefail

REPO=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
BASE=${CARTOUCHE_ISOLATED_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/cartouche/dev-isolated}
WORKTREE="$BASE/worktree"
USERDATA="$BASE/userdata"
PIDFILE="$BASE/pgid"
PORTFILE="$BASE/cdp-port"
LOG="$BASE/dev.log"
CDP_PORT=${CARTOUCHE_CDP_PORT:-9333}
INSPECT_PORT=${CARTOUCHE_INSPECT_PORT:-5860}

# @function alive
# @description Succeeds when the recorded process group still has a live process.
alive() {
  [ -f "$PIDFILE" ] && kill -0 -- "-$(cat "$PIDFILE")" 2>/dev/null
}

# @function port_taken
# @description Succeeds when a TCP port is already listening on localhost.
# @param {number} $1 - Port.
port_taken() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# @function remove_worktree
# @description Removes the throw-away worktree, if present, and prunes its git metadata.
remove_worktree() {
  if [ -d "$WORKTREE" ]; then
    git -C "$REPO" worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
  fi
  git -C "$REPO" worktree prune
}

# @function snapshot
# @description Creates the worktree at HEAD, applies the checkout's uncommitted changes, copies its untracked files and symlinks its node_modules. node_modules is skipped in the copy: when the checkout is itself a git worktree its node_modules is a symlink, which an older `node_modules/` ignore rule does not match. Nothing else under $BASE is skipped, so CARTOUCHE_ISOLATED_DIR must point outside the checkout or at an ignored path.
snapshot() {
  git -C "$REPO" worktree add --detach "$WORKTREE" HEAD >/dev/null
  if ! git -C "$REPO" diff --quiet HEAD; then
    git -C "$REPO" diff --binary HEAD | git -C "$WORKTREE" apply
  fi
  while IFS= read -r -d '' file; do
    case "$file" in node_modules | node_modules/*) continue ;; esac
    mkdir -p "$WORKTREE/$(dirname "$file")"
    cp -p "$REPO/$file" "$WORKTREE/$file"
  done < <(git -C "$REPO" ls-files --others --exclude-standard -z)
  ln -sfn "$REPO/node_modules" "$WORKTREE/node_modules"
}

# @function start
# @description Snapshots the checkout into the worktree and launches the dev instance in a new process group.
start() {
  if alive; then
    echo "An isolated instance is already running (process group $(cat "$PIDFILE")); run '$0 stop' first." >&2
    exit 1
  fi
  for port in "$CDP_PORT" "$INSPECT_PORT" $((INSPECT_PORT + 1)) 5173; do
    if port_taken "$port"; then
      echo "Port $port is in use; stop the instance using it or set CARTOUCHE_CDP_PORT / CARTOUCHE_INSPECT_PORT." >&2
      exit 1
    fi
  done
  mkdir -p "$BASE"
  remove_worktree
  snapshot

  # setsid runs as a background child that is not a group leader, so it starts
  # the new session in place: its PID is the process group id that stop kills.
  cd "$WORKTREE"
  CARTOUCHE_CDP_PORT=$CDP_PORT CARTOUCHE_INSPECT_PORT=$INSPECT_PORT CARTOUCHE_USER_DATA_DIR=$USERDATA \
    setsid npm run dev >"$LOG" 2>&1 < /dev/null &
  echo $! >"$PIDFILE"
  echo "$CDP_PORT" >"$PORTFILE"
  cd "$REPO"

  for _ in $(seq 1 90); do
    if curl -s "http://127.0.0.1:$CDP_PORT/json/list" 2>/dev/null | grep -q 'localhost:5173'; then
      echo "Isolated instance up: CARTOUCHE_CDP_PORT=$CDP_PORT, worktree $WORKTREE, log $LOG"
      exit 0
    fi
    if ! alive; then
      echo "The isolated instance exited during start-up; see $LOG" >&2
      exit 1
    fi
    sleep 2
  done
  echo "Timed out waiting for the renderer page on CDP port $CDP_PORT; see $LOG" >&2
  exit 1
}

# @function stop
# @description Kills the recorded process group, then removes the worktree.
stop() {
  if alive; then
    kill -- "-$(cat "$PIDFILE")" 2>/dev/null || true
    for _ in $(seq 1 20); do alive || break; sleep 0.5; done
    alive && kill -9 -- "-$(cat "$PIDFILE")" 2>/dev/null || true
  fi
  rm -f "$PIDFILE" "$PORTFILE"
  remove_worktree
  echo "Isolated instance stopped."
}

# Sourced (by tests): define the functions only.
[ "${BASH_SOURCE[0]}" = "$0" ] || return 0

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status)
    if alive; then echo "running (process group $(cat "$PIDFILE"), CDP port $(cat "$PORTFILE" 2>/dev/null || echo unknown))"; else echo "stopped"; fi
    ;;
  *)
    echo "Usage: $0 start|stop|status" >&2
    exit 2
    ;;
esac
