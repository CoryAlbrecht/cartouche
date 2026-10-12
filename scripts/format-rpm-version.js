/**
 * @file format-rpm-version.js
 * @module scripts/format-rpm-version
 * @description Formats and sanitizes semantic package version strings into RPM-compliant version and release fields.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} RpmVersionAndRelease
 * @property {string} version - Sanitized RPM version string (hyphen-free).
 * @property {string} release - Sanitized RPM release / iteration string.
 */

/**
 * @description Splits and sanitizes a SemVer version string into RPM-compliant version and release (iteration) strings.
 * In RPM naming standards, the Version field cannot contain hyphens, and pre-release identifiers
 * belong in the Release (iteration) field so package managers can order versions correctly.
 *
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {string} rawVersion - The raw package version (e.g., "0.1.0-dev+60", "0.1.0-dev", "0.1.0").
 * @returns {RpmVersionAndRelease} Compliant RPM version and release strings.
 */
export function formatRpmVersionAndRelease(rawVersion) {
  if (!rawVersion || typeof rawVersion !== 'string') {
    return { version: '0.1.0', release: '1' };
  }

  // Separate base version from prerelease and build metadata
  // Format: [version](-[prerelease])?(\+[build])?
  const semverMatch = rawVersion.match(/^([0-9]+(?:\.[0-9]+)*)(?:-([^+]+))?(?:\+(.+))?$/);

  if (semverMatch) {
    const [, baseVer, prerelease, build] = semverMatch;
    if (!prerelease && !build) {
      return { version: baseVer, release: '1' };
    }

    // Clean any invalid RPM characters (RPM release allows [A-Za-z0-9._])
    const cleanTag = (prerelease || '').replace(/[^A-Za-z0-9._]/g, '.');
    const cleanBuild = (build || '').replace(/[^A-Za-z0-9._]/g, '.');

    if (prerelease) {
      const lower = cleanTag.toLowerCase();
      const isPrerelease =
        lower.startsWith('dev') ||
        lower.startsWith('rc') ||
        lower.startsWith('alpha') ||
        lower.startsWith('beta');
      const prefix = isPrerelease ? '0.1' : '1';
      const parts = [prefix, cleanTag];
      if (cleanBuild) parts.push(cleanBuild);
      return { version: baseVer, release: parts.filter(Boolean).join('.') };
    } else {
      // Only build metadata present
      return { version: baseVer, release: cleanBuild ? `1.${cleanBuild}` : '1' };
    }
  }

  // Fallback for non-standard versions:
  // Split on first hyphen if present
  if (rawVersion.includes('-')) {
    const [ver, ...rest] = rawVersion.split('-');
    const cleanVer = ver.replace(/[^A-Za-z0-9.]/g, '.');
    const cleanRel = rest.join('.').replace(/[^A-Za-z0-9._]/g, '.');
    return {
      version: cleanVer || '0.1.0',
      release: cleanRel ? `0.1.${cleanRel}` : '1',
    };
  }

  // No hyphen present
  const cleanVer = rawVersion.replace(/[^A-Za-z0-9.]/g, '.');
  return { version: cleanVer || '0.1.0', release: '1' };
}

