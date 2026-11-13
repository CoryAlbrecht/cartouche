/**
 * @file TabbedDialogShell.test.ts
 * @module tests/renderer/dialogs/TabbedDialogShell.test
 * @description Component tests for the shared TabbedDialogShell: sidebar tab rendering, active-tab styling, class prefixing, tab change callbacks, and pane content passthrough.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link TabbedDialogShell}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const React = jiti('react');
const { renderToStaticMarkup } = jiti('react-dom/server');
const { mdiInformationOutline, mdiPaletteOutline } = jiti('@mdi/js');
const { TabbedDialogShell } = jiti('../../../src/renderer/workbench/dialogs/TabbedDialogShell.tsx');

const TABS = [
  { id: 'general', label: 'General', icon: mdiInformationOutline },
  { id: 'styling', label: 'Styling', icon: mdiPaletteOutline },
];

/**
 * @function render
 * @description Renders the shell to static markup with the given props.
 * @param {Record<string, unknown>} props - Shell props.
 * @returns {string} Static HTML.
 */
function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(React.createElement(TabbedDialogShell, props));
}

describe('TabbedDialogShell (Ticket #268)', () => {
  it('renders one sidebar button per tab with its label and icon, in order', () => {
    const html = render({ tabs: TABS, activeTabId: 'general', onTabChange: () => {}, children: null });
    const buttons = [...html.matchAll(/<button[^>]*class="[^"]*tabbed-dialog-tab-btn[^"]*"[^>]*>(.*?)<\/button>/g)];
    assert.equal(buttons.length, 2);
    assert.ok(buttons[0][1].includes('<span>General</span>'));
    assert.ok(buttons[1][1].includes('<span>Styling</span>'));
    assert.ok(buttons[0][0].includes('data-tab-id="general"'));
    assert.ok(buttons[0][1].includes('<svg'), 'tab button must render an icon');
    assert.ok(html.indexOf('General') < html.indexOf('Styling'), 'tabs keep their given order');
  });

  it('marks only the active tab with the active class', () => {
    const html = render({ tabs: TABS, activeTabId: 'styling', onTabChange: () => {}, children: null });
    assert.ok(/data-tab-id="styling" class="tabbed-dialog-tab-btn active"/.test(html));
    assert.ok(/data-tab-id="general" class="tabbed-dialog-tab-btn "/.test(html));
  });

  it('uses the classPrefix for container, sidebar, tab buttons and content', () => {
    const html = render({ tabs: TABS, activeTabId: 'general', onTabChange: () => {}, classPrefix: 'layer-properties', children: null });
    assert.ok(html.includes('class="layer-properties-container"'));
    assert.ok(html.includes('class="layer-properties-sidebar"'));
    assert.ok(html.includes('class="layer-properties-tab-btn active"'));
    assert.ok(html.includes('class="layer-properties-content"'));
    assert.ok(!html.includes('tabbed-dialog-'));
  });

  it('renders children inside the content area', () => {
    const html = render({
      tabs: TABS,
      activeTabId: 'general',
      onTabChange: () => {},
      children: React.createElement('div', { className: 'pane-marker' }, 'Pane body'),
    });
    const content = html.slice(html.indexOf('tabbed-dialog-content'));
    assert.ok(content.includes('class="pane-marker"'));
    assert.ok(content.includes('Pane body'));
  });

  it('reports the clicked tab id through onTabChange', () => {
    const seen: string[] = [];
    // The shell is hook-free, so calling it directly yields its element tree.
    const tree = TabbedDialogShell({ tabs: TABS, activeTabId: 'general', onTabChange: (id: string) => seen.push(id) });
    const sidebar = tree.props.children[0];
    const buttons = sidebar.props.children as Array<{ props: { onClick: () => void } }>;
    assert.equal(buttons.length, 2);
    buttons[1].props.onClick();
    buttons[0].props.onClick();
    assert.deepEqual(seen, ['styling', 'general']);
  });
});
