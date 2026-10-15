// Hospital Shift's cat meow (the user: "when you pet the cat i want there to
// be a meowing sound"). Synthesized with the Web Audio API — no sound file
// to fetch, cache or license. A meow is a "mee-ow": a pitch that rises
// then falls, through two vowel-like filters (formants) sweeping from an
// "ee" to an "ow", with a quick swell and fade and a touch of vibrato.
// Each call varies the pitch and length a little so repeat pets don't
// sound robotic. No DOM; the caller owns the AudioContext.

/**
 * The envelope's peak gain. The narrow formant filters soak up most of the
 * sawtooth's energy, so this lands the meow at about a third of full scale:
 * clearly audible, never loud.
 */
export const MEOW_VOLUME = 0.75;

/**
 * Schedules one meow on `audio` (an AudioContext) starting now. `roll` is
 * 0..1 and varies the pitch and length. Returns the meow's length in
 * seconds.
 */
export function playMeow(audio, roll = Math.random()) {
  const t0 = audio.currentTime;
  const length = 0.55 + roll * 0.25;
  const base = 520 + roll * 160;

  // The voice: a sawtooth (rich in harmonics for the formants to shape),
  // its pitch rising into the "ee" then falling through the "ow".
  const voice = audio.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(base * 0.85, t0);
  voice.frequency.linearRampToValueAtTime(base * 1.35, t0 + length * 0.3);
  voice.frequency.linearRampToValueAtTime(base * 0.75, t0 + length);

  // A little vibrato on the pitch.
  const vibrato = audio.createOscillator();
  vibrato.frequency.value = 6;
  const vibratoDepth = audio.createGain();
  vibratoDepth.gain.value = base * 0.02;
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(voice.frequency);

  // Two formants sweeping from "ee" (bright) to "ow" (dark), mixed.
  const mix = audio.createGain();
  mix.gain.value = 1;
  for (const [from, to, q, level] of [[2400, 800, 6, 1], [3600, 1300, 8, 0.5]]) {
    const formant = audio.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = q;
    formant.frequency.setValueAtTime(from, t0);
    formant.frequency.linearRampToValueAtTime(from * 1.05, t0 + length * 0.3);
    formant.frequency.exponentialRampToValueAtTime(to, t0 + length);
    const gain = audio.createGain();
    gain.gain.value = level;
    voice.connect(formant);
    formant.connect(gain);
    gain.connect(mix);
  }

  // Envelope: a quick swell, a held middle, then a soft fade.
  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(0.0001, t0);
  envelope.gain.exponentialRampToValueAtTime(MEOW_VOLUME, t0 + 0.06);
  envelope.gain.setValueAtTime(MEOW_VOLUME, t0 + length * 0.55);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  mix.connect(envelope);
  envelope.connect(audio.destination);

  voice.start(t0);
  vibrato.start(t0);
  voice.stop(t0 + length + 0.05);
  vibrato.stop(t0 + length + 0.05);
  return length;
}
