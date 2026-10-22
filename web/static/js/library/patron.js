// Library Shift's patrons, drawn in detail from their library-people.js
// designs ("i want the characters to also be more detailed like min-jun,
// ji-ho, eun-mi and staff"): the same layered, outlined style as the staff
// renderers, with walking legs, each outfit kind's own seams, pockets and
// trims, a face and hair from patron-head.js, and a personal prop from
// patron-props.js. Kids get a bigger head on a smaller body; elders stoop
// a little.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import { shadeColor } from '../shared/people.js';
import {
  fillPath, rr, dot, walkCycle, groundShadow, limbSegment, legPoses, kneeFold, sleeve, swingArm, drawHand,
} from './staff-kit.js';
import { drawHairBack, drawPatronHead, drawBow } from './patron-head.js';
import { PROPS } from './patron-props.js';
import { drawTorsoTrinkets, drawWristTrinkets, drawLegTrinkets, drawHeadTrinkets } from './patron-trinkets.js';

const AGE_SCALE = { kid: 0.74, teen: 0.95, elder: 0.95, adult: 1 };
/** Kids' heads are drawn this much bigger, about the neck. */
const KID_HEAD = 1.26;
const NECK_Y = -44;

const WHITE_SHOES = new Set(['#ffffff', '#f2f2f2']);

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {object} design - a library-people.js patron design
 * @param {{scale?: number, t?: number, walking?: boolean, angryTint?: boolean}} [opts]
 */
export function drawPatron(ctx, x, y, design, opts = {}) {
  const k = (opts.scale ?? 1) * (AGE_SCALE[design.age] ?? 1);
  const t = opts.t ?? 0;
  const { phase, amount, stride, breathe } = walkCycle(t, 5, Boolean(opts.walking));
  const sway = amount ? Math.sin(phase - 0.8) * 0.8 : Math.sin(t * 1.2 + design.key.length) * 0.2;
  const prop = PROPS[design.prop] ?? null;
  const slim = Boolean(design.outfit.skirt) || design.age === 'kid';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, slim ? 12 : 14);
  if (prop?.back) prop.drawBack(ctx, t);
  withHead(ctx, design, () => drawHairBack(ctx, design, sway));
  drawLegs(ctx, design, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawLowerGarment(ctx, design, stride);
  drawTorso(ctx, design, slim);
  drawFreeArm(ctx, design, slim, stride);
  drawPropArm(ctx, design, slim, stride, prop, t);
  // Elders stoop a little: the head sits forward of the shoulders.
  if (design.age === 'elder') ctx.translate(0.3, 0.9);
  withHead(ctx, design, () => {
    drawPatronHead(ctx, design, t, { angry: Boolean(opts.angryTint) });
    drawHeadTrinkets(ctx, design);
  });
  ctx.restore();
  ctx.restore();
}

/** Runs `draw` with a kid's head enlarged about the neck. */
function withHead(ctx, design, draw) {
  if (design.age !== 'kid') {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(0, NECK_Y);
  ctx.scale(KID_HEAD, KID_HEAD);
  ctx.translate(0, -NECK_Y);
  draw();
  ctx.restore();
}

// -- Legs and shoes -------------------------------------------------------------

/** Whether the legs below the hem are bare skin / tights (a skirt or shorts) or trousers. */
function legFill(design) {
  const o = design.outfit;
  if (o.skirt) return o.legs ?? design.skin;
  if (o.kind === 'tee' && !o.legs) return design.skin; // shorts
  return o.bottom ?? '#3a3a48';
}

function drawLegs(ctx, design, phase, amount) {
  const fill = legFill(design);
  const trousers = !design.outfit.skirt && !(design.outfit.kind === 'tee' && !design.outfit.legs);
  const w = trousers ? [6.6, 5.8, 5.2] : [4.8, 3.9, 3.1];
  for (const { dir, hip, knee, ankle, bend, pitch } of legPoses(phase, amount, { hipX: trousers ? 3.8 : 3.1, hipY: -19.6, swing: 0.26, bend: 0.45 })) {
    const f = dir < 0 ? fill : shadeColor(fill, -0.1);
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], w[0], w[1], f, 0.45);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], w[1], w[2], f, 0.45);
    if (trousers) {
      // A slanted front pocket at the hip, and a stitched hem.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(hip[0] + dir * 1, hip[1] + 0.4);
      ctx.lineTo(hip[0] + dir * 3, hip[1] + 3.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([0.4, 0.3]);
      ctx.beginPath();
      ctx.moveTo(ankle[0] - 2.4, ankle[1] - 1.2);
      ctx.lineTo(ankle[0] + 2.4, ankle[1] - 1.2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(knee[0], knee[1] + 1);
      ctx.lineTo(ankle[0], ankle[1] - 1.6);
      ctx.stroke();
      if (design.outfit.kind === 'track') {
        // The side stripe down the track pants.
        ctx.strokeStyle = design.outfit.stripe ?? '#ffffff';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hip[0] + dir * 3, hip[1] + 1);
        ctx.lineTo(knee[0] + dir * 2.6, knee[1]);
        ctx.lineTo(ankle[0] + dir * 2.2, ankle[1] - 1);
        ctx.stroke();
      }
      kneeFold(ctx, knee, bend);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(knee[0] - 0.5, knee[1] + 1.2);
      ctx.lineTo(ankle[0] - 0.4, ankle[1] - 2);
      ctx.stroke();
    }
    drawLegTrinkets(ctx, design, { knee, ankle, dir });
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawShoe(ctx, design, trousers);
    ctx.restore();
  }
}

function drawShoe(ctx, design, trousers) {
  const c = design.outfit.shoes ?? '#2a2226';
  const sneaker = WHITE_SHOES.has(c) || design.outfit.kind === 'track' || design.outfit.kind === 'tee';
  if (trousers) {
    rr(ctx, -3, -2, 6, 2.4, 0.6);
    fillPath(ctx, shadeColor(design.outfit.bottom ?? '#3a3a48', -0.15), 0.35);
  }
  rr(ctx, -3.7, 4.1, 7.6, 1.4, 0.6);
  fillPath(ctx, sneaker ? '#e6e2d8' : '#2a1810', 0.35);
  ctx.beginPath();
  ctx.moveTo(-3.5, 4.3);
  ctx.quadraticCurveTo(-3.7, 0.6, -1.2, 0.5);
  ctx.lineTo(1, 0.6);
  ctx.quadraticCurveTo(4.2, 1, 3.9, 4.3);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0.5, 0, 4.4);
  g.addColorStop(0, shadeColor(c, 0.1));
  g.addColorStop(1, shadeColor(c, -0.12));
  fillPath(ctx, g, 0.4);
  if (sneaker) {
    ctx.strokeStyle = 'rgba(80,84,96,0.6)';
    ctx.lineWidth = 0.22;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-1.2 + i * 0.8, 1);
      ctx.lineTo(-0.2 + i * 0.8, 1.8);
      ctx.stroke();
    }
    ctx.strokeStyle = design.outfit.kind === 'track' ? '#8a7ab8' : '#4fa8e0';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0.6, 3);
    ctx.quadraticCurveTo(1.8, 2.4, 3, 2.8);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(1.4, 2.6);
    ctx.quadraticCurveTo(2.6, 2.4, 3, 3.2);
    ctx.stroke();
  }
}

// -- Skirts, shorts, aprons below the waist --------------------------------------

function drawLowerGarment(ctx, design, stride) {
  const o = design.outfit;
  const sway = stride * 1.4;
  if (o.kind === 'tee' && !o.legs) {
    // Shorts.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(dir * 7.4, -22);
      ctx.lineTo(dir * 8 + sway * 0.3, -13.4);
      ctx.lineTo(dir * 0.6, -13.6);
      ctx.closePath();
      fillPath(ctx, dir < 0 ? o.bottom : shadeColor(o.bottom, -0.1), 0.5);
    }
    return;
  }
  if (!o.skirt || o.kind === 'hanbok') return;
  const long = o.kind === 'dress' || design.age === 'elder' || o.kind === 'apron';
  const hem = long ? -7 : -10;
  ctx.beginPath();
  ctx.moveTo(-8, -22.4);
  ctx.lineTo(8, -22.4);
  ctx.quadraticCurveTo(10.4 + sway, -16, 11.4 + sway, hem);
  ctx.quadraticCurveTo(0, hem + 1.8, -11.4 + sway, hem);
  ctx.quadraticCurveTo(-10.4 + sway, -16, -8, -22.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-11, 0, 11, 0);
  g.addColorStop(0, shadeColor(o.skirt, 0.12));
  g.addColorStop(0.5, o.skirt);
  g.addColorStop(1, shadeColor(o.skirt, -0.15));
  fillPath(ctx, g, 0.55);
  ctx.strokeStyle = shadeColor(o.skirt, -0.3);
  ctx.lineWidth = 0.35;
  for (const dir of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, -20.6);
    ctx.quadraticCurveTo(dir * 5 + sway * 0.4, (hem - 20) / 2, dir * 6.4 + sway, hem + 0.6);
    ctx.stroke();
  }
  if (o.trim) {
    ctx.strokeStyle = o.trim;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-11 + sway, hem - 0.8);
    ctx.quadraticCurveTo(0, hem + 0.9, 11 + sway, hem - 0.8);
    ctx.stroke();
  }
}

// -- Torso ------------------------------------------------------------------------

function bodyPath(ctx, slim) {
  const s = slim ? 9.2 : 10.6;
  const w = slim ? 7.8 : 9.8;
  ctx.beginPath();
  ctx.moveTo(-4.6, -43.8);
  ctx.quadraticCurveTo(-s, -43.4, -s, -38);
  ctx.quadraticCurveTo(-w + 0.4, -30, -w, -20.6);
  ctx.quadraticCurveTo(0, -19.4, w, -20.6);
  ctx.quadraticCurveTo(w - 0.4, -30, s, -38);
  ctx.quadraticCurveTo(s, -43.4, 4.6, -43.8);
  ctx.closePath();
}

function shadedFill(ctx, colour) {
  const g = ctx.createLinearGradient(-11, 0, 11, 0);
  g.addColorStop(0, shadeColor(colour, 0.14));
  g.addColorStop(0.5, colour);
  g.addColorStop(1, shadeColor(colour, -0.16));
  return g;
}

function drawTorso(ctx, design, slim) {
  const o = design.outfit;
  bodyPath(ctx, slim);
  fillPath(ctx, shadedFill(ctx, o.kind === 'apron' || o.kind === 'blouse' ? o.top : o.inner && o.kind !== 'suit' ? o.inner : o.top), 0.6);
  const draw = TORSO[o.kind] ?? TORSO.tee;
  draw(ctx, design, slim);
  drawTorsoFolds(ctx, design, slim);
  drawTorsoTrinkets(ctx, design);
  if (design.extras?.pearls) {
    ctx.fillStyle = '#fff8f0';
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.15 + (i / 10) * 0.7);
      dot(ctx, Math.cos(a) * 4.6, -44.6 + Math.sin(a) * 3.6, 0.48, '#fff8f0', 0.12);
    }
  }
}

/**
 * The cloth's own small details over any outfit: soft fold shadows from the
 * armpits to the waist, a crease at the waist, and a stitched hem.
 */
function drawTorsoFolds(ctx, design, slim) {
  const w = slim ? 7.8 : 9.8;
  const c = design.outfit.kind === 'apron' ? design.outfit.apron : design.outfit.top;
  ctx.strokeStyle = 'rgba(20,14,30,0.18)';
  ctx.lineWidth = 0.45;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * (w + 0.6), -37);
    ctx.quadraticCurveTo(dir * (w - 1.6), -33, dir * (w - 0.8), -28.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * (w - 2.4), -24.8);
    ctx.quadraticCurveTo(dir * (w - 1.2), -24, dir * (w - 0.2), -24.6);
    ctx.stroke();
  }
  // Light catching the shoulder seam.
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4.6, -43.2);
  ctx.quadraticCurveTo(-(w + 0.6), -43, -(w + 0.8), -38.6);
  ctx.stroke();
  if (!['dress', 'apron', 'hanbok', 'overalls'].includes(design.outfit.kind)) {
    ctx.strokeStyle = shadeColor(c, 0.35);
    ctx.lineWidth = 0.2;
    ctx.setLineDash([0.45, 0.35]);
    ctx.beginPath();
    ctx.moveTo(-w + 0.5, -20.2);
    ctx.quadraticCurveTo(0, -19.2, w - 0.5, -20.2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Two front panels opening over an inner layer, from the collar to the hem. */
function panels(ctx, colour, slim, { open = 3, deep = -34, hem = -19.4 } = {}) {
  const s = slim ? 9.2 : 10.6;
  const w = slim ? 7.8 : 9.8;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * open, -43.4);
    ctx.quadraticCurveTo(dir * s, -43.4, dir * s, -38);
    ctx.quadraticCurveTo(dir * (w - 0.4), -30, dir * (w + 0.2), hem);
    ctx.lineTo(dir * 0.6, hem + 0.6);
    ctx.lineTo(dir * 0.6, deep + 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 1, 0, dir * s, 0);
    g.addColorStop(0, shadeColor(colour, 0.1));
    g.addColorStop(1, shadeColor(colour, dir < 0 ? -0.05 : -0.2));
    fillPath(ctx, g, 0.55);
  }
}

function ribbedHem(ctx, colour, y, w) {
  rr(ctx, -w, y, w * 2, 1.7, 0.5);
  fillPath(ctx, shadeColor(colour, -0.08), 0.4);
  ctx.strokeStyle = shadeColor(colour, -0.28);
  ctx.lineWidth = 0.2;
  for (let xx = -w + 0.5; xx < w; xx += 0.8) {
    ctx.beginPath();
    ctx.moveTo(xx, y + 0.2);
    ctx.lineTo(xx, y + 1.5);
    ctx.stroke();
  }
}

function buttons(ctx, x, ys, colour) {
  for (const by of ys) {
    dot(ctx, x, by, 0.55, colour, 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - 0.3, by - 0.35, 0.3, 0.25);
  }
}

function collarPoints(ctx, colour) {
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.lineTo(dir * 4.2, -45);
    ctx.lineTo(dir * 3.4, -41.2);
    ctx.quadraticCurveTo(dir * 1.2, -41.6, 0, -42.6);
    ctx.closePath();
    fillPath(ctx, colour, 0.4);
  }
}

const TORSO = {
  hoodie(ctx, design, slim) {
    const c = design.outfit.top;
    // The hood bunched behind the neck, drawstrings with metal tips.
    ctx.beginPath();
    ctx.moveTo(-6.4, -44.4);
    ctx.quadraticCurveTo(0, -48.6, 6.4, -44.4);
    ctx.quadraticCurveTo(0, -41.6, -6.4, -44.4);
    ctx.closePath();
    fillPath(ctx, shadeColor(c, -0.15), 0.45);
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = '#f4f4f4';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(dir * 2, -43);
      ctx.quadraticCurveTo(dir * 2.4, -38, dir * 1.6 + dir * 0.6, -34.4);
      ctx.stroke();
      rr(ctx, dir * 2.2 - 0.35, -34.6, 0.7, 1.3, 0.2);
      fillPath(ctx, '#c8ccd6', 0.12);
    }
    // The kangaroo pocket.
    ctx.beginPath();
    ctx.moveTo(-5.6, -29);
    ctx.lineTo(5.6, -29);
    ctx.lineTo(7, -22.6);
    ctx.lineTo(-7, -22.6);
    ctx.closePath();
    fillPath(ctx, shadeColor(c, -0.06), 0.4);
    ctx.strokeStyle = shadeColor(c, -0.3);
    ctx.lineWidth = 0.3;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 5.6, -29);
      ctx.quadraticCurveTo(dir * 7, -26, dir * 7, -22.6);
      ctx.stroke();
    }
    // A little chest print.
    if (design.extras?.headphones) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-3.6, -36);
      ctx.bezierCurveTo(-5.4, -37.4, -4.4, -39.2, -3.6, -38);
      ctx.bezierCurveTo(-2.8, -39.2, -1.8, -37.4, -3.6, -36);
      ctx.fill();
    } else {
      rr(ctx, -4.4, -38.4, 3.4, 1.4, 0.3);
      fillPath(ctx, shadeColor(c, 0.3), 0);
    }
    ribbedHem(ctx, c, -21.6, slim ? 7.8 : 9.8);
  },
  cardigan(ctx, design, slim) {
    const o = design.outfit;
    // The inner top's neckline.
    ctx.beginPath();
    ctx.ellipse(0, -43.6, 3.8, 1.4, 0, 0, Math.PI);
    fillPath(ctx, shadeColor(o.inner, -0.1), 0.35);
    panels(ctx, o.top, slim, { open: 3.4, deep: -32 });
    buttons(ctx, -1.4, [-30.6, -27, -23.4], '#fbf6ee');
    // Ribbing down the button band, and patch pockets.
    ctx.strokeStyle = shadeColor(o.top, -0.25);
    ctx.lineWidth = 0.25;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 3.2, -42.8);
      ctx.lineTo(dir * 1.4, -28);
      ctx.lineTo(dir * 1.4, -20);
      ctx.stroke();
      rr(ctx, dir * 5.4 - 2, -26, 4, 3.6, 0.5);
      fillPath(ctx, shadeColor(o.top, -0.06), 0.35);
    }
    ribbedHem(ctx, o.top, -21.4, slim ? 7.8 : 9.8);
  },
  blazer(ctx, design, slim) {
    const o = design.outfit;
    collarPoints(ctx, o.inner ?? '#ffffff');
    // A school tie.
    ctx.beginPath();
    ctx.moveTo(-0.9, -42.6);
    ctx.lineTo(0.9, -42.6);
    ctx.lineTo(1.3, -33.6);
    ctx.lineTo(0, -32.2);
    ctx.lineTo(-1.3, -33.6);
    ctx.closePath();
    fillPath(ctx, '#8a2a3e', 0.3);
    ctx.strokeStyle = shadeColor(o.top, 0.2);
    ctx.lineWidth = 0.35;
    for (const yy of [-40, -37.4, -34.8]) {
      ctx.beginPath();
      ctx.moveTo(-1, yy);
      ctx.lineTo(1.1, yy - 1);
      ctx.stroke();
    }
    panels(ctx, o.top, slim, { open: 4.2, deep: -31 });
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 4.2, -43.4);
      ctx.lineTo(dir * 7.6, -42);
      ctx.lineTo(dir * 7, -37.8);
      ctx.lineTo(dir * 8, -36.8);
      ctx.lineTo(dir * 1.2, -29);
      ctx.closePath();
      fillPath(ctx, shadeColor(o.top, -0.12), 0.4);
    }
    buttons(ctx, -1.6, [-26, -22.6], '#e8c25a');
    // A gold crest on the breast pocket.
    rr(ctx, 4.2, -35.4, 3.8, 0.8, 0.2);
    fillPath(ctx, shadeColor(o.top, -0.1), 0.3);
    ctx.beginPath();
    ctx.moveTo(6.1, -34.4);
    ctx.lineTo(7.4, -33.8);
    ctx.lineTo(7.2, -32);
    ctx.quadraticCurveTo(6.1, -30.8, 5, -32);
    ctx.lineTo(4.8, -33.8);
    ctx.closePath();
    fillPath(ctx, '#e8c25a', 0.2);
    rr(ctx, -8, -24.6, 4.4, 0.8, 0.2);
    fillPath(ctx, shadeColor(o.top, -0.1), 0.3);
  },
  apron(ctx, design, slim) {
    const o = design.outfit;
    collarPoints(ctx, shadeColor(o.top, -0.05));
    // The apron's bib, neck strap, waist ties and a big front pocket.
    ctx.strokeStyle = shadeColor(o.apron, -0.15);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-4.2, -37);
    ctx.lineTo(-3, -44.4);
    ctx.moveTo(4.2, -37);
    ctx.lineTo(3, -44.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -37.4);
    ctx.lineTo(5, -37.4);
    ctx.lineTo(5.4, -24);
    ctx.lineTo(slim ? 8.4 : 9.6, -23.4);
    ctx.lineTo(slim ? 9.6 : 10.6, -6.6);
    ctx.quadraticCurveTo(0, -5.4, slim ? -9.6 : -10.6, -6.6);
    ctx.lineTo(slim ? -8.4 : -9.6, -23.4);
    ctx.lineTo(-5.4, -24);
    ctx.closePath();
    fillPath(ctx, shadedFill(ctx, o.apron), 0.55);
    rr(ctx, -9.4, -24.4, 18.8, 1.4, 0.5);
    fillPath(ctx, shadeColor(o.apron, -0.15), 0.35);
    rr(ctx, -5, -19.4, 10, 5.4, 0.6);
    fillPath(ctx, shadeColor(o.apron, -0.06), 0.4);
    ctx.strokeStyle = shadeColor(o.apron, 0.3);
    ctx.lineWidth = 0.22;
    ctx.setLineDash([0.4, 0.3]);
    ctx.strokeRect(-4.6, -19, 9.2, 4.6);
    ctx.beginPath();
    ctx.moveTo(0, -19.4);
    ctx.lineTo(0, -14);
    ctx.stroke();
    ctx.setLineDash([]);
    // A pencil and a little name tag.
    rr(ctx, 2.2, -21.6, 0.7, 3, 0.2);
    fillPath(ctx, '#ffd166', 0.15);
    rr(ctx, -4, -35.4, 3.6, 1.4, 0.3);
    fillPath(ctx, '#ffffff', 0.2);
  },
  jacket(ctx, design, slim) {
    const o = design.outfit;
    ctx.beginPath();
    ctx.ellipse(0, -43.4, 4, 1.5, 0, 0, Math.PI);
    fillPath(ctx, shadeColor(o.inner, -0.1), 0.35);
    panels(ctx, o.top, slim, { open: 3.6, deep: -40 });
    // A stand collar, zip edges, chest and hip pockets with flaps.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 3.6, -43.4);
      ctx.lineTo(dir * 6.6, -45.8);
      ctx.lineTo(dir * 8.4, -42.8);
      ctx.lineTo(dir * 5, -41);
      ctx.closePath();
      fillPath(ctx, shadeColor(o.top, -0.12), 0.4);
      ctx.strokeStyle = '#c8ccd6';
      ctx.lineWidth = 0.3;
      ctx.setLineDash([0.3, 0.3]);
      ctx.beginPath();
      ctx.moveTo(dir * 1, -38);
      ctx.lineTo(dir * 1, -20);
      ctx.stroke();
      ctx.setLineDash([]);
      rr(ctx, dir * 5.6 - 2, -35.6, 4, 3.6, 0.4);
      fillPath(ctx, shadeColor(o.top, -0.05), 0.35);
      rr(ctx, dir * 5.6 - 2.2, -35.8, 4.4, 1.4, 0.4);
      fillPath(ctx, shadeColor(o.top, -0.15), 0.3);
      rr(ctx, dir * 6 - 2.2, -26.4, 4.4, 1.2, 0.4);
      fillPath(ctx, shadeColor(o.top, -0.15), 0.3);
    }
    // A print on the inner tee.
    dot(ctx, 0, -38, 0.9, shadeColor(o.inner, -0.25), 0);
    ribbedHem(ctx, o.top, -21.2, slim ? 7.8 : 9.8);
  },
  dress(ctx, design, slim) {
    const o = design.outfit;
    const trim = o.trim ?? '#ffffff';
    // A rounded collar, a bodice with buttons, a sash.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -44.2);
      ctx.quadraticCurveTo(dir * 3, -45.4, dir * 5, -44.2);
      ctx.quadraticCurveTo(dir * 5.4, -41.4, dir * 2.6, -41);
      ctx.quadraticCurveTo(dir * 0.8, -41.4, 0, -42.8);
      ctx.closePath();
      fillPath(ctx, trim, 0.4);
    }
    buttons(ctx, 0, [-38.4, -34.6, -30.8, -27], trim);
    rr(ctx, slim ? -7.8 : -9.8, -24.2, slim ? 15.6 : 19.6, 2.2, 0.6);
    fillPath(ctx, trim, 0.4);
    if (design.age === 'kid') drawBow(ctx, 0, -23.1, trim, 0.9);
    ctx.strokeStyle = shadeColor(o.top, -0.25);
    ctx.lineWidth = 0.3;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 4.4, -40);
      ctx.quadraticCurveTo(dir * 5.4, -32, dir * 4.6, -24.4);
      ctx.stroke();
    }
  },
  tee(ctx, design) {
    const o = design.outfit;
    ctx.beginPath();
    ctx.ellipse(0, -43.6, 3.8, 1.5, 0, 0, Math.PI);
    fillPath(ctx, shadeColor(o.top, -0.15), 0.4);
    // A big star print.
    if (o.print) {
      ctx.save();
      ctx.translate(0, -32);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 1.8 : 4;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      fillPath(ctx, o.print, 0.4);
      ctx.restore();
    }
    ctx.strokeStyle = shadeColor(o.top, -0.25);
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.quadraticCurveTo(-5, -26, -6.4, -28);
    ctx.stroke();
  },
  track(ctx, design, slim) {
    const o = design.outfit;
    // A zip-up track jacket: stand collar, zip, stripes from the shoulders.
    ctx.strokeStyle = '#d6dae4';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -43.8);
    ctx.lineTo(0, -20);
    ctx.stroke();
    rr(ctx, -0.6, -38.4, 1.2, 2, 0.3);
    fillPath(ctx, '#d6dae4', 0.2);
    rr(ctx, -4.6, -46.2, 9.2, 2.8, 1);
    fillPath(ctx, shadeColor(o.top, -0.08), 0.45);
    ctx.strokeStyle = o.stripe ?? '#ffffff';
    ctx.lineWidth = 0.8;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * (slim ? 7.8 : 9.4), -37);
      ctx.quadraticCurveTo(dir * (slim ? 7 : 8.6), -30, dir * (slim ? 7.4 : 9.2), -21.4);
      ctx.stroke();
    }
    ribbedHem(ctx, o.top, -21.4, slim ? 7.8 : 9.8);
  },
  suit(ctx, design, slim) {
    const o = design.outfit;
    ctx.beginPath();
    ctx.moveTo(-4.4, -43.6);
    ctx.lineTo(4.4, -43.6);
    ctx.lineTo(0, -30);
    ctx.closePath();
    fillPath(ctx, o.shirt, 0.4);
    collarPoints(ctx, o.shirt);
    ctx.beginPath();
    ctx.moveTo(-0.9, -42.6);
    ctx.lineTo(0.9, -42.6);
    ctx.lineTo(1.3, -33);
    ctx.lineTo(0, -31.6);
    ctx.lineTo(-1.3, -33);
    ctx.closePath();
    fillPath(ctx, o.tie, 0.3);
    ctx.fillStyle = shadeColor(o.tie, 0.25);
    for (const yy of [-40, -37, -34]) {
      ctx.beginPath();
      ctx.arc(0, yy, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    panels(ctx, o.top, slim, { open: 4.4, deep: -30 });
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 4.4, -43.4);
      ctx.lineTo(dir * 7.8, -42);
      ctx.lineTo(dir * 7.2, -37.6);
      ctx.lineTo(dir * 8.4, -36.6);
      ctx.lineTo(dir * 1.2, -28.4);
      ctx.closePath();
      fillPath(ctx, shadeColor(o.top, -0.12), 0.4);
    }
    // Elbow-patch tweed: a faint herringbone, a pocket square, a pen.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.25;
    for (let yy = -40; yy < -20; yy += 1.4) {
      ctx.beginPath();
      ctx.moveTo(-9, yy);
      ctx.lineTo(-7.6, yy + 0.7);
      ctx.lineTo(-6.2, yy);
      ctx.moveTo(6.2, yy);
      ctx.lineTo(7.6, yy + 0.7);
      ctx.lineTo(9, yy);
      ctx.stroke();
    }
    rr(ctx, 4.4, -35.2, 3.6, 0.8, 0.2);
    fillPath(ctx, shadeColor(o.top, -0.15), 0.3);
    ctx.beginPath();
    ctx.moveTo(4.8, -35.2);
    ctx.lineTo(5.6, -36.8);
    ctx.lineTo(6.4, -35.6);
    ctx.lineTo(7.2, -37);
    ctx.lineTo(7.6, -35.2);
    ctx.closePath();
    fillPath(ctx, o.tie, 0.25);
    buttons(ctx, -1.6, [-25.4, -22], '#3a2a1e');
  },
  blouse(ctx, design, slim) {
    const o = design.outfit;
    // A ruffled collar and a soft bow, tucked into the skirt.
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 1.4, -43.6 + Math.abs(i) * 0.25, 0.9, 1.3, i * 0.2, 0, Math.PI * 2);
      fillPath(ctx, shadeColor(o.top, 0.2), 0.3);
    }
    buttons(ctx, 0, [-39, -35, -31, -27], '#ffffff');
    ctx.strokeStyle = shadeColor(o.top, -0.2);
    ctx.lineWidth = 0.3;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 3, -40);
      ctx.quadraticCurveTo(dir * 4.4, -30, dir * 3.6, -22.6);
      ctx.stroke();
    }
    // The skirt's waistband.
    rr(ctx, slim ? -7.8 : -9.8, -23.2, slim ? 15.6 : 19.6, 1.8, 0.4);
    fillPath(ctx, shadeColor(o.skirt ?? o.top, -0.1), 0.35);
    // A brooch.
    dot(ctx, 3.4, -37.4, 0.9, '#c9a8e8', 0.2);
    dot(ctx, 3.4, -37.4, 0.4, '#fff8f0', 0);
  },
  puffer(ctx, design, slim) {
    const c = design.outfit.top;
    // Quilted baffles bulging out past the body line, a high zipped collar.
    const s2 = slim ? 9.8 : 11.2;
    for (let i = 0; i < 5; i++) {
      const y0 = -43 + i * 4.6;
      ctx.beginPath();
      ctx.moveTo(-s2 + Math.abs(i - 2) * 0.3, y0);
      ctx.quadraticCurveTo(0, y0 - 0.6, s2 - Math.abs(i - 2) * 0.3, y0);
      ctx.quadraticCurveTo(s2 + 0.8, y0 + 2.3, s2 - Math.abs(i - 2) * 0.3, y0 + 4.6);
      ctx.quadraticCurveTo(0, y0 + 5.2, -s2 + Math.abs(i - 2) * 0.3, y0 + 4.6);
      ctx.quadraticCurveTo(-s2 - 0.8, y0 + 2.3, -s2 + Math.abs(i - 2) * 0.3, y0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + 4.6);
      g.addColorStop(0, shadeColor(c, 0.18));
      g.addColorStop(0.6, c);
      g.addColorStop(1, shadeColor(c, -0.2));
      fillPath(ctx, g, 0.45);
    }
    rr(ctx, -4.8, -47.2, 9.6, 4.6, 1.6);
    fillPath(ctx, shadeColor(c, -0.08), 0.5);
    ctx.strokeStyle = '#d6dae4';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -46.6);
    ctx.lineTo(0, -20);
    ctx.stroke();
    rr(ctx, -0.6, -45, 1.2, 2.2, 0.3);
    fillPath(ctx, '#d6dae4', 0.2);
    // A brand patch on the sleeve-side chest.
    rr(ctx, -7.6, -36.6, 2.6, 1.4, 0.3);
    fillPath(ctx, '#1e1e24', 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7.2, -36.2, 1.8, 0.4);
  },
  trench(ctx, design, slim) {
    const o = design.outfit;
    const c = o.top;
    // The coat's skirt over the legs, then a double-breasted front.
    const w = slim ? 8.6 : 10.4;
    ctx.beginPath();
    ctx.moveTo(-w, -22);
    ctx.lineTo(w, -22);
    ctx.lineTo(w + 2, -6.6);
    ctx.quadraticCurveTo(0, -5.4, -w - 2, -6.6);
    ctx.closePath();
    fillPath(ctx, shadedFill(ctx, c), 0.55);
    ctx.strokeStyle = shadeColor(c, -0.28);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(1.6, -22);
    ctx.lineTo(2, -6);
    ctx.moveTo(-w + 2, -20);
    ctx.quadraticCurveTo(-w + 1, -12, -w, -7);
    ctx.stroke();
    collarPoints(ctx, o.inner ?? '#ffffff');
    panels(ctx, c, slim, { open: 4.6, deep: -36, hem: -20 });
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 4.6, -43.4);
      ctx.lineTo(dir * 8.4, -43);
      ctx.lineTo(dir * 7.4, -39);
      ctx.lineTo(dir * 9, -38.4);
      ctx.lineTo(dir * 3, -33);
      ctx.closePath();
      fillPath(ctx, shadeColor(c, -0.1), 0.45);
      // Epaulettes and the gun flap.
      rr(ctx, dir * 8.4 - 1.6, -44, 3.2, 1.2, 0.3);
      fillPath(ctx, shadeColor(c, -0.08), 0.3);
    }
    for (const bx of [-3, 3]) buttons(ctx, bx, [-31, -27.4, -23.8], '#4a3424');
    // The belt, buckled, its end hanging.
    rr(ctx, -w - 0.4, -22.8, (w + 0.4) * 2, 2, 0.4);
    fillPath(ctx, shadeColor(c, -0.12), 0.4);
    rr(ctx, -1.6, -23.2, 3.2, 2.8, 0.4);
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    rr(ctx, 1.6, -22.4, 1.2, 4.6, 0.4);
    fillPath(ctx, shadeColor(c, -0.12), 0.3);
  },
  overalls(ctx, design, slim) {
    const o = design.outfit;
    const denim = o.bottom ?? '#4a6a9a';
    // The bib and its straps over a tee, a bib pocket, brass buttons.
    ctx.beginPath();
    ctx.ellipse(0, -43.6, 3.8, 1.5, 0, 0, Math.PI);
    fillPath(ctx, shadeColor(o.top, -0.15), 0.4);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 3.6, -43.4);
      ctx.lineTo(dir * 6, -43.6);
      ctx.lineTo(dir * 5.2, -33);
      ctx.lineTo(dir * 3.4, -33);
      ctx.closePath();
      fillPath(ctx, denim, 0.4);
      dot(ctx, dir * 4.3, -33.6, 0.65, '#e8c25a', 0.2);
    }
    const w = slim ? 7.8 : 9.8;
    ctx.beginPath();
    ctx.moveTo(-5.6, -33.4);
    ctx.lineTo(5.6, -33.4);
    ctx.lineTo(w, -22);
    ctx.lineTo(w, -19.6);
    ctx.lineTo(-w, -19.6);
    ctx.lineTo(-w, -22);
    ctx.closePath();
    fillPath(ctx, shadedFill(ctx, denim), 0.5);
    rr(ctx, -2.6, -32, 5.2, 4, 0.5);
    fillPath(ctx, shadeColor(denim, -0.06), 0.35);
    ctx.strokeStyle = '#e8c25a';
    ctx.lineWidth = 0.2;
    ctx.setLineDash([0.4, 0.3]);
    ctx.strokeRect(-2.2, -31.6, 4.4, 3.2);
    ctx.beginPath();
    ctx.moveTo(-w + 0.6, -21);
    ctx.lineTo(w - 0.6, -21);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  hanbok(ctx, design, slim) {
    const o = design.outfit;
    const trim = o.trim ?? '#e8558f';
    // The chima (if a skirt), from high under the jeogori to the ankles.
    if (o.skirt) {
      ctx.beginPath();
      ctx.moveTo(-7.4, -34);
      ctx.lineTo(7.4, -34);
      ctx.quadraticCurveTo(12, -18, 13, -3.4);
      ctx.quadraticCurveTo(0, -1.4, -13, -3.4);
      ctx.quadraticCurveTo(-12, -18, -7.4, -34);
      ctx.closePath();
      fillPath(ctx, shadedFill(ctx, o.skirt), 0.55);
      ctx.strokeStyle = shadeColor(o.skirt, -0.25);
      ctx.lineWidth = 0.35;
      for (const dir of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * 3, -33);
        ctx.quadraticCurveTo(dir * 5, -18, dir * 7.4, -3);
        ctx.stroke();
      }
      ctx.strokeStyle = trim;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-12.6, -5.2);
      ctx.quadraticCurveTo(0, -3.2, 12.6, -5.2);
      ctx.stroke();
    }
    // The short jeogori with its white collar band and crossed front.
    const w = slim ? 9 : 10.4;
    ctx.beginPath();
    ctx.moveTo(-4.4, -43.8);
    ctx.quadraticCurveTo(-w, -43.4, -w, -38);
    ctx.lineTo(-w + 0.4, o.skirt ? -32.4 : -22);
    ctx.quadraticCurveTo(0, o.skirt ? -31 : -20.6, w - 0.4, o.skirt ? -32.4 : -22);
    ctx.lineTo(w, -38);
    ctx.quadraticCurveTo(w, -43.4, 4.4, -43.8);
    ctx.closePath();
    fillPath(ctx, shadedFill(ctx, o.top), 0.55);
    ctx.beginPath();
    ctx.moveTo(-3.6, -44);
    ctx.lineTo(4.6, -36);
    ctx.lineTo(3.4, -35);
    ctx.lineTo(-4.4, -42.6);
    ctx.closePath();
    fillPath(ctx, '#ffffff', 0.35);
    ctx.beginPath();
    ctx.moveTo(3.6, -44);
    ctx.lineTo(-1, -39);
    ctx.lineTo(-0.2, -38);
    ctx.lineTo(4.4, -42.8);
    ctx.closePath();
    fillPath(ctx, shadeColor(o.top, -0.15), 0.3);
    // The goreum: a long ribbon tied in a loop, its ends hanging.
    ctx.save();
    ctx.translate(2.6, -36.2);
    ctx.beginPath();
    ctx.ellipse(-1.6, 0, 1.8, 0.9, -0.3, 0, Math.PI * 2);
    fillPath(ctx, trim, 0.3);
    for (const [dx, len, r] of [[-0.2, 9, 0.12], [0.6, 7.4, -0.05]]) {
      ctx.save();
      ctx.translate(dx, 0);
      ctx.rotate(r);
      rr(ctx, -0.6, 0, 1.2, len, 0.3);
      fillPath(ctx, trim, 0.3);
      ctx.restore();
    }
    ctx.restore();
  },
  gakuran(ctx, design) {
    const o = design.outfit;
    // A high stand collar, a column of gold buttons, a school badge.
    rr(ctx, -4.4, -46.4, 8.8, 3.2, 1);
    fillPath(ctx, shadeColor(o.top, -0.1), 0.45);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-4, -43.6);
    ctx.lineTo(4, -43.6);
    ctx.stroke();
    dot(ctx, 3, -45, 0.6, o.buttons ?? '#e8c25a', 0.15);
    ctx.strokeStyle = shadeColor(o.top, -0.3);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, -43);
    ctx.lineTo(0, -20);
    ctx.stroke();
    buttons(ctx, 0.9, [-40.4, -36.6, -32.8, -29, -25.2], o.buttons ?? '#e8c25a');
    rr(ctx, -8, -35.6, 4.4, 0.8, 0.2);
    fillPath(ctx, shadeColor(o.top, -0.15), 0.3);
  },
};

// -- Arms ---------------------------------------------------------------------

function sleeveColour(design) {
  return design.outfit.top;
}

function shortSleeved(design) {
  return design.outfit.kind === 'tee';
}

/** One arm: the sleeve (short or long, with a cuff), then the hand. */
function arm(ctx, design, shoulder, elbow, wrist) {
  const c = sleeveColour(design);
  if (shortSleeved(design)) {
    const mid = [shoulder[0] + (elbow[0] - shoulder[0]) * 0.6, shoulder[1] + (elbow[1] - shoulder[1]) * 0.6];
    sleeve(ctx, mid, elbow, wrist, design.skin, shadeColor(design.skin, -0.1), 3.4);
    sleeve(ctx, shoulder, mid, mid, c, shadeColor(c, -0.15), 5);
    return;
  }
  const puffy = design.outfit.kind === 'puffer';
  sleeve(ctx, shoulder, elbow, wrist, c, shadeColor(c, -0.15), (design.age === 'kid' ? 4.4 : 4.9) + (puffy ? 1.4 : 0));
  if (puffy) {
    // Quilting lines around the sleeve.
    ctx.strokeStyle = shadeColor(c, -0.25);
    ctx.lineWidth = 0.3;
    for (const f of [0.35, 0.7]) {
      for (const [p, q] of [[shoulder, elbow], [elbow, wrist]]) {
        const mx = p[0] + (q[0] - p[0]) * f;
        const my = p[1] + (q[1] - p[1]) * f;
        ctx.beginPath();
        ctx.moveTo(mx - 2.4, my);
        ctx.lineTo(mx + 2.4, my - 0.4);
        ctx.stroke();
      }
    }
  }
  // Creases bunching at the inside of the elbow.
  ctx.strokeStyle = shadeColor(c, -0.3);
  ctx.lineWidth = 0.3;
  for (const off of [-0.9, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(elbow[0] - 1.4, elbow[1] + off);
    ctx.quadraticCurveTo(elbow[0], elbow[1] + off + 0.7, elbow[0] + 1.3, elbow[1] + off - 0.2);
    ctx.stroke();
  }
  const a = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
  ctx.save();
  ctx.translate(wrist[0] - Math.cos(a) * 0.7, wrist[1] - Math.sin(a) * 0.7);
  ctx.rotate(a - Math.PI / 2);
  rr(ctx, -2.3, -0.9, 4.6, design.outfit.kind === 'hanbok' ? 2.4 : 1.6, 0.5);
  fillPath(ctx, design.outfit.kind === 'hanbok' ? (design.outfit.trim ?? '#e8558f') : shadeColor(c, design.outfit.kind === 'track' ? 0.4 : -0.1), 0.35);
  ctx.restore();
}

function shoulders(slim) {
  return slim ? 8.8 : 10.2;
}

/** The right arm (viewer's left) swings, or hangs relaxed. */
function drawFreeArm(ctx, design, slim, stride) {
  const shoulder = [-shoulders(slim), -39.6];
  const swing = -stride * 3.8;
  const { elbow, wrist } = swingArm(shoulder, swing, -1);
  arm(ctx, design, shoulder, elbow, wrist);
  drawHand(ctx, wrist[0], wrist[1] + 0.4, swing * 0.04, { skin: design.skin, deep: shadeColor(design.skin, -0.22) });
  drawWristTrinkets(ctx, design, wrist);
  if (design.extras?.handbag && design.prop !== 'handbag') drawShoulderBag(ctx, design.extras.handbag);
}

function drawShoulderBag(ctx, colour) {
  ctx.strokeStyle = shadeColor(colour, -0.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-6, -43);
  ctx.lineTo(-10.6, -24);
  ctx.stroke();
  rr(ctx, -13.6, -25, 6.2, 5, 1);
  fillPath(ctx, colour, 0.45);
}

/** The left arm (viewer's right) holds the prop: raised, hugged to the chest, or hanging at the side. */
function drawPropArm(ctx, design, slim, stride, prop, t) {
  const shoulder = [shoulders(slim), -39.6];
  const skin = { skin: design.skin, deep: shadeColor(design.skin, -0.22) };
  const pose = prop?.pose ?? 'hang';
  if (pose === 'raise') {
    const elbow = [shoulder[0] + 4.2, -34.6];
    const wrist = [shoulder[0] + 3.2, -45.4 + Math.sin(t * 3) * 0.6];
    arm(ctx, design, shoulder, elbow, wrist);
    prop.draw(ctx, [wrist[0], wrist[1] - 1.6], t, design);
    drawHand(ctx, wrist[0], wrist[1] - 1, Math.PI, skin);
    return;
  }
  if (pose === 'hug') {
    const elbow = [shoulder[0] + 2.8, -30.2];
    const wrist = [shoulder[0] - 1.6, -27.4];
    arm(ctx, design, shoulder, elbow, wrist);
    prop.draw(ctx, [wrist[0], wrist[1] - 0.4], t, design);
    drawHand(ctx, wrist[0] - 0.6, wrist[1] + 0.2, 1.3, skin);
    return;
  }
  const { elbow, wrist } = swingArm(shoulder, stride * 3.8, 1);
  arm(ctx, design, shoulder, elbow, wrist);
  drawHand(ctx, wrist[0], wrist[1] + 0.4, stride * 0.15, skin);
  prop?.draw(ctx, [wrist[0], wrist[1] + 2], t, design);
}
