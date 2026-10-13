// Hospital Shift's patients, staff and Karen, drawn in Kimono Himura's anime style
// (web/static/js/hospital/kimono-himura.js) instead of the shared people.js
// chibi bodies — the user asked for "many different patients designs"
// that look like Kimono, with mixed outfits: some in kimono or yukata,
// others in everyday Japanese clothes (school uniforms, a salaryman's
// suit, hoodies, a grandma's cardigan…). The staff (Dr. Okafor, the
// Orderly, the Stock tech) and Karen followed ("the staff and karen to
// also match kimonos style") — STAFF_DESIGNS below.
//
// Pure canvas drawing (no DOM). `drawAnimePatient(ctx, x, y, design, opts)`
// is anchored at the feet like drawPerson, so callers keep their
// positions. A design is plain data (PATIENT_DESIGNS); the body is drawn
// in adult coordinates (shoulders at y = -40, feet at 0) and scaled per
// age, and the head is drawn around its own center.

const LINE = 'rgba(24,18,44,0.6)';
const GOLD = '#e8c25a';

/** Body proportions per age: horizontal/vertical body scale and head size. */
const AGES = {
  adult: { bx: 1, by: 1, head: 1 },
  teen: { bx: 0.94, by: 0.92, head: 1 },
  kid: { bx: 0.84, by: 0.64, head: 0.94 },
  elder: { bx: 1.02, by: 0.95, head: 1 },
};

/** Face center relative to the feet, for an age (the bed/oxygen scenes place masks with it). */
export function animeHeadCenterY(design) {
  const a = AGES[design?.age] ?? AGES.adult;
  // 12 (was 15): the chin now sits just above the collar — the user found
  // the necks "too long".
  return -40 * a.by - 12 * a.head;
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

const SKIN = {
  porcelain: '#fbe3d3',
  light: '#f6d6bd',
  warm: '#efc49f',
  tan: '#dca578',
  brown: '#b97c52',
  deep: '#8a5636',
};

/**
 * Sixteen patients. Fields: key, label, age, skin, hair {color, back,
 * fringe}, eyes {color, style, lashes}, brows ('thin'|'thick'), mouth,
 * outfit {kind, …colors/pattern}, extras (glasses, mask, mustache, beard,
 * clip, ribbon, cap, headphones, pearls, earrings).
 */
export const PATIENT_DESIGNS = [
  {
    key: 'obaachan', label: 'Grandma', age: 'elder', skin: SKIN.light,
    hair: { color: '#c9c6cf', back: 'bun', fringe: 'parted' },
    eyes: { color: '#5a4636', style: 'smile' }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'kimono', robe: '#6a4a8a', robeHem: '#4a3266', pattern: 'asanoha', patternColor: '#d9c8ef', obi: '#8a6a3a', obiAccent: '#e8d29a' },
    extras: { glasses: 'round' },
  },
  {
    key: 'ojiichan', label: 'Grandpa', age: 'elder', skin: SKIN.warm,
    hair: { color: '#e6e3dc', back: 'none', fringe: 'bald' },
    eyes: { color: '#3a2e26', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'kimono', robe: '#3e4a44', robeHem: '#2e3833', pattern: 'stripes', patternColor: '#5c6a63', obi: '#2a2622', obiAccent: '#8a7a5a', mens: true },
    extras: { mustache: '#e6e3dc' },
  },
  {
    key: 'salaryman', label: 'Salaryman', age: 'adult', skin: SKIN.light,
    hair: { color: '#1e1a22', back: 'short', fringe: 'side' },
    eyes: { color: '#2e2a3a', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'suit', top: '#3a4256', shirt: '#f4f4f2', tie: '#3a62a8', bottom: '#3a4256', shoes: '#1e1e22' },
    extras: { glasses: 'square', mask: true },
  },
  {
    key: 'officeLady', label: 'Office worker', age: 'adult', skin: SKIN.porcelain,
    hair: { color: '#5a3a26', back: 'bob', fringe: 'side' },
    eyes: { color: '#6a3e2a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'blouse', top: '#f2e6d6', skirt: '#2e3a5a', legs: '#e8d2c2', shoes: '#2a2226' },
    extras: { earrings: GOLD },
  },
  {
    key: 'schoolgirl', label: 'Student', age: 'teen', skin: SKIN.porcelain,
    hair: { color: '#1b1828', back: 'long', fringe: 'blunt' },
    eyes: { color: '#3a5a8a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'sailor', top: '#ffffff', collar: '#24305a', scarf: '#d23a4a', skirt: '#24305a', legs: '#f2f2f2', shoes: '#3a2a22' },
    extras: { clip: '#f2c94c' },
  },
  {
    key: 'schoolboy', label: 'Student', age: 'teen', skin: SKIN.warm,
    hair: { color: '#2a2030', back: 'short', fringe: 'messy' },
    eyes: { color: '#3a2a20', style: 'round' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'gakuran', top: '#1e1e2a', bottom: '#1e1e2a', buttons: GOLD, shoes: '#2a2226' },
    extras: {},
  },
  {
    key: 'kidBoy', label: 'Kid', age: 'kid', skin: SKIN.tan,
    hair: { color: '#3a2618', back: 'short', fringe: 'messy' },
    eyes: { color: '#4a2e1a', style: 'big' }, brows: 'thin', mouth: 'open',
    outfit: { kind: 'tee', top: '#f2b23a', print: '#ffffff', bottom: '#3a62a8', legs: null, shoes: '#e06a5b' },
    extras: { cap: '#d23a4a' },
  },
  {
    key: 'kidGirl', label: 'Kid', age: 'kid', skin: SKIN.porcelain,
    hair: { color: '#6a3a22', back: 'twintails', fringe: 'blunt' },
    eyes: { color: '#2e6a4a', style: 'big', lashes: true }, brows: 'thin', mouth: 'open',
    outfit: { kind: 'dress', top: '#f6e05a', skirt: '#f6e05a', trim: '#ffffff', legs: '#ffffff', shoes: '#d23a4a' },
    extras: { ribbon: '#e04a6a' },
  },
  {
    key: 'yukataGirl', label: 'Festival-goer', age: 'teen', skin: SKIN.light,
    hair: { color: '#2a1e2a', back: 'ponytail', fringe: 'side' },
    eyes: { color: '#7a3a5a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'kimono', robe: '#2e6ab0', robeHem: '#24548e', pattern: 'circles', patternColor: '#ffffff', obi: '#f2a6c0', obiAccent: '#ffffff', yukata: true },
    extras: { clip: '#ffffff' },
  },
  {
    key: 'yukataMan', label: 'Festival-goer', age: 'adult', skin: SKIN.tan,
    hair: { color: '#1e1a22', back: 'short', fringe: 'parted' },
    eyes: { color: '#2e2a26', style: 'calm' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'kimono', robe: '#2a2e48', robeHem: '#22263c', pattern: 'stripes', patternColor: '#6a74a8', obi: '#c9a26a', obiAccent: '#8a6a3a', yukata: true, mens: true },
    extras: {},
  },
  {
    key: 'hoodieTeen', label: 'Gamer', age: 'teen', skin: SKIN.brown,
    hair: { color: '#2a1a12', back: 'short', fringe: 'messy' },
    eyes: { color: '#2a1a12', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'hoodie', top: '#4fae7a', bottom: '#3a3a48', shoes: '#f2f2f2' },
    extras: { headphones: '#2a2a33' },
  },
  {
    key: 'pastelArtist', label: 'Illustrator', age: 'adult', skin: SKIN.porcelain,
    hair: { color: '#f2a6c4', back: 'long', fringe: 'blunt' },
    eyes: { color: '#6a4aa8', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#cfe6f2', inner: '#ffffff', skirt: '#8a7ab8', legs: '#f2e6ee', shoes: '#6a4a5a' },
    extras: {},
  },
  {
    key: 'athlete', label: 'Runner', age: 'adult', skin: SKIN.tan,
    hair: { color: '#3a2218', back: 'ponytail', fringe: 'side' },
    eyes: { color: '#4a2a1a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'track', top: '#d23a4a', stripe: '#ffffff', bottom: '#d23a4a', shoes: '#f2f2f2' },
    extras: {},
  },
  {
    key: 'mother', label: 'Parent', age: 'adult', skin: SKIN.deep,
    hair: { color: '#1e1412', back: 'medium', fringe: 'parted' },
    eyes: { color: '#2a1a12', style: 'calm', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'apron', top: '#b8664a', apron: '#f2ead8', skirt: '#5a4a3a', legs: '#4a3a2e', shoes: '#3a2a22' },
    extras: {},
  },
  {
    key: 'grandmaCardigan', label: 'Grandma', age: 'elder', skin: SKIN.warm,
    hair: { color: '#f2f0ec', back: 'bob', fringe: 'parted' },
    eyes: { color: '#4a3a2e', style: 'smile' }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#8aa66a', inner: '#f2ead8', skirt: '#6a5a4a', legs: '#c9b6a4', shoes: '#4a3a32' },
    extras: { pearls: true },
  },
  {
    key: 'delinquent', label: 'Biker', age: 'adult', skin: SKIN.light,
    hair: { color: '#e8c85a', back: 'short', fringe: 'messy' },
    eyes: { color: '#3a2a1a', style: 'sharp' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'jacket', top: '#24242c', inner: '#f2f2f2', bottom: '#3a4a6a', shoes: '#1e1e22' },
    extras: { earrings: '#c8ccd4' },
  },
];

export const PATIENT_DESIGN_KEYS = PATIENT_DESIGNS.map((d) => d.key);

export function findPatientDesign(key) {
  return PATIENT_DESIGNS.find((d) => d.key === key) ?? PATIENT_DESIGNS[0];
}

/** The ER's background staff and Karen, keyed like hospital-game.js's AMBIENT_STAFF. */
export const STAFF_DESIGNS = {
  doctor: {
    key: 'doctor', label: 'Dr. Okafor', age: 'adult', skin: SKIN.deep,
    hair: { color: '#141012', back: 'short', fringe: 'textured' },
    eyes: { color: '#2a1a12', style: 'calm' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'labcoat', top: '#f7f7f4', shirt: '#9ab8dc', tie: '#2e3a5a', bottom: '#3e4a5c', shoes: '#1e1e22' },
    extras: { glasses: 'square', stethoscope: '#34343e' },
  },
  orderly: {
    key: 'orderly', label: 'Orderly', age: 'adult', skin: SKIN.light,
    hair: { color: '#5a3a22', back: 'short', fringe: 'textured' },
    eyes: { color: '#3a2a1a', style: 'round' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'scrubs', top: '#8fb0dc', bottom: '#7a9ac6', shoes: '#f2f2f2' },
    extras: {},
  },
  stockTech: {
    key: 'stockTech', label: 'Stock tech', age: 'adult', skin: SKIN.tan,
    // Softer rounded tufts under the beanie (the user asked for his hair softer).
    hair: { color: '#2a1c14', back: 'short', fringe: 'messy' },
    eyes: { color: '#2a1a12', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'scrubs', top: '#c9a26a', bottom: '#4a4a5a', shoes: '#4a3a32', vest: true },
    extras: { beanie: '#3f7a6a' },
  },
  karen: {
    key: 'karen', label: 'Karen', age: 'adult', skin: SKIN.light,
    hair: { color: '#e2bf5a', back: 'bob', fringe: 'side', streaks: '#8a6a2a' },
    eyes: { color: '#4a6a8a', style: 'sharp', lashes: true }, brows: 'thin', mouth: 'flat', mood: 'angry',
    outfit: { kind: 'blazer', top: '#d23a4a', inner: '#f2ead8', bottom: '#2e2a30', shoes: '#2a2020' },
    extras: { sunglasses: true, earrings: GOLD, handbag: '#8a5a3a' },
  },
};

/** Any anime design by key — patient, staff or Karen. */
export function findAnimeDesign(key) {
  return STAFF_DESIGNS[key] ?? findPatientDesign(key);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function outline(ctx, width = 0.55) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function fillPath(ctx, color, width = 0.55) {
  ctx.fillStyle = color;
  ctx.fill();
  outline(ctx, width);
}

function rr(ctx, x, y, w, h, r, color, line = 0.5) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  if (line) outline(ctx, line);
}

function blossom(ctx, cx, cy, r, petal, core) {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.52, r * 0.4, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet center
 * @param {number} y - feet line
 * @param {object} design - one of PATIENT_DESIGNS
 * @param {{scale?: number, t?: number, angryTint?: boolean}} [opts]
 *   angryTint: Karen's reddened face during her outburst.
 */
export function drawAnimePatient(ctx, x, y, design, opts = {}) {
  const d = design ?? PATIENT_DESIGNS[0];
  const k = opts.scale ?? 1;
  const t = opts.t ?? 0;
  const a = AGES[d.age] ?? AGES.adult;
  const headCY = animeHeadCenterY(d);
  const breathe = Math.sin(t * 1.6 + d.key.length) * 0.35;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 8 * Math.max(0.8, a.by), 14 * a.bx, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -breathe);
  // Hair that hangs behind the body, in the head's frame.
  ctx.save();
  ctx.translate(0, headCY);
  ctx.scale(a.head, a.head);
  drawBackHair(ctx, d);
  ctx.restore();

  ctx.save();
  ctx.scale(a.bx, a.by);
  drawBody(ctx, d);
  ctx.restore();

  ctx.save();
  ctx.translate(0, headCY);
  ctx.scale(a.head, a.head);
  drawHead(ctx, d, Boolean(opts.angryTint));
  ctx.restore();
  ctx.restore();
}

/** Same renderer, for the staff and Karen (reads better at call sites). */
export const drawAnimePerson = drawAnimePatient;

// ---------------------------------------------------------------------------
// Body (adult coordinates: shoulders y = -40, waist -19, feet 0)
// ---------------------------------------------------------------------------

function drawBody(ctx, d) {
  const o = d.outfit;
  if (o.kind === 'kimono') {
    drawKimono(ctx, d);
    return;
  }
  drawLegs(ctx, d);
  // Arms hang at the sides behind the torso edges.
  for (const dir of [-1, 1]) drawArm(ctx, d, dir);
  const draw = {
    suit: drawSuit, blouse: drawBlouse, sailor: drawSailor, gakuran: drawGakuran,
    tee: drawTee, dress: drawDress, hoodie: drawHoodie, cardigan: drawCardigan,
    track: drawTrack, apron: drawApron, jacket: drawJacket,
    labcoat: drawLabcoat, scrubs: drawScrubs, blazer: drawBlazer,
  }[o.kind];
  draw?.(ctx, d);
  ctx.save();
  torsoPath(ctx, -40, -15, 12.3);
  ctx.clip();
  ctx.fillStyle = 'rgba(20,10,40,0.12)';
  ctx.fillRect(5.5, -42, 9, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-9.5, -40, 3, 24);
  ctx.restore();
  drawNeck(ctx, d);
  if (d.extras?.handbag) drawHandbag(ctx, d.extras.handbag);
}

function drawLabcoat(ctx, d) {
  const o = d.outfit;
  // Shirt and tie under a long, open white coat with pockets.
  torsoPath(ctx, -40, -18.5, 10.5);
  fillPath(ctx, o.shirt);
  ctx.beginPath();
  ctx.moveTo(-1.2, -38.6);
  ctx.lineTo(1.2, -38.6);
  ctx.lineTo(1.6, -26);
  ctx.lineTo(0, -24);
  ctx.lineTo(-1.6, -26);
  ctx.closePath();
  fillPath(ctx, o.tie, 0.35);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4, -40);
    ctx.quadraticCurveTo(dir * 11.8, -39.5, dir * 12, -34);
    ctx.lineTo(dir * 12.6, -4);
    ctx.lineTo(dir * 3.4, -4);
    ctx.lineTo(dir * 3.4, -24);
    ctx.lineTo(dir * 2, -30);
    ctx.closePath();
    fillPath(ctx, o.top);
    rr(ctx, dir * 8 - 3, -15, 6, 4.4, 0.8, shade(o.top, -0.05), 0.35);
  }
  rr(ctx, 6.4, -33, 3.6, 3, 0.6, shade(o.top, -0.05), 0.3);
  rr(ctx, 7.8, -35.4, 0.8, 3.4, 0.3, '#3a62a8', 0);
  if (d.extras?.stethoscope) {
    ctx.strokeStyle = d.extras.stethoscope;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.6, -39.6);
    ctx.quadraticCurveTo(-6, -31, -3.2, -27.6);
    ctx.moveTo(4.6, -39.6);
    ctx.quadraticCurveTo(5, -33, 1.6, -30.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3, -27, 1.3, 0, Math.PI * 2);
    fillPath(ctx, '#c8ccd4', 0.3);
  }
}

function drawScrubs(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -16, 11.5);
  fillPath(ctx, o.top);
  // V-neck and a chest pocket with a pen.
  ctx.beginPath();
  ctx.moveTo(-4, -40);
  ctx.lineTo(0, -33.5);
  ctx.lineTo(4, -40);
  ctx.closePath();
  fillPath(ctx, shade(o.top, -0.25), 0.4);
  rr(ctx, 3.4, -30, 5, 4.2, 0.6, shade(o.top, -0.08), 0.35);
  rr(ctx, 6.6, -32, 0.8, 3, 0.3, '#3a62a8', 0);
  if (o.vest) {
    // The Stock tech's utility vest with a hi-vis stripe.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 4.4, -39.6);
      ctx.lineTo(dir * 11, -36);
      ctx.lineTo(dir * 11, -16.5);
      ctx.lineTo(dir * 2.2, -16.5);
      ctx.closePath();
      fillPath(ctx, '#556a5a', 0.45);
      rr(ctx, dir < 0 ? -10.6 : 2.6, -24, 8, 1.4, 0.4, '#e8d84a', 0);
    }
  }
}

function drawBlazer(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -15, 12);
  fillPath(ctx, o.top);
  ctx.beginPath();
  ctx.moveTo(-3.6, -40);
  ctx.lineTo(3.6, -40);
  ctx.lineTo(0, -26);
  ctx.closePath();
  fillPath(ctx, o.inner, 0.4);
  // Sharp lapels and two gold buttons.
  ctx.fillStyle = shade(o.top, -0.18);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, -40);
    ctx.lineTo(dir * 8.6, -36.4);
    ctx.lineTo(dir * 5.4, -33.6);
    ctx.lineTo(dir * 7, -31);
    ctx.lineTo(0, -26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = GOLD;
  for (const by of [-23, -19]) {
    ctx.beginPath();
    ctx.arc(0, by, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHandbag(ctx, color) {
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(-14, -20, 3, Math.PI, 0);
  ctx.stroke();
  rr(ctx, -18, -20, 8, 7, 1.4, color, 0.45);
  rr(ctx, -15, -18.4, 2, 1, 0.4, GOLD, 0);
}

function torsoPath(ctx, top = -40, bottom = -18, w = 11.5) {
  ctx.beginPath();
  ctx.moveTo(-5, top);
  ctx.quadraticCurveTo(-w, top + 0.2, -w, top + 4);
  ctx.lineTo(-w + 0.8, bottom);
  ctx.lineTo(w - 0.8, bottom);
  ctx.lineTo(w, top + 4);
  ctx.quadraticCurveTo(w, top + 0.2, 5, top);
  ctx.closePath();
}

function drawNeck(ctx, d) {
  rr(ctx, -2.6, -42.5, 5.2, 4, 2, d.skin, 0);
  ctx.fillStyle = shade(d.skin, -0.12);
  ctx.beginPath();
  ctx.moveTo(-2.6, -41);
  ctx.lineTo(2.6, -41);
  ctx.lineTo(0, -38.4);
  ctx.closePath();
  ctx.fill();
}

function drawLegs(ctx, d) {
  const o = d.outfit;
  const legColor = o.legs ?? o.bottom ?? d.skin;
  // Fuller legs (the user: "they are too thin"): wider at the thigh,
  // tapering a little to the ankle, on wider shoes.
  for (const dir of [-1, 1]) {
    const cx = dir * 3.7;
    ctx.beginPath();
    ctx.moveTo(cx - 3.3, -19);
    ctx.lineTo(cx + 3.3, -19);
    ctx.lineTo(cx + 2.7, 3.6);
    ctx.quadraticCurveTo(cx, 4.6, cx - 2.7, 3.6);
    ctx.closePath();
    fillPath(ctx, legColor, 0.5);
    rr(ctx, cx - 3.7 + dir * 0.3, 2.8, 7.4, 4.4, 2.1, o.shoes ?? '#3a2a22');
  }
}

function drawArm(ctx, d, dir, sleeve) {
  const color = sleeve ?? d.outfit.top;
  ctx.beginPath();
  ctx.moveTo(dir * 9.5, -39);
  ctx.quadraticCurveTo(dir * 14.2, -38, dir * 14.2, -33);
  ctx.lineTo(dir * 13.8, -20);
  ctx.lineTo(dir * 10.2, -20);
  ctx.lineTo(dir * 10.6, -33);
  ctx.closePath();
  fillPath(ctx, color);
  ctx.beginPath();
  ctx.ellipse(dir * 12, -18.4, 2.3, 2.5, 0, 0, Math.PI * 2);
  fillPath(ctx, d.skin, 0.4);
}

function drawSuit(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx);
  fillPath(ctx, o.top);
  // Shirt V, tie, lapels and buttons.
  ctx.beginPath();
  ctx.moveTo(-4.2, -40);
  ctx.lineTo(0, -29);
  ctx.lineTo(4.2, -40);
  ctx.closePath();
  fillPath(ctx, o.shirt, 0.4);
  ctx.beginPath();
  ctx.moveTo(-1.2, -38.6);
  ctx.lineTo(1.2, -38.6);
  ctx.lineTo(1.6, -30.5);
  ctx.lineTo(0, -28.6);
  ctx.lineTo(-1.6, -30.5);
  ctx.closePath();
  fillPath(ctx, o.tie, 0.35);
  ctx.strokeStyle = shade(o.top, -0.3);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-4.4, -40);
  ctx.lineTo(-1, -26);
  ctx.moveTo(4.4, -40);
  ctx.lineTo(1, -26);
  ctx.stroke();
  ctx.fillStyle = shade(o.top, -0.35);
  for (const by of [-25, -21.5]) {
    ctx.beginPath();
    ctx.arc(0.6, by, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBlouse(ctx, d) {
  const o = d.outfit;
  // Pencil skirt, then the blouse tucked in.
  ctx.beginPath();
  ctx.moveTo(-10.5, -20);
  ctx.lineTo(10.5, -20);
  ctx.lineTo(9.6, -6);
  ctx.lineTo(-9.6, -6);
  ctx.closePath();
  fillPath(ctx, o.skirt);
  torsoPath(ctx, -40, -19.5, 11);
  fillPath(ctx, o.top);
  ctx.fillStyle = '#ffffff';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(dir * 5, -40.2);
    ctx.lineTo(dir * 3.2, -34.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = shade(o.top, -0.25);
  for (const by of [-33, -29, -25]) {
    ctx.beginPath();
    ctx.arc(0, by, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSailor(ctx, d) {
  const o = d.outfit;
  // Pleated skirt.
  ctx.beginPath();
  ctx.moveTo(-10.5, -20);
  ctx.lineTo(10.5, -20);
  ctx.lineTo(13, -5);
  ctx.lineTo(-13, -5);
  ctx.closePath();
  fillPath(ctx, o.skirt);
  ctx.strokeStyle = shade(o.skirt, 0.18);
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, -20);
    ctx.lineTo(i * 3.9, -5);
    ctx.stroke();
  }
  torsoPath(ctx, -40, -19.5, 11);
  fillPath(ctx, o.top);
  // Sailor collar with white stripes, and a red scarf bow.
  ctx.beginPath();
  ctx.moveTo(-11, -36);
  ctx.lineTo(-5, -40);
  ctx.lineTo(0, -28);
  ctx.lineTo(5, -40);
  ctx.lineTo(11, -36);
  ctx.lineTo(11, -33);
  ctx.lineTo(3, -33);
  ctx.lineTo(0, -26.5);
  ctx.lineTo(-3, -33);
  ctx.lineTo(-11, -33);
  ctx.closePath();
  fillPath(ctx, o.collar, 0.45);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-10.5, -34);
  ctx.lineTo(-3.6, -34);
  ctx.moveTo(10.5, -34);
  ctx.lineTo(3.6, -34);
  ctx.stroke();
  ctx.fillStyle = o.scarf;
  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(-4, -31.5);
  ctx.lineTo(-3.6, -27);
  ctx.closePath();
  ctx.moveTo(0, -29);
  ctx.lineTo(4, -31.5);
  ctx.lineTo(3.6, -27);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1, -29);
  ctx.lineTo(1, -29);
  ctx.lineTo(2.2, -22);
  ctx.lineTo(-2.2, -22);
  ctx.closePath();
  ctx.fill();
}

function drawGakuran(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -16, 11.5);
  fillPath(ctx, o.top);
  // Stand collar and the row of gold buttons.
  rr(ctx, -4.2, -41.5, 8.4, 3, 1, shade(o.top, 0.15), 0.4);
  rr(ctx, -1.6, -41.2, 3.2, 1, 0.4, '#ffffff', 0);
  ctx.fillStyle = o.buttons;
  for (const by of [-35, -31, -27, -23, -19]) {
    ctx.beginPath();
    ctx.arc(0, by, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTee(ctx, d) {
  const o = d.outfit;
  // Shorts first, then the tee with a star print.
  ctx.beginPath();
  ctx.moveTo(-10, -20);
  ctx.lineTo(10, -20);
  ctx.lineTo(10.4, -10);
  ctx.lineTo(0.8, -10);
  ctx.lineTo(0, -14);
  ctx.lineTo(-0.8, -10);
  ctx.lineTo(-10.4, -10);
  ctx.closePath();
  fillPath(ctx, o.bottom);
  torsoPath(ctx, -40, -18.5, 11);
  fillPath(ctx, o.top);
  ctx.fillStyle = o.print;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 2 : 4.6;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(ang) * r;
    const py = -29 + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDress(ctx, d) {
  const o = d.outfit;
  ctx.beginPath();
  ctx.moveTo(-5, -40);
  ctx.quadraticCurveTo(-11, -39.5, -11, -34);
  ctx.lineTo(-10, -21);
  ctx.lineTo(-14.5, -4);
  ctx.quadraticCurveTo(0, -1.6, 14.5, -4);
  ctx.lineTo(10, -21);
  ctx.lineTo(11, -34);
  ctx.quadraticCurveTo(11, -39.5, 5, -40);
  ctx.closePath();
  fillPath(ctx, o.top);
  ctx.strokeStyle = o.trim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14, -5.2);
  ctx.quadraticCurveTo(0, -2.8, 14, -5.2);
  ctx.stroke();
  // A white Peter Pan collar and a sash.
  ctx.fillStyle = o.trim;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 3, -38.6, 3.6, 2.2, dir * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  rr(ctx, -10.4, -22.6, 20.8, 2.2, 1, shade(o.top, -0.15), 0.35);
}

function drawHoodie(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -15, 12);
  fillPath(ctx, o.top);
  // The hood bunched behind the neck, drawstrings, kangaroo pocket.
  ctx.beginPath();
  ctx.ellipse(0, -40, 8, 3.2, 0, 0, Math.PI * 2);
  fillPath(ctx, shade(o.top, -0.18), 0.45);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-2, -38);
  ctx.lineTo(-2.4, -31);
  ctx.moveTo(2, -38);
  ctx.lineTo(2.4, -31);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6.5, -25);
  ctx.lineTo(6.5, -25);
  ctx.lineTo(8, -17.5);
  ctx.lineTo(-8, -17.5);
  ctx.closePath();
  fillPath(ctx, shade(o.top, -0.08), 0.45);
}

function drawCardigan(ctx, d) {
  const o = d.outfit;
  ctx.beginPath();
  ctx.moveTo(-10.5, -20);
  ctx.lineTo(10.5, -20);
  ctx.lineTo(12, -3);
  ctx.lineTo(-12, -3);
  ctx.closePath();
  fillPath(ctx, o.skirt);
  torsoPath(ctx, -40, -17, 11.5);
  fillPath(ctx, o.top);
  // The inner blouse between open fronts, buttons down the edge.
  ctx.beginPath();
  ctx.moveTo(-3.8, -40);
  ctx.lineTo(3.8, -40);
  ctx.lineTo(2.2, -17.5);
  ctx.lineTo(-2.2, -17.5);
  ctx.closePath();
  fillPath(ctx, o.inner, 0.4);
  ctx.fillStyle = shade(o.top, -0.3);
  for (const by of [-34, -29, -24, -19.5]) {
    ctx.beginPath();
    ctx.arc(-3.4, by, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (d.extras?.pearls) {
    ctx.fillStyle = '#fbf6ee';
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(i * 0.95, -38.6 + Math.abs(i) * -0.35 + 2.4, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrack(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -16.5, 11.8);
  fillPath(ctx, o.top);
  ctx.strokeStyle = shade(o.top, -0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(0, -16.5);
  ctx.stroke();
  rr(ctx, -3.6, -41.6, 7.2, 2.6, 1, shade(o.top, -0.1), 0.4);
  // White stripes down the sleeves and trouser legs.
  ctx.strokeStyle = o.stripe;
  ctx.lineWidth = 0.8;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 13.6, -35);
    ctx.lineTo(dir * 13.4, -21);
    ctx.moveTo(dir * 5.4, -15);
    ctx.lineTo(dir * 5.4, 2.5);
    ctx.stroke();
  }
}

function drawApron(ctx, d) {
  const o = d.outfit;
  ctx.beginPath();
  ctx.moveTo(-10.5, -20);
  ctx.lineTo(10.5, -20);
  ctx.lineTo(12, -3);
  ctx.lineTo(-12, -3);
  ctx.closePath();
  fillPath(ctx, o.skirt);
  torsoPath(ctx, -40, -18.5, 11.5);
  fillPath(ctx, o.top);
  // Apron bib and skirt, with ties.
  ctx.beginPath();
  ctx.moveTo(-5.5, -35);
  ctx.lineTo(5.5, -35);
  ctx.lineTo(6.5, -21);
  ctx.lineTo(10, -20);
  ctx.lineTo(10.6, -6);
  ctx.lineTo(-10.6, -6);
  ctx.lineTo(-10, -20);
  ctx.lineTo(-6.5, -21);
  ctx.closePath();
  fillPath(ctx, o.apron, 0.45);
  ctx.strokeStyle = shade(o.apron, -0.2);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-5.5, -35);
  ctx.lineTo(-7.5, -40);
  ctx.moveTo(5.5, -35);
  ctx.lineTo(7.5, -40);
  ctx.stroke();
  rr(ctx, -4, -16, 8, 5, 1, shade(o.apron, -0.06), 0.35);
}

function drawJacket(ctx, d) {
  const o = d.outfit;
  torsoPath(ctx, -40, -14, 12.2);
  fillPath(ctx, o.top);
  ctx.beginPath();
  ctx.moveTo(-4, -40);
  ctx.lineTo(4, -40);
  ctx.lineTo(2.6, -15);
  ctx.lineTo(-2.6, -15);
  ctx.closePath();
  fillPath(ctx, o.inner, 0.4);
  // Wide lapels and a silver zip pull.
  ctx.fillStyle = shade(o.top, 0.12);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4, -40);
    ctx.lineTo(dir * 9, -37);
    ctx.lineTo(dir * 3.2, -28);
    ctx.closePath();
    ctx.fill();
  }
  rr(ctx, 3.4, -25, 1, 2.6, 0.4, '#c8ccd4', 0);
}

// -- Kimono / yukata ------------------------------------------------------------

function drawKimono(ctx, d) {
  const o = d.outfit;
  // Feet: tabi with zori, or bare feet in geta for a yukata.
  for (const dir of [-1, 1]) {
    const fx = dir * 4.2;
    rr(ctx, fx - 3.6, 5.2, 7.2, 3.2, 1.6, o.yukata ? '#b08a5a' : '#7a4a32', 0.4);
    rr(ctx, fx - 2.8, 2.6, 5.6, 3.6, 2, o.yukata ? d.skin : '#ffffff', 0.4);
  }
  // Robe.
  const robe = () => {
    ctx.beginPath();
    ctx.moveTo(-6, -40);
    ctx.quadraticCurveTo(-12.5, -39, -12.5, -33);
    ctx.lineTo(-11.2, 4.5);
    ctx.quadraticCurveTo(0, 6.2, 11.2, 4.5);
    ctx.lineTo(12.5, -33);
    ctx.quadraticCurveTo(12.5, -39, 6, -40);
    ctx.closePath();
  };
  const grad = ctx.createLinearGradient(0, -40, 0, 5);
  grad.addColorStop(0, o.robe);
  grad.addColorStop(0.6, o.robe);
  grad.addColorStop(1, o.robeHem ?? o.robe);
  robe();
  ctx.fillStyle = grad;
  ctx.fill();
  outline(ctx);
  ctx.save();
  robe();
  ctx.clip();
  drawPattern(ctx, o, -14, -42, 28, 48);
  ctx.fillStyle = 'rgba(20,10,30,0.18)';
  ctx.fillRect(5, -42, 9, 50);
  ctx.strokeStyle = 'rgba(20,10,30,0.4)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(2.4, -19);
  ctx.quadraticCurveTo(3.6, -6, 5.2, 5);
  ctx.stroke();
  ctx.restore();
  // Shorter sleeves than Kimono Himura's furisode.
  for (const dir of [-1, 1]) {
    const sleeve = () => {
      ctx.beginPath();
      ctx.moveTo(dir * 9, -39);
      ctx.quadraticCurveTo(dir * 15.5, -38, dir * 15.8, -30);
      ctx.lineTo(dir * 15.8, -19);
      ctx.quadraticCurveTo(dir * 15.8, -15.5, dir * 12.5, -15.5);
      ctx.lineTo(dir * 7.5, -15.5);
      ctx.lineTo(dir * 4, -15.5);
      ctx.lineTo(dir * 8, -33);
      ctx.closePath();
    };
    sleeve();
    ctx.fillStyle = o.robe;
    ctx.fill();
    outline(ctx);
    ctx.save();
    sleeve();
    ctx.clip();
    drawPattern(ctx, o, dir < 0 ? -17 : 3, -40, 14, 26);
    ctx.restore();
  }
  // Hands folded in front.
  for (const [hx, rot] of [[-1.8, 0.25], [1.6, -0.2]]) {
    ctx.beginPath();
    ctx.ellipse(hx, -16.2, 2.3, 1.35, rot, 0, Math.PI * 2);
    fillPath(ctx, d.skin, 0.4);
  }
  // Obi: a wide sash for women, a narrow kaku-obi worn low for men.
  if (o.mens) {
    rr(ctx, -12, -22.5, 24, 3.6, 0.6, o.obi, 0.45);
    ctx.strokeStyle = o.obiAccent;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-11.8, -20.7);
    ctx.lineTo(11.8, -20.7);
    ctx.stroke();
  } else {
    rr(ctx, -12, -28, 24, o.yukata ? 6.5 : 8.5, 1, o.obi, 0.5);
    ctx.strokeStyle = o.obiAccent;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-11.8, -24.2);
    ctx.lineTo(11.8, -24.2);
    ctx.stroke();
  }
  drawNeck(ctx, d);
  // Crossed collar: wearer's left over right.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4.4, -41);
    ctx.quadraticCurveTo(dir * 3.4, -35, dir * -1.2, o.mens ? -23 : -28.4);
    ctx.strokeStyle = o.yukata ? shade(o.robe, 0.25) : '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function drawPattern(ctx, o, x, y, w, h) {
  const c = o.patternColor;
  if (o.pattern === 'stripes') {
    ctx.strokeStyle = c;
    ctx.lineWidth = 0.6;
    for (let px = x; px < x + w; px += 2.4) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();
    }
  } else if (o.pattern === 'circles') {
    ctx.strokeStyle = c;
    ctx.lineWidth = 0.55;
    for (let py = y + 3; py < y + h; py += 7) {
      for (let px = x + ((py / 7) % 2 ? 2 : 5.5); px < x + w; px += 7) {
        ctx.beginPath();
        ctx.arc(px, py, 1.9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (o.pattern === 'asanoha') {
    // Hemp-leaf stars: six spokes per cell.
    ctx.strokeStyle = c;
    ctx.lineWidth = 0.35;
    for (let py = y + 3; py < y + h; py += 6) {
      for (let px = x + ((py / 6) % 2 ? 0 : 3); px < x + w + 3; px += 6) {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(ang) * 2.6, py + Math.sin(ang) * 2.6);
          ctx.stroke();
        }
      }
    }
  } else if (o.pattern === 'sakura') {
    for (let py = y + 4; py < y + h; py += 8) {
      for (let px = x + ((py / 8) % 2 ? 3 : 7); px < x + w; px += 8) blossom(ctx, px, py, 1.8, c, GOLD);
    }
  }
}

// ---------------------------------------------------------------------------
// Head (face center at 0,0; face top ≈ -14, chin ≈ +12.6)
// ---------------------------------------------------------------------------

function facePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-10.6, -2);
  ctx.bezierCurveTo(-10.6, -16, 10.6, -16, 10.6, -2);
  ctx.bezierCurveTo(10.6, 6, 6, 11.5, 0, 12.6);
  ctx.bezierCurveTo(-6, 11.5, -10.6, 6, -10.6, -2);
  ctx.closePath();
}

function drawBackHair(ctx, d) {
  const c = d.hair.color;
  ctx.fillStyle = c;
  const back = d.hair.back;
  ctx.beginPath();
  if (back === 'long') {
    ctx.moveTo(-11.5, -7);
    ctx.quadraticCurveTo(-15.5, 7, -14, 25);
    ctx.lineTo(-12, 31);
    ctx.lineTo(-10, 27);
    ctx.lineTo(10, 27);
    ctx.lineTo(12, 31);
    ctx.lineTo(14, 25);
    ctx.quadraticCurveTo(15.5, 7, 11.5, -7);
  } else if (back === 'medium') {
    ctx.moveTo(-11.5, -7);
    ctx.quadraticCurveTo(-14.5, 4, -13, 17);
    ctx.quadraticCurveTo(0, 19, 13, 17);
    ctx.quadraticCurveTo(14.5, 4, 11.5, -7);
  } else if (back === 'bob') {
    ctx.moveTo(-11.8, -6);
    ctx.quadraticCurveTo(-14, 5, -11.5, 11);
    ctx.quadraticCurveTo(0, 13, 11.5, 11);
    ctx.quadraticCurveTo(14, 5, 11.8, -6);
  } else {
    return drawBackHairAccents(ctx, d);
  }
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.5);
  drawBackHairAccents(ctx, d);
}

function drawBackHairAccents(ctx, d) {
  const c = d.hair.color;
  const back = d.hair.back;
  if (back === 'ponytail') {
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.quadraticCurveTo(17, -10, 15, 8);
    ctx.quadraticCurveTo(13, 18, 9, 22);
    ctx.quadraticCurveTo(11, 10, 7, -4);
    ctx.closePath();
    fillPath(ctx, c, 0.5);
  } else if (back === 'twintails') {
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 9, -8);
      ctx.quadraticCurveTo(dir * 19, -6, dir * 17, 8);
      ctx.quadraticCurveTo(dir * 15, 16, dir * 12, 18);
      ctx.quadraticCurveTo(dir * 14, 6, dir * 10, -2);
      ctx.closePath();
      fillPath(ctx, c, 0.5);
    }
  } else if (back === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -15, 5.4, 0, Math.PI * 2);
    fillPath(ctx, c, 0.5);
  }
}

function drawHead(ctx, d, angryTint = false) {
  const skin = d.skin;
  // Ears and face.
  ctx.fillStyle = shade(skin, -0.1);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 10.4, 0.5, 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  facePath(ctx);
  fillPath(ctx, skin, 0.5);
  drawEyes(ctx, d);
  drawBrows(ctx, d);
  // Blush and a hint of nose.
  ctx.fillStyle = 'rgba(240,120,140,0.32)';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 6.6, 3.6, 2.3, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(160,90,80,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0.3, 2.2);
  ctx.lineTo(-0.4, 3.6);
  ctx.stroke();
  if (angryTint) {
    ctx.save();
    facePath(ctx);
    ctx.clip();
    ctx.fillStyle = 'rgba(214,60,60,0.28)';
    ctx.fillRect(-12, -16, 24, 30);
    ctx.restore();
  }
  if (d.extras?.mask) drawFaceMask(ctx);
  else drawMouth(ctx, d);
  if (d.extras?.mustache) {
    ctx.fillStyle = d.extras.mustache;
    ctx.beginPath();
    ctx.ellipse(-2, 5, 2.6, 1, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2, 5, 2.6, 1, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFrontHair(ctx, d);
  drawHeadExtras(ctx, d);
}

function drawEyes(ctx, d) {
  const e = d.eyes;
  const style = e.style;
  const lineColor = '#2a1a2e';
  for (const dir of [-1, 1]) {
    const ex = dir * 4.6;
    const ey = 1;
    if (style === 'smile') {
      // Closed, smiling arcs — a cheerful grandparent.
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey + 1, 2.4, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      ctx.lineCap = 'butt';
      continue;
    }
    const w = style === 'big' ? 3.2 : 2.9;
    const h = { big: 3.6, round: 2.9, calm: 2.2, sharp: 1.8 }[style] ?? 2.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(0, ey - h, 0, ey + h);
    grad.addColorStop(0, shade(e.color, -0.45));
    grad.addColorStop(1, shade(e.color, 0.25));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.15, ey + 0.2, w * 0.78, h * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(e.color, -0.6);
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.15, ey + 0.1, 0.9, Math.min(1.4, h * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();
    // Upper lash line; longer with a corner flick when `lashes`.
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.moveTo(ex - dir * w * 1.05, ey - h * 0.35);
    ctx.quadraticCurveTo(ex, ey - h - 1.1, ex + dir * w * 1.15, ey - h * 0.55);
    if (e.lashes) ctx.lineTo(ex + dir * (w + 1.3), ey - h - 0.5);
    ctx.lineTo(ex + dir * w * 1.15, ey - h * 0.15);
    ctx.quadraticCurveTo(ex, ey - h - 0.1, ex - dir * w * 1.05, ey - h * 0.05);
    ctx.closePath();
    ctx.fill();
    if (style === 'sharp') {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(ex - dir * w, ey + h * 0.6);
      ctx.lineTo(ex + dir * w, ey + h * 0.4);
      ctx.stroke();
    }
  }
  if (d.extras?.glasses) {
    ctx.strokeStyle = '#4a3a3a';
    ctx.lineWidth = 0.6;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      if (d.extras.glasses === 'round') ctx.arc(dir * 4.6, 1, 3.8, 0, Math.PI * 2);
      else ctx.roundRect(dir * 4.6 - 3.9, -2.2, 7.8, 5.6, 1.2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-0.8, 0.4);
    ctx.lineTo(0.8, 0.4);
    ctx.stroke();
  }
}

function drawBrows(ctx, d) {
  ctx.strokeStyle = d.hair.color === '#e6e3dc' || d.hair.color === '#f2f0ec' || d.hair.color === '#c9c6cf' ? '#9a948c' : shade(d.hair.color, -0.2);
  ctx.lineWidth = d.brows === 'thick' ? 1.1 : 0.7;
  ctx.lineCap = 'round';
  const sharp = d.eyes.style === 'sharp';
  const angry = d.mood === 'angry';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    if (angry) {
      // Brows slammed down toward the nose.
      ctx.moveTo(dir * 2, -2.4);
      ctx.lineTo(dir * 7.4, -5.6);
    } else {
      ctx.moveTo(dir * 2.4, sharp ? -3.6 : -4.4);
      ctx.quadraticCurveTo(dir * 5, -5.8, dir * 7.4, sharp ? -5.4 : -4.6);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawMouth(ctx, d) {
  ctx.strokeStyle = '#b05060';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (d.mood === 'angry') {
    // Mid-complaint: an open, downturned mouth.
    ctx.fillStyle = '#8a2a3a';
    ctx.moveTo(-2.4, 7.4);
    ctx.quadraticCurveTo(0, 4.4, 2.4, 7.4);
    ctx.quadraticCurveTo(0, 6.6, -2.4, 7.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (d.mouth === 'open') {
    ctx.fillStyle = '#b84a5a';
    ctx.moveTo(-1.8, 5.6);
    ctx.quadraticCurveTo(0, 8.6, 1.8, 5.6);
    ctx.closePath();
    ctx.fill();
  } else if (d.mouth === 'flat') {
    ctx.moveTo(-1.4, 6.2);
    ctx.lineTo(1.4, 6.2);
    ctx.stroke();
  } else {
    ctx.arc(0, 5.2, 1.7, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawFaceMask(ctx) {
  // A white surgical mask — common on a Japanese commute.
  ctx.beginPath();
  ctx.moveTo(-7.4, 1.4);
  ctx.quadraticCurveTo(0, 0.2, 7.4, 1.4);
  ctx.lineTo(6.6, 8.2);
  ctx.quadraticCurveTo(0, 11, -6.6, 8.2);
  ctx.closePath();
  fillPath(ctx, '#f6f8fa', 0.45);
  ctx.strokeStyle = 'rgba(120,130,140,0.5)';
  ctx.lineWidth = 0.35;
  for (const py of [4, 6]) {
    ctx.beginPath();
    ctx.moveTo(-6.4, py);
    ctx.quadraticCurveTo(0, py + 1, 6.4, py);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e8ecef';
  ctx.lineWidth = 0.5;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 7.2, 2);
    ctx.lineTo(dir * 10.2, 0);
    ctx.stroke();
  }
}

function crownPath(ctx) {
  ctx.moveTo(-11.2, -2.8);
  ctx.bezierCurveTo(-12, -16.5, 12, -16.5, 11.2, -2.8);
}

function drawFrontHair(ctx, d) {
  const c = d.hair.color;
  const fringe = d.hair.fringe;
  if (fringe === 'bald') {
    // Bald crown with white tufts above the ears.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 10.4, -3.5, 2.4, 4.6, dir * 0.2, 0, Math.PI * 2);
      fillPath(ctx, c, 0.45);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(-2, -9, 5, 1.15 * Math.PI, 1.5 * Math.PI);
    ctx.stroke();
    return;
  }
  if (fringe === 'textured') {
    drawTexturedHair(ctx, d);
    return;
  }
  ctx.beginPath();
  crownPath(ctx);
  if (fringe === 'blunt') {
    // Soft blunt bangs in rounded clumps, like Kimono Himura's.
    const edge = (x) => -1.8 - 1.1 * (x / 11.2) ** 2;
    for (let i = 0; i < 5; i++) {
      const x0 = 11.2 - i * 4.48;
      const x1 = 11.2 - (i + 1) * 4.48;
      ctx.bezierCurveTo(x0 - 0.6, edge(x0) + 0.9, x1 + 0.6, edge(x1) + 0.9, x1, edge(x1) - (i === 4 ? 1 : 0.35));
    }
  } else if (fringe === 'side') {
    // Side-swept: long on the viewer's left, lifting up to the right.
    ctx.quadraticCurveTo(9.6, -6, 6, -6.6);
    ctx.quadraticCurveTo(0, -4, -5, -1.2);
    ctx.quadraticCurveTo(-9.4, 0.4, -11.2, -2.8);
  } else if (fringe === 'parted') {
    // Center part: two curtains sweeping out to the temples.
    ctx.quadraticCurveTo(8, -3, 3.6, -7.8);
    ctx.quadraticCurveTo(0.8, -10.6, 0, -11.2);
    ctx.quadraticCurveTo(-0.8, -10.6, -3.6, -7.8);
    ctx.quadraticCurveTo(-8, -3, -11.2, -2.8);
  } else {
    // Messy: soft rounded tufts.
    const tufts = [[8.4, -3.6], [4.6, -2.6], [0.6, -3.4], [-3.6, -2.4], [-7.6, -3.4]];
    let prev = 11.2;
    for (const [tx, ty] of tufts) {
      ctx.quadraticCurveTo((prev + tx) / 2, -7.2, tx, ty);
      prev = tx;
    }
    ctx.quadraticCurveTo(-10, -6.4, -11.2, -2.8);
  }
  ctx.closePath();
  fillPath(ctx, c, 0.45);
  if (d.hair.streaks) {
    // Chunky highlights.
    ctx.strokeStyle = d.hair.streaks;
    ctx.lineWidth = 0.9;
    for (const sx of [-6, -1, 4]) {
      ctx.beginPath();
      ctx.moveTo(sx, -12.4);
      ctx.quadraticCurveTo(sx - 1.6, -8, sx - 3, -4.6);
      ctx.stroke();
    }
  }
  // Side locks for longer styles.
  if (['long', 'medium', 'bob'].includes(d.hair.back) || d.hair.back === 'twintails') {
    const len = d.hair.back === 'bob' ? 9 : 14;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 11.4, -4);
      ctx.quadraticCurveTo(dir * 12.4, len * 0.4, dir * 9.8, len);
      ctx.quadraticCurveTo(dir * 9.2, len * 0.4, dir * 8.6, -1.6);
      ctx.closePath();
      fillPath(ctx, c, 0.45);
    }
  }
  // Shine across the crown.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -3, 9.4, Math.PI * 1.25, Math.PI * 1.42);
  ctx.moveTo(Math.cos(Math.PI * 1.56) * 9.4, -3 + Math.sin(Math.PI * 1.56) * 9.4);
  ctx.arc(0, -3, 9.4, Math.PI * 1.56, Math.PI * 1.7);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/**
 * The staff's hair (the user: "NOT to be smooth" but not spiky either —
 * asked, they picked "textured, softly pointed"): a crown of layered tufts
 * with gentle points, a fringe of soft rounded-point locks swept slightly
 * to one side, and darker strand lines for texture.
 */
function drawTexturedHair(ctx, d) {
  const c = d.hair.color;
  const cx = 0;
  const cy = -3;
  ctx.beginPath();
  ctx.moveTo(-11.2, -2.6);
  // Crown: seven tufts along the top of the head, each a soft point.
  const tufts = 7;
  for (let i = 0; i < tufts; i++) {
    const a0 = Math.PI + (i / tufts) * Math.PI;
    const a1 = Math.PI + ((i + 1) / tufts) * Math.PI;
    const am = (a0 + a1) / 2 + 0.06;
    const rTip = 12.9 + (i % 2) * 0.7;
    const tipX = cx + Math.cos(am) * rTip;
    const tipY = cy + Math.sin(am) * rTip;
    const endX = cx + Math.cos(a1) * 11.3;
    const endY = cy + Math.sin(a1) * 11.3;
    ctx.quadraticCurveTo(cx + Math.cos(a0 + 0.12) * 12.4, cy + Math.sin(a0 + 0.12) * 12.4, tipX, tipY);
    ctx.quadraticCurveTo(cx + Math.cos(a1 - 0.1) * 12, cy + Math.sin(a1 - 0.1) * 12, endX, endY);
  }
  // Fringe: soft locks swept toward the viewer's left, longest mid-brow.
  const locks = [[8.4, -3.4], [5.2, -2.2], [1.8, -1.6], [-1.8, -2], [-5.4, -2.8], [-8.8, -3.8]];
  let prev = 11.3;
  for (const [tx, ty] of locks) {
    const vx = (prev + tx) / 2 + 0.6;
    ctx.quadraticCurveTo(prev - 0.2, -4.6, vx, -6.2);
    ctx.quadraticCurveTo(tx + 1.2, -4.2, tx, ty);
    prev = tx;
  }
  ctx.quadraticCurveTo(-10.4, -4.2, -11.2, -2.6);
  ctx.closePath();
  fillPath(ctx, c, 0.45);
  // Strand lines following each lock and tuft.
  ctx.strokeStyle = shade(c, c === '#141012' ? 0.25 : -0.3);
  ctx.lineWidth = 0.45;
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[-6.5, -11, -5.2, -4.2], [-2, -12.4, -1.4, -3.4], [2.6, -12.4, 2.6, -3.6], [6.6, -10.8, 5.8, -4.4], [-9.4, -8.4, -8.6, -4.6], [9.4, -8.6, 8.8, -4.8]]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 - 0.8, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  }
  // A soft shine across the crown.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, -3, 9.4, Math.PI * 1.3, Math.PI * 1.45);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawHeadExtras(ctx, d) {
  const x = d.extras ?? {};
  if (x.sunglasses) {
    // Pushed up on top of her head.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 4.4, -11.4, 3.4, 2, dir * -0.15, 0, Math.PI * 2);
      fillPath(ctx, '#2a2226', 0.4);
    }
    ctx.strokeStyle = '#2a2226';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1.2, -11.6);
    ctx.lineTo(1.2, -11.6);
    ctx.stroke();
  }
  if (x.beanie) {
    // Soft rounded tufts curling out over the ears, under the beanie.
    for (const dir of [-1, 1]) {
      for (const [ox, oy, r] of [[10.6, -5.2, 2.4], [11.2, -2.6, 2], [10.4, -0.4, 1.6]]) {
        ctx.beginPath();
        ctx.arc(dir * ox, oy, r, 0, Math.PI * 2);
        fillPath(ctx, d.hair.color, 0.4);
      }
    }
    // Sits high enough that the soft fringe shows beneath its band.
    ctx.beginPath();
    ctx.moveTo(-11.4, -7.6);
    ctx.bezierCurveTo(-12, -20.5, 12, -20.5, 11.4, -7.6);
    ctx.closePath();
    fillPath(ctx, x.beanie, 0.5);
    rr(ctx, -11.8, -9.6, 23.6, 3.4, 1.4, shade(x.beanie, -0.2), 0.45);
    ctx.strokeStyle = shade(x.beanie, -0.12);
    ctx.lineWidth = 0.4;
    for (let rx = -8; rx <= 8; rx += 2.7) {
      ctx.beginPath();
      ctx.moveTo(rx, -10.4);
      ctx.lineTo(rx * 0.92, -16.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -19, 2.4, 0, Math.PI * 2);
    fillPath(ctx, shade(x.beanie, 0.3), 0.4);
  }
  if (x.clip) {
    rr(ctx, -9.2, -7.8, 4.2, 1.3, 0.6, x.clip, 0.3);
  }
  if (x.ribbon) {
    ctx.fillStyle = x.ribbon;
    for (const dir of [-1, 1]) {
      const bx = dir * 9.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, -7);
        ctx.lineTo(bx + side * 2.8, -9.4);
        ctx.lineTo(bx + side * 2.8, -4.6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  if (x.cap) {
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.bezierCurveTo(-11.6, -17.5, 11.6, -17.5, 11, -6);
    ctx.closePath();
    fillPath(ctx, x.cap, 0.5);
    ctx.beginPath();
    ctx.ellipse(4, -5.8, 9, 2, 0, 0, Math.PI * 2);
    fillPath(ctx, shade(x.cap, -0.2), 0.45);
  }
  if (x.headphones) {
    ctx.strokeStyle = x.headphones;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -2, 12.2, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    for (const dir of [-1, 1]) rr(ctx, dir * 12.2 - 2, -3, 4, 6, 1.6, '#4fae7a', 0.4);
  }
  if (x.earrings) {
    ctx.fillStyle = x.earrings;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * 10.6, 3.6, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
