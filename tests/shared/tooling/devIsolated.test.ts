/**
 * @file devIsolated.test.ts
 * @module tests/shared/tooling/devIsolated.test
 * @description Tests the checkout snapshot of `scripts/dev-isolated.sh` (sourced, so no dev instance starts) against throwaway git repositories: tracked edits and untracked files reach the throw-away worktree, and a checkout that is itself a git worktree with a symlinked `node_modules` gets a single `node_modules` link instead of a copied or nested one.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see scripts/dev-isolated.sh
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dirname, "../../../scripts/dev-isolated.sh");

/**
 * @function git
 * @description Runs a git command in `cwd` with a fixed identity, throwing on failure.
 * @param {string} cwd - Repository directory.
 * @param {string[]} args - Git arguments.
 * @returns {string} Trimmed stdout.
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "core.hooksPath=/dev/null",
      ...args,
    ],
    { cwd, encoding: "utf8" }
  ).trim();
}

/**
 * @function snapshot
 * @description Sources the script and snapshots `repo` into `worktree`.
 * @param {string} repo - Checkout to snapshot.
 * @param {string} worktree - Throw-away worktree path to create.
 * @returns {{ status: number | null, stderr: string }} Exit status and stderr.
 */
function snapshot(
  repo: string,
  worktree: string
): { status: number | null; stderr: string } {
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source "$1" && REPO=$2 && WORKTREE=$3 && snapshot',
      "_",
      SCRIPT,
      repo,
      worktree,
    ],
    { encoding: "utf8" }
  );
  return { status: result.status, stderr: result.stderr };
}

describe("dev-isolated.sh checkout snapshot", () => {
  let root: string;
  let main: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cartouche-dev-isolated-"));
    main = join(root, "main");
    mkdirSync(main);
    git(main, "init", "-q", "-b", "main");
    // The older trailing-slash rule, as an older commit checked out in a worktree has it:
    // it matches the node_modules directory but not a node_modules symlink.
    writeFileSync(join(main, ".gitignore"), "node_modules/\n");
    writeFileSync(join(main, "tracked.txt"), "committed\n");
    git(main, "add", ".");
    git(main, "commit", "-q", "-m", "root");
    mkdirSync(join(main, "node_modules", "pkg"), { recursive: true });
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("is quiet when sourced and runs no subcommand", () => {
    const result = spawnSync("bash", ["-c", 'source "$1"', "_", SCRIPT], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });

  it("carries tracked edits and untracked files into the throw-away worktree", () => {
    writeFileSync(join(main, "tracked.txt"), "edited\n");
    writeFileSync(join(main, "untracked.txt"), "new\n");
    const target = join(root, "snap-main");
    const result = snapshot(main, target);
    try {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        readFileSync(join(target, "tracked.txt"), "utf8"),
        "edited\n"
      );
      assert.equal(
        readFileSync(join(target, "untracked.txt"), "utf8"),
        "new\n"
      );
      assert.ok(lstatSync(join(target, "node_modules")).isSymbolicLink());
      assert.equal(
        readlinkSync(join(target, "node_modules")),
        join(main, "node_modules")
      );
    } finally {
      git(main, "worktree", "remove", "--force", target);
      git(main, "checkout", "--", "tracked.txt");
      rmSync(join(main, "untracked.txt"));
    }
  });

  it("links node_modules once when the checkout is a worktree with a symlinked node_modules", () => {
    const agent = join(root, "agent");
    git(main, "worktree", "add", "-q", "--detach", agent, "HEAD");
    symlinkSync(join(main, "node_modules"), join(agent, "node_modules"));
    writeFileSync(join(agent, "untracked.txt"), "new\n");
    const target = join(root, "snap-agent");
    const result = snapshot(agent, target);
    try {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        readFileSync(join(target, "untracked.txt"), "utf8"),
        "new\n"
      );
      assert.ok(lstatSync(join(target, "node_modules")).isSymbolicLink());
      assert.equal(
        readlinkSync(join(target, "node_modules")),
        join(agent, "node_modules")
      );
      assert.deepEqual(readdirSync(join(main, "node_modules")), ["pkg"]);
    } finally {
      if (existsSync(target))
        git(main, "worktree", "remove", "--force", target);
      git(main, "worktree", "remove", "--force", agent);
    }
  });
});
