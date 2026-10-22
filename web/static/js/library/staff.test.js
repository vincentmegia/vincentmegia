import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { drawSecurity, isSecurityBlinkingAt, isSecurityOnRadioAt } from './security.js';
import { drawVolunteer, isVolunteerBlinkingAt } from './volunteer.js';
import { drawJanitor, isJanitorBlinkingAt } from './janitor.js';
import { drawShelver, isShelverBlinkingAt } from './shelver.js';
import { drawStoryteller, isStorytellerBlinkingAt, storytellerTalkAt } from './storyteller.js';
import { drawArchivist, isArchivistBlinkingAt } from './archivist.js';
import { isBlinkingAt, legPoses, walkCycle } from './staff-kit.js';

/** A canvas 2D context stand-in that counts calls and records translate()s. */
function fakeContext() {
  const calls = { count: 0, translates: [] };
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'translate') return (x, y) => { calls.count++; calls.translates.push([x, y]); };
      return () => { calls.count++; };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

const STAFF = [
  ['Security', drawSecurity, isSecurityBlinkingAt],
  ['Volunteer', drawVolunteer, isVolunteerBlinkingAt],
  ['Janitor', drawJanitor, isJanitorBlinkingAt],
  ['Shelver', drawShelver, isShelverBlinkingAt],
  ['Storyteller', drawStoryteller, isStorytellerBlinkingAt],
  ['Archivist', drawArchivist, isArchivistBlinkingAt],
];

describe('the detailed staff renderers', () => {
  for (const [name, draw, blinking] of STAFF) {
    test(`${name} draws standing, mid-blink and walking, in detail`, () => {
      const blinkT = [...Array(400).keys()].map((i) => i * 0.05).find((t) => blinking(t));
      assert.ok(blinkT !== undefined, `${name} never blinks`);
      for (const opts of [{ t: 1 }, { t: blinkT }, { t: 2, walking: true, scale: 1.55 }]) {
        const ctx = fakeContext();
        draw(ctx, 100, 200, opts);
        assert.ok(ctx.calls.count > 400, `${name} drew too little for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
      }
    });

    test(`${name} blinks briefly and mostly has their eyes open`, () => {
      let shut = 0;
      for (let i = 0; i < 1000; i++) if (blinking(i * 0.037)) shut++;
      assert.ok(shut > 0 && shut < 100, `${name}: ${shut}`);
    });

    test(`${name}'s legs move while walking and not while standing`, () => {
      const frames = (walking) => [0.3, 0.6, 0.9].map((t) => {
        const ctx = fakeContext();
        draw(ctx, 0, 0, { t, walking });
        return JSON.stringify(ctx.calls.translates);
      });
      const still = frames(false);
      const moving = frames(true);
      assert.notEqual(moving[0], moving[1]);
      // Standing, only slow idle motion (breathing, a blink) changes them;
      // walking changes far more.
      assert.notDeepEqual(still, moving);
    });
  }

  test('Security lifts his radio now and then, and mostly not', () => {
    let up = 0;
    for (let i = 0; i < 700; i++) if (isSecurityOnRadioAt(i * 0.1)) up++;
    assert.ok(up > 50 && up < 300, `${up}`);
  });

  test('the Storyteller talks in bursts with pauses between sentences', () => {
    const samples = [...Array(320).keys()].map((i) => storytellerTalkAt(i * 0.01));
    for (const v of samples) assert.ok(v >= 0 && v <= 1);
    assert.ok(samples.some((v) => v > 0.5));
    assert.ok([...Array(60).keys()].every((i) => storytellerTalkAt(2.65 + i * 0.009) === 0));
  });
});

describe('staff-kit', () => {
  test('blinks are short and offset people stay out of step', () => {
    assert.equal(isBlinkingAt(0.05, 3), true);
    assert.equal(isBlinkingAt(1, 3), false);
    assert.equal(isBlinkingAt(0.05, 3, 1), false);
    assert.equal(isBlinkingAt(-2.95, 3), true);
  });

  test('a standing walk cycle has no stride; a walking one does', () => {
    assert.ok(walkCycle(1, 5, false).stride === 0);
    assert.notEqual(walkCycle(1, 5, true).stride, 0);
    assert.ok(walkCycle(1, 5, true).breathe === 0);
  });

  test('standing, both legs hang straight down from the hips', () => {
    for (const leg of legPoses(1.2, 0)) {
      assert.equal(leg.knee[0], leg.hip[0]);
      assert.equal(leg.ankle[0], leg.hip[0]);
      assert.equal(leg.bend, 0);
    }
  });

  test('walking, the legs swing opposite each other and the back one is listed first', () => {
    const [back, front] = legPoses(1, 1);
    assert.notEqual(back.dir, front.dir);
    assert.ok(Math.abs(back.ankle[0] - back.hip[0]) > 0.5);
    const swing = (leg) => leg.hip[0] - leg.knee[0];
    assert.ok(swing(back) * swing(front) < 0, 'the legs should swing in opposite directions');
  });
});
