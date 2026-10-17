import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AWS_SERVICES, AWS_CATEGORIES, DEFAULT_AWS_SERVICE, awsService, awsIconSvg, awsIconDataUri,
} from './aws-icons.js';

describe('AWS service icons', () => {
  test('every service has a unique id, a short label, a full name and a known category colour', () => {
    assert.ok(AWS_SERVICES.length >= 20);
    assert.equal(new Set(AWS_SERVICES.map((s) => s.id)).size, AWS_SERVICES.length);
    assert.equal(new Set(AWS_SERVICES.map((s) => s.label)).size, AWS_SERVICES.length);
    for (const s of AWS_SERVICES) {
      assert.ok(AWS_CATEGORIES[s.category], `${s.id} category`);
      assert.match(s.color, /^#[0-9A-F]{6}$/);
      assert.equal(s.color, AWS_CATEGORIES[s.category].color);
      assert.match(s.name, /^(Amazon|AWS|Elastic) /, s.id);
      assert.ok(s.label.length > 0 && s.label.length <= 16, s.id);
    }
  });

  test('each icon is a self-contained SVG: a tile in its colour plus a white glyph, no text or external refs', () => {
    for (const s of AWS_SERVICES) {
      const svg = awsIconSvg(s.id);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 64 64">[\s\S]*<\/svg>$/, s.id);
      assert.ok(svg.includes(`stop-color="${s.color}"`), `${s.id} colour`);
      assert.ok(svg.includes('stroke="#FFFFFF"'), `${s.id} glyph`);
      assert.ok(/<(path|rect|circle|ellipse)\b/.test(svg.split('<g fill="none"')[1]), `${s.id} has a glyph`);
      assert.doesNotMatch(svg, /<text|<script|<image|xlink:href|href=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/, s.id);
      // Balanced tags (a cheap well-formedness check).
      const opens = (svg.match(/<(?!\/)[a-zA-Z]+[^>]*[^/]>/g) || []).length;
      const closes = (svg.match(/<\/[a-zA-Z]+>/g) || []).length;
      assert.equal(opens, closes, `${s.id} balanced`);
    }
  });

  test('the data URI is safe inside a draw.io style string and decodes back to the SVG', () => {
    for (const s of AWS_SERVICES) {
      const uri = awsIconDataUri(s.id);
      assert.ok(uri.startsWith('data:image/svg+xml,%3Csvg'));
      assert.doesNotMatch(uri, /[;=\s"<>]/, `${s.id} has a raw ; = space quote or bracket`);
      assert.equal(decodeURIComponent(uri.slice('data:image/svg+xml,'.length)), awsIconSvg(s.id));
    }
  });

  test('unknown services fall back to the default', () => {
    assert.equal(awsService('nope'), null);
    assert.ok(awsService(DEFAULT_AWS_SERVICE));
    assert.equal(awsIconSvg('nope'), awsIconSvg(DEFAULT_AWS_SERVICE));
  });
});
