/**
 * @file xmlEntityDecoder.test.ts
 * @module tests/main/i18n/xmlEntityDecoder.test
 * @description Unit tests verifying decoding of XML named entities, decimal character references, and hexadecimal character references while preserving markup.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link decodeXmlEntities}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeXmlEntities } from '../../../src/main/i18n/xmlEntityDecoder';

describe('XML Entity Decoder', () => {
  it('decodes standard XML entities (&amp;, &lt;, &gt;, &quot;, &apos;)', () => {
    assert.equal(decodeXmlEntities('UI &amp; Display'), 'UI & Display');
    assert.equal(decodeXmlEntities('Plugins &amp; Extensions'), 'Plugins & Extensions');
    assert.equal(decodeXmlEntities('&lt;div class=&quot;box&quot;&gt;&apos;test&apos;&lt;/div&gt;'), '<div class="box">\'test\'</div>');
  });

  it('decodes decimal numeric character references (&#...;)', () => {
    assert.equal(decodeXmlEntities('&#65;&#66;&#67;'), 'ABC');
    assert.equal(decodeXmlEntities('Copyright &#169; 2026'), 'Copyright © 2026');
    assert.equal(decodeXmlEntities('Emoji &#128512;!'), 'Emoji 😀!');
  });

  it('decodes hexadecimal numeric character references (&#x...; and &#X...;)', () => {
    assert.equal(decodeXmlEntities('&#x41;&#x42;&#x43;'), 'ABC');
    assert.equal(decodeXmlEntities('&#X41;&#X42;&#X43;'), 'ABC');
    assert.equal(decodeXmlEntities('Copyright &#xa9; 2026'), 'Copyright © 2026');
    assert.equal(decodeXmlEntities('Emoji &#x1F600;!'), 'Emoji 😀!');
  });

  it('preserves embedded markup tags intact while decoding entities', () => {
    assert.equal(
      decodeXmlEntities('Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.'),
      'Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.'
    );
    assert.equal(
      decodeXmlEntities('Press <kbd>Ctrl &amp; Alt</kbd> to save &amp; exit.'),
      'Press <kbd>Ctrl & Alt</kbd> to save & exit.'
    );
  });

  it('performs single-pass decoding to prevent double-unescaping', () => {
    assert.equal(decodeXmlEntities('&amp;amp;'), '&amp;');
    assert.equal(decodeXmlEntities('&amp;lt;'), '&lt;');
    assert.equal(decodeXmlEntities('&amp;#65;'), '&#65;');
  });

  it('handles empty strings and strings without entities unchanged', () => {
    assert.equal(decodeXmlEntities(''), '');
    assert.equal(decodeXmlEntities('Plain text without entities'), 'Plain text without entities');
  });

  it('handles invalid or out-of-range numeric character references safely without throwing', () => {
    // Unicode maximum is 0x10FFFF (1114111)
    assert.equal(decodeXmlEntities('&#999999999;'), '&#999999999;');
    assert.equal(decodeXmlEntities('&#x110000;'), '&#x110000;');
    // Incomplete/unrecognized entities left as-is
    assert.equal(decodeXmlEntities('&unknown;'), '&unknown;');
    assert.equal(decodeXmlEntities('&#;'), '&#;');
    assert.equal(decodeXmlEntities('&#x;'), '&#x;');
    assert.equal(decodeXmlEntities('&amp'), '&amp');
  });
});

