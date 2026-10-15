import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { playMeow, MEOW_VOLUME } from './cat-sound.js';

/** A stand-in AudioContext that records the nodes made and what's scheduled. */
function fakeAudio() {
  const log = { oscillators: [], filters: [], gains: [], connections: 0 };
  const param = (value = 0) => {
    const p = { value, events: [] };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) {
      p[m] = (v, t) => { p.events.push([m, v, t]); };
    }
    return p;
  };
  const node = (extra) => ({ connect() { log.connections++; }, ...extra });
  return {
    log,
    currentTime: 10,
    destination: {},
    createOscillator() {
      const o = node({ type: 'sine', frequency: param(440), started: null, stopped: null, start(t) { this.started = t; }, stop(t) { this.stopped = t; } });
      log.oscillators.push(o);
      return o;
    },
    createBiquadFilter() {
      const f = node({ type: 'lowpass', frequency: param(350), Q: param(1) });
      log.filters.push(f);
      return f;
    },
    createGain() {
      const g = node({ gain: param(1) });
      log.gains.push(g);
      return g;
    },
  };
}

describe('cat meow', () => {
  test('schedules a voice through two formants, starting now and stopping after its length', () => {
    const audio = fakeAudio();
    const length = playMeow(audio, 0.5);
    assert.ok(length > 0.5 && length < 0.85);
    const [voice, vibrato] = audio.log.oscillators;
    assert.equal(voice.type, 'sawtooth');
    assert.equal(voice.started, 10);
    assert.ok(voice.stopped > 10 + length);
    assert.equal(vibrato.started, 10);
    assert.equal(audio.log.filters.length, 2);
    assert.ok(audio.log.filters.every((f) => f.type === 'bandpass'));
    assert.ok(audio.log.connections >= 8);
  });

  test('the pitch rises then falls ("mee-ow"), and the formants darken', () => {
    const audio = fakeAudio();
    playMeow(audio, 0);
    const pitch = audio.log.oscillators[0].frequency.events.map(([, v]) => v);
    assert.ok(pitch[1] > pitch[0] && pitch[2] < pitch[1]);
    for (const f of audio.log.filters) {
      const events = f.frequency.events.map(([, v]) => v);
      assert.ok(events.at(-1) < events[0], 'ends darker than it starts');
    }
  });

  test('swells to MEOW_VOLUME and fades out', () => {
    const audio = fakeAudio();
    playMeow(audio, 1);
    const envelope = audio.log.gains.find((g) => g.gain.events.some(([, v]) => v === MEOW_VOLUME));
    assert.ok(envelope);
    assert.equal(envelope.gain.events.at(-1)[1], 0.0001);
  });

  test('different rolls give different meows', () => {
    const a = fakeAudio();
    const b = fakeAudio();
    assert.notEqual(playMeow(a, 0), playMeow(b, 1));
  });
});
