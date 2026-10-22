// The small things that make each Library Shift patron theirs ("make them
// detailer"): pins and badges, name tags, lanyards, necklaces, scarves, a
// wallet chain, watches, bracelets, rings, socks, a knee plaster, earbuds.
// Each design lists its own in library-people.js's `trinkets`; patron.js
// calls these at the torso, the free wrist, the legs and the head.
//
// Coordinates are the anime frame's (feet at 0, shoulders about -40, face
// centre about -55).

import { shadeColor } from '../shared/people.js';
import { fillPath, rr, dot } from './staff-kit.js';

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function heart(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.8);
  ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.1, cx - r * 0.8, cy - r * 1.3, cx, cy - r * 0.5);
  ctx.bezierCurveTo(cx + r * 0.8, cy - r * 1.3, cx + r * 1.4, cy - r * 0.1, cx, cy + r * 0.8);
  ctx.closePath();
}

/** A crescent: the outer arc, then back along a smaller inner arc. */
function moon(ctx, cx, cy, r, colour) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65);
  ctx.arc(cx + r * 0.45, cy, r * 0.75, Math.PI * 1.45, Math.PI * 0.55, true);
  ctx.closePath();
  fillPath(ctx, colour, 0.15);
}

/** A pin or badge of `shape`: round (with a ring), star, heart, moon, flag or paw. */
function drawPin(ctx, { x, y, colour, shape = 'round' }) {
  if (shape === 'star') {
    star(ctx, x, y, 1.3);
    fillPath(ctx, colour, 0.25);
  } else if (shape === 'heart') {
    heart(ctx, x, y, 1);
    fillPath(ctx, colour, 0.25);
  } else if (shape === 'moon') {
    moon(ctx, x, y, 1.1, colour);
  } else if (shape === 'flag') {
    rr(ctx, x - 1.4, y - 0.9, 2.8, 1.8, 0.2);
    fillPath(ctx, '#ffffff', 0.25);
    dot(ctx, x, y, 0.55, colour, 0);
  } else if (shape === 'paw') {
    dot(ctx, x, y + 0.3, 0.7, colour, 0);
    for (const [dx, dy] of [[-0.8, -0.6], [0, -0.9], [0.8, -0.6]]) dot(ctx, x + dx, y + dy, 0.3, colour, 0);
  } else {
    dot(ctx, x, y, 1.15, colour, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 0.7, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
  }
  // A glint.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x - 0.6, y - 0.6, 0.35, 0.35);
}

function drawNameTag(ctx, { colour = '#4fa8e0', x = -6.2, y = -36.6 }) {
  rr(ctx, x - 2.2, y - 0.9, 4.4, 2, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
  ctx.fillStyle = colour;
  ctx.fillRect(x - 2.2, y - 0.9, 4.4, 0.55);
  ctx.fillStyle = '#4a4a58';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 1.6 + i * 1.1, y, 0.7, 0.5);
}

function drawLanyard(ctx, { colour = '#e8558f' }) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-3.2, -43.2);
  ctx.quadraticCurveTo(-1.3, -36, 0, -32.4);
  ctx.quadraticCurveTo(1.3, -36, 3.2, -43.2);
  ctx.stroke();
  rr(ctx, -0.4, -33, 0.8, 1, 0.2);
  fillPath(ctx, '#c8ccd6', 0.12);
  rr(ctx, -1.7, -32, 3.4, 4.4, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
  ctx.fillStyle = colour;
  ctx.fillRect(-1.7, -32, 3.4, 0.9);
  rr(ctx, -1.2, -30.8, 1.3, 1.6, 0.2);
  fillPath(ctx, '#e8d2c2', 0.1);
  ctx.fillStyle = '#a0a0ae';
  ctx.fillRect(0.4, -30.6, 0.9, 0.3);
  ctx.fillRect(0.4, -30, 0.7, 0.3);
  ctx.fillRect(-1.2, -28.8, 2.4, 0.3);
}

const PENDANTS = {
  heart: (ctx, x, y, c) => { heart(ctx, x, y, 0.9); fillPath(ctx, c, 0.2); },
  moon: (ctx, x, y, c) => moon(ctx, x, y, 1, c),
  cat: (ctx, x, y, c) => {
    dot(ctx, x, y, 0.9, c, 0.2);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 0.4, y - 0.7);
      ctx.lineTo(x + dir * 0.9, y - 1.6);
      ctx.lineTo(x + dir * 1, y - 0.4);
      ctx.closePath();
      fillPath(ctx, c, 0.15);
    }
  },
  compass: (ctx, x, y, c) => {
    dot(ctx, x, y, 1.1, c, 0.25);
    dot(ctx, x, y, 0.75, '#fbf6e6', 0);
    ctx.fillStyle = '#d23a4a';
    ctx.beginPath();
    ctx.moveTo(x, y - 0.65);
    ctx.lineTo(x + 0.25, y);
    ctx.lineTo(x - 0.25, y);
    ctx.closePath();
    ctx.fill();
  },
  plain: (ctx, x, y, c) => dot(ctx, x, y, 0.55, c, 0.15),
};

function drawNecklace(ctx, { colour = '#e8c25a', pendant = 'plain', length = 6 }) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-3.6, -43.6);
  ctx.quadraticCurveTo(0, -43.6 + length * 1.5, 3.6, -43.6);
  ctx.stroke();
  (PENDANTS[pendant] ?? PENDANTS.plain)(ctx, 0, -43.6 + length * 0.78, colour);
}

function drawChoker(ctx, { colour = '#1e1a22' }) {
  rr(ctx, -3.4, -46, 6.8, 1, 0.4);
  fillPath(ctx, colour, 0.25);
  dot(ctx, 0, -44.8, 0.5, '#d6dae4', 0.12);
}

/** A silk scarf knotted at the neck, its ends hanging, with a print. */
function drawScarf(ctx, { colour, dots = '#ffffff' }) {
  ctx.beginPath();
  ctx.moveTo(-5.4, -45.4);
  ctx.quadraticCurveTo(0, -42.4, 5.4, -45.4);
  ctx.lineTo(5.8, -43);
  ctx.quadraticCurveTo(0, -40, -5.8, -43);
  ctx.closePath();
  fillPath(ctx, colour, 0.45);
  dot(ctx, 1.6, -42.4, 1.3, shadeColor(colour, -0.1), 0.35);
  for (const [dx, len, r] of [[0.6, 6, 0.25], [2.6, 5, -0.15]]) {
    ctx.save();
    ctx.translate(dx, -41.6);
    ctx.rotate(r);
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(1, 0);
    ctx.lineTo(1.4, len);
    ctx.lineTo(0, len - 0.8);
    ctx.lineTo(-1.4, len);
    ctx.closePath();
    fillPath(ctx, colour, 0.35);
    ctx.restore();
  }
  ctx.fillStyle = dots;
  for (const [dx, dy] of [[-3, -43.6], [-0.6, -42.8], [3.6, -43.4], [1.2, -38.6], [3, -38]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A cloth patch sewn on: a stitched border around a little emblem. */
function drawPatch(ctx, { x, y, colour, shape = 'star' }) {
  rr(ctx, x - 1.8, y - 1.4, 3.6, 2.8, 0.6);
  fillPath(ctx, colour, 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.18;
  ctx.setLineDash([0.3, 0.25]);
  ctx.strokeRect(x - 1.5, y - 1.1, 3, 2.2);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  if (shape === 'mountain') {
    ctx.beginPath();
    ctx.moveTo(x - 1.2, y + 0.8);
    ctx.lineTo(x - 0.2, y - 0.7);
    ctx.lineTo(x + 0.4, y + 0.2);
    ctx.lineTo(x + 0.8, y - 0.3);
    ctx.lineTo(x + 1.3, y + 0.8);
    ctx.closePath();
    ctx.fill();
  } else {
    star(ctx, x, y, 0.8);
    ctx.fill();
  }
}

/** A wallet chain looping from the belt to a back pocket. */
function drawWalletChain(ctx, { colour = '#d6dae4' }) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.35;
  ctx.setLineDash([0.5, 0.25]);
  ctx.beginPath();
  ctx.moveTo(4.2, -19.6);
  ctx.quadraticCurveTo(7.4, -11, 9.4, -16.6);
  ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, 4.2, -19.6, 0.45, colour, 0.12);
}

function drawGlassesChain(ctx, { colour = '#e8c25a' }) {
  ctx.fillStyle = colour;
  for (const dir of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      ctx.beginPath();
      ctx.arc(dir * (9 + Math.sin(f * Math.PI) * 1.4 - f * 3.2), -55.4 + f * 11.6, i % 3 ? 0.2 : 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEarbuds(ctx, { colour = '#ffffff' }) {
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 9.6, -54, 0.8, 0.95, 0, 0, Math.PI * 2);
    fillPath(ctx, colour, 0.22);
    rr(ctx, dir * 9.6 - 0.3, -53.4, 0.6, 1.8, 0.3);
    fillPath(ctx, colour, 0.18);
  }
}

function drawHairpins(ctx, { colour = '#ffd166' }) {
  for (const [x, y, r] of [[-6.4, -62.4, -0.6], [-4.6, -63.6, -0.4]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    rr(ctx, -1.6, -0.3, 3.2, 0.6, 0.3);
    fillPath(ctx, colour, 0.15);
    ctx.restore();
  }
  dot(ctx, 6, -62, 0.8, '#ff8fb8', 0.2);
}

const TORSO_KINDS = {
  pin: drawPin,
  nametag: drawNameTag,
  lanyard: drawLanyard,
  necklace: drawNecklace,
  choker: drawChoker,
  scarf: drawScarf,
  patch: drawPatch,
  walletChain: drawWalletChain,
};

/** Everything worn on the front of the body, drawn over the torso. */
export function drawTorsoTrinkets(ctx, design) {
  for (const tr of design.trinkets ?? []) TORSO_KINDS[tr.kind]?.(ctx, tr);
}

/** Everything worn on the head and face. */
export function drawHeadTrinkets(ctx, design) {
  for (const tr of design.trinkets ?? []) {
    if (tr.kind === 'glassesChain') drawGlassesChain(ctx, tr);
    else if (tr.kind === 'earbuds') drawEarbuds(ctx, tr);
    else if (tr.kind === 'hairpins') drawHairpins(ctx, tr);
  }
}

/** Watches, bracelets, wristbands and rings on the free hand's wrist. */
export function drawWristTrinkets(ctx, design, [wx, wy]) {
  let band = 0;
  for (const tr of design.trinkets ?? []) {
    if (tr.kind === 'watch') {
      const kind = tr.style ?? 'leather';
      rr(ctx, wx - 2, wy - 0.9 - band, 4, 1.3, 0.4);
      fillPath(ctx, kind === 'gold' ? '#e8c25a' : kind === 'smart' ? '#2a2a34' : kind === 'digital' ? '#1e1e22' : '#6a3e22', 0.25);
      if (kind === 'smart' || kind === 'digital') {
        rr(ctx, wx - 0.9, wy - 1.5 - band, 1.8, 2.2, 0.5);
        fillPath(ctx, '#2a2a34', 0.25);
        rr(ctx, wx - 0.6, wy - 1.2 - band, 1.2, 1.6, 0.3);
        fillPath(ctx, kind === 'smart' ? '#7ac7ff' : '#b8d8a0', 0);
      } else {
        dot(ctx, wx, wy - 0.25 - band, 0.95, tr.colour ?? (kind === 'gold' ? '#fff6e0' : '#f4f2ea'), 0.25);
        ctx.strokeStyle = '#2a2226';
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.moveTo(wx, wy - 0.25 - band);
        ctx.lineTo(wx, wy - 0.9 - band);
        ctx.moveTo(wx, wy - 0.25 - band);
        ctx.lineTo(wx + 0.5, wy - 0.1 - band);
        ctx.stroke();
      }
      band += 1.2;
    } else if (tr.kind === 'bracelet') {
      ctx.strokeStyle = tr.colour;
      ctx.lineWidth = 0.5;
      ctx.setLineDash(tr.beads ? [0.45, 0.25] : []);
      ctx.beginPath();
      ctx.moveTo(wx - 1.8, wy - 0.4 - band);
      ctx.lineTo(wx + 1.8, wy - 0.4 - band);
      ctx.stroke();
      ctx.setLineDash([]);
      if (tr.charm) dot(ctx, wx + 0.6, wy + 0.2 - band, 0.4, tr.charm, 0.1);
      band += 0.7;
    } else if (tr.kind === 'wristband') {
      rr(ctx, wx - 2, wy - 1.2 - band, 4, 1.4, 0.5);
      fillPath(ctx, tr.colour, 0.25);
      band += 1.3;
    } else if (tr.kind === 'ring') {
      rr(ctx, wx + 0.2, wy + 2.4, 0.9, 0.4, 0.2);
      fillPath(ctx, tr.colour, 0.1);
    }
  }
}

/** Socks above the shoe, and a plaster on a knee. */
export function drawLegTrinkets(ctx, design, { knee, ankle, dir }) {
  for (const tr of design.trinkets ?? []) {
    if (tr.kind === 'socks') {
      rr(ctx, ankle[0] - 1.9, ankle[1] - 2.8 - (tr.high ? 3 : 0), 3.8, 3.6 + (tr.high ? 3 : 0), 0.6);
      fillPath(ctx, tr.mismatched && dir > 0 ? tr.mismatched : tr.colour, 0.35);
      if (tr.stripe) {
        ctx.fillStyle = tr.stripe;
        ctx.fillRect(ankle[0] - 1.9, ankle[1] - 2.2 - (tr.high ? 3 : 0), 3.8, 0.5);
        ctx.fillRect(ankle[0] - 1.9, ankle[1] - 1.2 - (tr.high ? 3 : 0), 3.8, 0.5);
      }
      if (tr.frill) {
        ctx.fillStyle = '#ffffff';
        for (let i = -1.6; i <= 1.6; i += 0.8) {
          ctx.beginPath();
          ctx.arc(ankle[0] + i, ankle[1] - 2.8 - (tr.high ? 3 : 0), 0.45, Math.PI, 0);
          ctx.fill();
        }
      }
    } else if (tr.kind === 'plaster' && dir === (tr.side ?? -1)) {
      ctx.save();
      ctx.translate(knee[0], knee[1] + 0.4);
      ctx.rotate(0.4);
      rr(ctx, -1.6, -0.6, 3.2, 1.2, 0.4);
      fillPath(ctx, '#f2c89a', 0.25);
      ctx.fillStyle = 'rgba(160,110,70,0.5)';
      for (const dx of [-0.4, 0, 0.4]) ctx.fillRect(dx - 0.05, -0.3, 0.1, 0.6);
      ctx.restore();
    }
  }
}

