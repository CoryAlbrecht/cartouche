/**
 * @file format-rpm-version.test.js
 * @module scripts/__tests__/format-rpm-version.test
 * @description Unit tests verifying RPM package version and release sanitization compliance with RPM and Fedora naming guidelines.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @see {@link formatRpmVersionAndRelease}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { formatRpmVersionAndRelease } from '../format-rpm-version.js';

describe('formatRpmVersionAndRelease', () => {
  it('formats development prerelease with revision count into RPM version and release', () => {
    const result = formatRpmVersionAndRelease('0.1.0-dev+60');
    assert.deepEqual(result, {
      version: '0.1.0',
      release: '0.1.dev.60',
    });
  });

  it('formats development prerelease without revision count', () => {
    const result = formatRpmVersionAndRelease('0.1.0-dev');
    assert.deepEqual(result, {
      version: '0.1.0',
      release: '0.1.dev',
    });
  });

  it('formats release candidate with build number into RPM version and release', () => {
    const result = formatRpmVersionAndRelease('0.1.0-rc+12');
    assert.deepEqual(result, {
      version: '0.1.0',
      release: '0.1.rc.12',
    });
  });

  it('formats stable release branch with revision count', () => {
    const result = formatRpmVersionAndRelease('0.1.0-stable+45');
    assert.deepEqual(result, {
      version: '0.1.0',
      release: '1.stable.45',
    });
  });

  it('formats plain semantic version without prerelease tags', () => {
    const result = formatRpmVersionAndRelease('0.1.0');
    assert.deepEqual(result, {
      version: '0.1.0',
      release: '1',
    });
  });

  it('ensures neither version nor release contains forbidden hyphens', () => {
    const testCases = [
      '0.1.0-dev+60',
      '0.1.0-dev',
      '0.1.0-rc+12',
      '0.1.0-stable+45',
      '1.0.0-alpha.1+build.10',
      '0.1.0',
    ];

    for (const testCase of testCases) {
      const { version, release } = formatRpmVersionAndRelease(testCase);
      assert.doesNotMatch(version, /-/, `Version '${version}' must not contain hyphens`);
      assert.doesNotMatch(release, /-/, `Release '${release}' must not contain hyphens`);
      assert.doesNotMatch(version, /\+/, `Version '${version}' must not contain plus signs`);
      assert.doesNotMatch(release, /\+/, `Release '${release}' must not contain plus signs`);
    }
  });

  it('orders prerelease builds lower than final release under RPM vercmp', () => {
    try {
      execSync('rpm --version', { stdio: 'ignore' });
    } catch {
      // Skip if rpm binary is unavailable in environment
      return;
    }

    const runRpmVercmp = (pkgA, pkgB) =>
      execSync(
        `rpm --eval '%{lua:print(rpm.vercmp("${pkgA.version}-${pkgA.release}", "${pkgB.version}-${pkgB.release}"))}'`,
        { encoding: 'utf8' }
      ).trim();

    const dev60 = formatRpmVersionAndRelease('0.1.0-dev+60');
    const dev61 = formatRpmVersionAndRelease('0.1.0-dev+61');
    const rc1 = formatRpmVersionAndRelease('0.1.0-rc+1');
    const finalVer = formatRpmVersionAndRelease('0.1.0');

    assert.equal(runRpmVercmp(dev60, finalVer), '-1', 'Prerelease dev+60 must sort lower than final 0.1.0-1');
    assert.equal(runRpmVercmp(dev60, dev61), '-1', 'dev+60 must sort lower than dev+61');
    assert.equal(runRpmVercmp(rc1, finalVer), '-1', 'rc+1 must sort lower than final 0.1.0-1');
  });
});

