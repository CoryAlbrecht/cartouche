/**
 * @file sourceText.test.ts
 * @module tests/renderer/sourceText.test
 * @description Tests for the shared source-scanning helper {@link stripSourceComments} (Ticket #346): ticket numbers in block and line comments are removed before colour-literal scans, while real colours in code and `//` inside strings are kept.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLOUR_LITERAL, stripSourceComments } from './sourceText';

describe('stripSourceComments (Ticket #346)', () => {
  it('removes line and block comments, so ticket numbers in them are not read as colours', () => {
    const source = [
      '/** Sorts rows (Ticket #325). */',
      'const x = 1; // A host-started edit (Ticket #335)',
      '// Whole-line comment #abc123',
      'const y = 2;'
    ].join('\n');
    const code = stripSourceComments(source);
    assert.doesNotMatch(code, COLOUR_LITERAL);
    assert.match(code, /const x = 1;/);
    assert.match(code, /const y = 2;/);
  });

  it('strips a line comment with no space before it, and keeps line breaks', () => {
    assert.equal(stripSourceComments('foo();// #abc\nbar();'), 'foo();\nbar();');
    assert.equal(stripSourceComments('a;/* one\n two #fff */b;'), 'a;\nb;');
  });

  it('keeps comment markers inside string, template and regex literals', () => {
    for (const code of [
      "const s = ' // #fff';",
      'const t = `a // ${x} #fff`;',
      "const glob = 'src/**/*.ts'; const c = '#123456';",
      String.raw`const re = /\/\/ #fff/g;`,
      String.raw`const re2 = x.replace(/\/\*[\s\S]*?\*\//g, "");`
    ]) {
      assert.equal(stripSourceComments(code), code, code);
    }
  });

  it('keeps colours in code and // inside strings', () => {
    const code = stripSourceComments("const c = '#ff0000'; const url = 'https://example.org/a';");
    assert.match(code, COLOUR_LITERAL, 'a real colour in code is still found');
    assert.match(code, /https:\/\/example\.org\/a/);
  });
});
