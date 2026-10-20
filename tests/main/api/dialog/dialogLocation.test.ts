/**
 * @file dialogLocation.test.ts
 * @module tests/main/api/dialog/dialogLocation.test
 * @description Unit tests for system file dialog location preference resolution, named token mapping, filesystem validation, and update handling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @see {@link resolveDialogDefaultPath}
 * @see {@link updateDialogLocation}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUILTIN_PREFERENCES } from '../../../../src/shared/preferences/index';
import { PreferencesStore } from '../../../../src/main/api/ui/preferences/PreferencesStore';
import {
  resolveDialogDefaultPath,
  updateDialogLocation
} from '../../../../src/main/api/dialog/dialogLocation';
import openProject from '../../../../src/main/api/project/openProject';
import { projectStore } from '../../../../src/main/project/ProjectStore';

describe('dialogLocation', () => {
  beforeEach(() => {
    PreferencesStore.set('ui.systemDialogs.openFile.location', ':Recent');
    PreferencesStore.set('ui.systemDialogs.saveFile.location', ':Recent');
  });

  it('defines hidden non-ephemeral openFile and saveFile location preferences defaulting to ":Recent" and resolves ":Recent" to undefined', () => {
    const openPref = BUILTIN_PREFERENCES['ui.systemDialogs.openFile.location'];
    const savePref = BUILTIN_PREFERENCES['ui.systemDialogs.saveFile.location'];

    assert.ok(openPref, 'openFile location preference must be defined');
    assert.equal(openPref.category, 'ui');
    assert.equal(openPref.type, 'string');
    assert.equal(openPref.hidden, true);
    assert.equal(openPref.ephemeral, false);
    assert.equal(openPref.value, ':Recent');
    assert.equal(openPref.defaultValue, ':Recent');

    assert.ok(savePref, 'saveFile location preference must be defined');
    assert.equal(savePref.category, 'ui');
    assert.equal(savePref.type, 'string');
    assert.equal(savePref.hidden, true);
    assert.equal(savePref.ephemeral, false);
    assert.equal(savePref.value, ':Recent');
    assert.equal(savePref.defaultValue, ':Recent');

    assert.equal(resolveDialogDefaultPath('open'), undefined);
    assert.equal(resolveDialogDefaultPath('save'), undefined);
    assert.equal(typeof updateDialogLocation, 'function');
  });

  it('resolves named tokens (:Home, :Documents, :Downloads, :Desktop, :Recent) case-insensitively via app.getPath and returns undefined for unrecognized tokens', () => {
    const requestedKeys: string[] = [];
    const mockGetPath = (name: string) => {
      requestedKeys.push(name);
      const map: Record<string, string> = {
        home: '/mock/home/user',
        documents: '/mock/home/user/Documents',
        downloads: '/mock/home/user/Downloads',
        desktop: '/mock/home/user/Desktop'
      };
      return map[name] ?? '';
    };

    PreferencesStore.set('ui.systemDialogs.openFile.location', ':Home');
    assert.equal(resolveDialogDefaultPath('open', undefined, { getPath: mockGetPath }), '/mock/home/user');

    PreferencesStore.set('ui.systemDialogs.openFile.location', ':documents');
    assert.equal(resolveDialogDefaultPath('open', undefined, { getPath: mockGetPath }), '/mock/home/user/Documents');

    PreferencesStore.set('ui.systemDialogs.saveFile.location', ':DOWNLOADS');
    assert.equal(resolveDialogDefaultPath('save', undefined, { getPath: mockGetPath }), '/mock/home/user/Downloads');

    PreferencesStore.set('ui.systemDialogs.saveFile.location', ':dEsKtOp');
    assert.equal(resolveDialogDefaultPath('save', undefined, { getPath: mockGetPath }), '/mock/home/user/Desktop');

    PreferencesStore.set('ui.systemDialogs.openFile.location', ':rEcEnT');
    assert.equal(resolveDialogDefaultPath('open', undefined, { getPath: mockGetPath }), undefined);

    PreferencesStore.set('ui.systemDialogs.openFile.location', ':UnknownToken');
    assert.equal(resolveDialogDefaultPath('open', undefined, { getPath: mockGetPath }), undefined);

    assert.deepEqual(requestedKeys, ['home', 'documents', 'downloads', 'desktop']);
  });

  it('returns existing stored directory paths and resets non-existent or non-directory paths to ":Recent"', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-dialog-test-'));
    const tempFile = path.join(tempDir, 'sample.cproj');
    fs.writeFileSync(tempFile, '<project/>', 'utf-8');

    try {
      PreferencesStore.set('ui.systemDialogs.openFile.location', tempDir);
      assert.equal(resolveDialogDefaultPath('open'), tempDir);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
        tempDir
      );

      const missingDir = path.join(tempDir, 'does-not-exist-subdir');
      PreferencesStore.set('ui.systemDialogs.openFile.location', missingDir);
      assert.equal(resolveDialogDefaultPath('open'), undefined);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
        ':Recent'
      );

      PreferencesStore.set('ui.systemDialogs.saveFile.location', tempFile);
      assert.equal(resolveDialogDefaultPath('save'), undefined);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.saveFile.location')['ui.systemDialogs.saveFile.location']?.value,
        ':Recent'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gives precedence to explicit caller paths and joins bare filenames with resolved preference directories', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-dialog-prec-'));
    try {
      PreferencesStore.set('ui.systemDialogs.saveFile.location', tempDir);

      // Explicit full path takes precedence over stored preference directory
      const explicitPath = '/custom/projects/existing-map.cproj';
      assert.equal(resolveDialogDefaultPath('save', explicitPath), explicitPath);

      // Bare filename joins with stored existing directory
      assert.equal(
        resolveDialogDefaultPath('save', 'New Project.cproj'),
        path.join(tempDir, 'New Project.cproj')
      );

      // Bare filename joins with resolved named token directory
      PreferencesStore.set('ui.systemDialogs.saveFile.location', ':Documents');
      assert.equal(
        resolveDialogDefaultPath('save', 'Untitled.cproj', {
          getPath: () => '/mock/home/Documents'
        }),
        path.join('/mock/home/Documents', 'Untitled.cproj')
      );

      // Bare filename is preserved as-is when preference resolves to undefined (:Recent)
      PreferencesStore.set('ui.systemDialogs.saveFile.location', ':Recent');
      assert.equal(resolveDialogDefaultPath('save', 'Untitled.cproj'), 'Untitled.cproj');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('updates open and save preferences independently with path.dirname(selectedPath) and ignores empty/canceled selections', () => {
    updateDialogLocation('open', '/home/user/spatial/rivers.geojson');
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
      '/home/user/spatial'
    );
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.saveFile.location')['ui.systemDialogs.saveFile.location']?.value,
      ':Recent'
    );

    updateDialogLocation('save', '/home/user/projects/atlas.cproj');
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.saveFile.location')['ui.systemDialogs.saveFile.location']?.value,
      '/home/user/projects'
    );
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
      '/home/user/spatial'
    );

    // Empty / canceled selection does not modify stored preference
    updateDialogLocation('open', '');
    updateDialogLocation('save', '   ');
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
      '/home/user/spatial'
    );
    assert.equal(
      PreferencesStore.get('ui.systemDialogs.saveFile.location')['ui.systemDialogs.saveFile.location']?.value,
      '/home/user/projects'
    );
  });

  it('passes resolved defaultPath to openProject dialog, updates preference on selection, and leaves preference unchanged on cancel or programmatic open', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-openproj-dlg-'));
    const projDir = path.join(tempDir, 'saved-projects');
    fs.mkdirSync(projDir, { recursive: true });
    const projFile = path.join(projDir, 'test.cproj');
    fs.writeFileSync(
      projFile,
      `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://cartouche.gis/schemas/project" version="0.1.0-dev">
  <metadata><title>Dialog Location Test</title></metadata>
  <layers/>
</project>`,
      'utf-8'
    );

    try {
      PreferencesStore.set('ui.systemDialogs.openFile.location', tempDir);
      let capturedOptions: any = null;

      // 1. Canceled dialog does not modify preference
      const canceledRes = await openProject(undefined, {
        showOpenDialog: async (opts: any) => {
          capturedOptions = opts;
          return { canceled: true, filePaths: [] };
        }
      });
      assert.equal(canceledRes, null);
      assert.equal(capturedOptions?.defaultPath, tempDir);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
        tempDir
      );

      // 2. Confirmed dialog updates preference to path.dirname(selectedPath)
      const confirmedRes = await openProject(undefined, {
        showOpenDialog: async (opts: any) => {
          capturedOptions = opts;
          return { canceled: false, filePaths: [projFile] };
        }
      });
      assert.ok(confirmedRes);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
        projDir
      );

      // 3. Programmatic openProject(filePath) does not alter stored preference
      PreferencesStore.set('ui.systemDialogs.openFile.location', ':Recent');
      const progRes = await openProject(projFile);
      assert.ok(progRes);
      assert.equal(
        PreferencesStore.get('ui.systemDialogs.openFile.location')['ui.systemDialogs.openFile.location']?.value,
        ':Recent'
      );
    } finally {
      projectStore.closeProject();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});