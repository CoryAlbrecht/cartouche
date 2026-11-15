/**
 * @file projectCrsStatus.test.ts
 * @module tests/renderer/state/projectCrsStatus.test
 * @description Tests for the Workbench status bar CRS item state (ADR 0033): the label and tooltip follow the Project CRS (set, "No CRS", or unset, which draws in EPSG:3857), and the derived signal follows every Project CRS change.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link describeProjectCrsStatus}
 * @see {@link projectCrsStatusSignal}
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);

const { describeProjectCrsStatus, projectCrsStatusSignal, setProjectCrs } = jiti(
  '../../../src/renderer/state/projectSignals.ts'
);
const { createNewProject, loadProjectIntoSignals, closeProjectAction } = jiti(
  '../../../src/renderer/state/gisSignals.ts'
);

describe('describeProjectCrsStatus', () => {
  it('shows the AUTH:code of a set Project CRS with its name as the tooltip', () => {
    assert.deepEqual(describeProjectCrsStatus({ authId: 'EPSG:2003', description: 'Grenada 1953 / British West Indies Grid' }), {
      label: 'EPSG:2003',
      tooltip: 'Grenada 1953 / British West Indies Grid',
    });
  });

  it('falls back to the AUTH:code as the tooltip when the Project CRS has no name', () => {
    assert.deepEqual(describeProjectCrsStatus({ authId: 'epsg:2003' }), { label: 'EPSG:2003', tooltip: 'EPSG:2003' });
  });

  it('shows "No CRS" when the Project CRS is No CRS', () => {
    const status = describeProjectCrsStatus({ authId: '', none: true });
    assert.equal(status.label, 'No CRS');
    assert.match(status.tooltip, /no reprojection/i);
  });

  for (const [why, crs] of [
    ['unset (empty map or legacy file)', null],
    ['an empty authId', { authId: '  ' }],
  ] as const) {
    it(`shows the default drawing CRS EPSG:3857 when the Project CRS is ${why}`, () => {
      const status = describeProjectCrsStatus(crs);
      assert.equal(status.label, 'EPSG:3857');
      assert.match(status.tooltip, /default drawing CRS/i);
      assert.match(status.tooltip, /no Project CRS is set/i);
    });
  }
});

describe('projectCrsStatusSignal', () => {
  afterEach(() => {
    setProjectCrs(null);
  });

  it('follows the Project CRS as it is set (CRS tab Apply/OK, Set Project CRS from Layer, first layer added)', () => {
    setProjectCrs(null);
    assert.equal(projectCrsStatusSignal.value.label, 'EPSG:3857');

    setProjectCrs({ authId: 'EPSG:2003', description: 'Grenada 1953 / British West Indies Grid' });
    assert.deepEqual(projectCrsStatusSignal.value, {
      label: 'EPSG:2003',
      tooltip: 'Grenada 1953 / British West Indies Grid',
    });

    setProjectCrs({ authId: '', none: true });
    assert.equal(projectCrsStatusSignal.value.label, 'No CRS');
  });

  it('follows project open, new, and close', async () => {
    (globalThis as any).window ??= {};
    loadProjectIntoSignals({
      format: 'cartouche-xml',
      metadata: { title: 'Opened' },
      layers: [],
      crs: { authId: 'EPSG:32633', description: 'WGS 84 / UTM zone 33N' },
    });
    assert.equal(projectCrsStatusSignal.value.label, 'EPSG:32633');

    createNewProject('Fresh');
    assert.equal(projectCrsStatusSignal.value.label, 'EPSG:3857');

    setProjectCrs({ authId: 'EPSG:2003' });
    assert.equal(projectCrsStatusSignal.value.label, 'EPSG:2003');
    assert.equal(await closeProjectAction(), true);
    assert.equal(projectCrsStatusSignal.value.label, 'EPSG:3857');
  });
});
