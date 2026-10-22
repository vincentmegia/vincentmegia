// What each Library Shift patron carries (library-people.js's `prop`), drawn
// by patron.js in the hand or on the back. Every prop says how the arm
// holds it — `raise` (up beside the head), `hug` (against the chest),
// `hang` (from the hand at the side), `none` (worn) — and whether part of it
// goes behind the body (`back`). Pure canvas calls.
//
// Coordinates are the anime frame's (feet at 0, face centre about -55);
// `hand` is where the holding hand is.

import { shadeColor } from '../shared/people.js';
import { fillPath, rr, dot, outline } from './staff-kit.js';
import { MORE_PROPS } from './patron-props-more.js';

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

/** A closed book seen from the front: cover, spine edge, pages, a title band. */
function book(ctx, x, y, w, h, cover, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  rr(ctx, -w / 2 + 0.6, -h / 2 + 0.4, w, h, 0.4);
  fillPath(ctx, '#fbf2dc', 0.35);
  rr(ctx, -w / 2, -h / 2, w, h, 0.5);
  fillPath(ctx, cover, 0.45);
  ctx.fillStyle = shadeColor(cover, -0.25);
  ctx.fillRect(-w / 2, -h / 2, 1, h);
  ctx.restore();
}

const FIRST_PROPS = {
  // K-pop fan: a light stick, its heart glowing and pulsing.
  lightstick: {
    pose: 'raise',
    draw(ctx, [hx, hy], t) {
      const glow = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(0.15 + Math.sin(t * 3) * 0.12);
      rr(ctx, -0.9, -2, 1.8, 8, 0.6);
      fillPath(ctx, '#f4f4f8', 0.4);
      ctx.fillStyle = `rgba(255,143,184,${0.25 * glow})`;
      ctx.beginPath();
      ctx.arc(0, -6, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -2.4);
      ctx.bezierCurveTo(-4.4, -5, -2.6, -9.4, 0, -7.2);
      ctx.bezierCurveTo(2.6, -9.4, 4.4, -5, 0, -2.4);
      ctx.closePath();
      fillPath(ctx, `rgba(255,${150 + 60 * glow},${200 + 30 * glow},1)`, 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-1.8, -6.6, 0.7, 0.7);
      ctx.restore();
    },
  },
  // Neighbourhood auntie: a structured handbag on her forearm.
  handbag: {
    pose: 'hug',
    draw(ctx, [hx, hy], _t, design) {
      const c = design.extras?.handbag ?? '#a0522d';
      ctx.strokeStyle = shadeColor(c, -0.3);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(hx + 1.6, hy + 1.6, 2.8, Math.PI, 0);
      ctx.stroke();
      rr(ctx, hx - 2.4, hy + 1.4, 8, 6, 1);
      const g = ctx.createLinearGradient(0, hy + 1.4, 0, hy + 7.4);
      g.addColorStop(0, shadeColor(c, 0.12));
      g.addColorStop(1, c);
      fillPath(ctx, g, 0.45);
      ctx.beginPath();
      ctx.moveTo(hx - 2.4, hy + 3.2);
      ctx.quadraticCurveTo(hx + 1.6, hy + 4.6, hx + 5.6, hy + 3.2);
      outline(ctx, 0.3);
      rr(ctx, hx + 0.9, hy + 3.4, 1.4, 1, 0.3);
      fillPath(ctx, '#e8c25a', 0.15);
    },
  },
  // Exam student: a fat 수능 workbook bristling with tabs.
  workbook: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      for (const [i, c] of ['#ff8fb8', '#ffd166', '#7ac74f', '#4fa8e0'].entries()) {
        rr(ctx, hx - 4.4 + i * 1.8, hy - 9.4, 1.3, 2.2, 0.2);
        fillPath(ctx, c, 0.2);
      }
      book(ctx, hx - 1.2, hy - 3.4, 8.4, 11, '#2e6ad8', -0.12);
      ctx.save();
      ctx.translate(hx - 1.2, hy - 3.4);
      ctx.rotate(-0.12);
      rr(ctx, -3.2, -3.6, 6.4, 2.4, 0.3);
      fillPath(ctx, '#ffffff', 0.2);
      ctx.fillStyle = '#d23a4a';
      for (const x of [-2.4, -1.2, 0, 1.2]) ctx.fillRect(x, -3, 0.9, 1.2);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-3.4, 2.4, 6.8, 1);
      ctx.restore();
    },
  },
  // Webtoon artist: a drawing tablet showing a panel, and a stylus.
  tablet: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      ctx.save();
      ctx.translate(hx - 1.6, hy - 4);
      ctx.rotate(-0.15);
      rr(ctx, -4.6, -6, 9.2, 12, 1);
      fillPath(ctx, '#2a2a34', 0.45);
      rr(ctx, -3.9, -5.3, 7.8, 10.6, 0.4);
      ctx.fillStyle = '#fbfbff';
      ctx.fill();
      // Two comic panels: a face and a speech bubble.
      ctx.strokeStyle = '#2a2a34';
      ctx.lineWidth = 0.25;
      ctx.strokeRect(-3.4, -4.8, 6.8, 4.6);
      ctx.strokeRect(-3.4, 0.4, 6.8, 4.4);
      dot(ctx, -1, -2.4, 1.3, '#f6d6bd', 0.2);
      ctx.fillStyle = '#2a2030';
      ctx.fillRect(-2.2, -3.8, 2.4, 0.8);
      ctx.beginPath();
      ctx.ellipse(1.6, 2.2, 1.6, 1, 0, 0, Math.PI * 2);
      fillPath(ctx, '#ffffff', 0.2);
      // The line being drawn, growing.
      ctx.strokeStyle = '#e8558f';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      const grow = (t * 0.5) % 1;
      ctx.moveTo(-3, 4.2);
      ctx.lineTo(-3 + grow * 3, 4.2 - grow * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(hx + 2.2, hy - 6);
      ctx.rotate(0.5);
      rr(ctx, -0.4, -4, 0.8, 7, 0.3);
      fillPath(ctx, '#d6dae4', 0.3);
      ctx.restore();
    },
  },
  // Café barista: a takeaway latte from her own café.
  latte: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const x = hx - 1;
      const y = hy - 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x - 2.4, y - 6.4);
      ctx.lineTo(x + 2.4, y - 6.4);
      ctx.lineTo(x + 2, y);
      ctx.closePath();
      fillPath(ctx, '#f8f4ea', 0.4);
      rr(ctx, x - 2.35, y - 4.6, 4.7, 2.2, 0.2);
      fillPath(ctx, '#3fb58f', 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y - 3.5, 0.8, 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      rr(ctx, x - 2.7, y - 7.6, 5.4, 1.3, 0.4);
      fillPath(ctx, '#6a4a32', 0.35);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.4;
      const rise = (t * 0.6) % 1;
      ctx.globalAlpha = 1 - rise;
      ctx.beginPath();
      ctx.moveTo(x, y - 8 - rise * 3);
      ctx.bezierCurveTo(x - 1, y - 9.4 - rise * 3, x + 1, y - 10 - rise * 3, x, y - 11.4 - rise * 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
  },
  // Baduk grandpa: a lidded wooden bowl of stones.
  badukBowl: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      const x = hx - 1;
      const y = hy - 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 4.6, 3.6, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - 1.4, y - 1.4, 0.5, x, y, 4.8);
      g.addColorStop(0, '#d8a868');
      g.addColorStop(1, '#8a5a2a');
      fillPath(ctx, g, 0.45);
      ctx.strokeStyle = 'rgba(90,50,20,0.5)';
      ctx.lineWidth = 0.25;
      for (const r of [1.6, 2.8, 3.8]) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r * 0.9, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 3.6, 1.2, 0, 0, Math.PI * 2);
      fillPath(ctx, '#a87a3a', 0.35);
      // A black and a white stone on the lid.
      dot(ctx, x - 1.2, y - 3.4, 0.9, '#1e1a1e', 0.2);
      dot(ctx, x + 1, y - 3.2, 0.9, '#f8f8f4', 0.2);
    },
  },
  // Kid: a picture book with a bunny on the cover, hugged close.
  pictureBook: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      book(ctx, hx - 1.4, hy - 3.4, 8.6, 8, '#ffb0cc', -0.1);
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.4);
      ctx.rotate(-0.1);
      dot(ctx, 0, 0.6, 1.8, '#ffffff', 0.25);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(dir * 0.8, -2, 0.55, 1.5, dir * 0.15, 0, Math.PI * 2);
        fillPath(ctx, '#ffffff', 0.2);
      }
      dot(ctx, -0.6, 0.4, 0.2, '#2a1e1a', 0);
      dot(ctx, 0.6, 0.4, 0.2, '#2a1e1a', 0);
      ctx.fillStyle = '#ffd166';
      star(ctx, 2.8, -2.4, 0.9);
      ctx.fill();
      ctx.restore();
    },
  },
  // The other kid: a kick scooter, held by its handlebar.
  scooter: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      const deckY = 5.6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(24,18,44,0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy);
      ctx.lineTo(hx + 4.6, deckY - 1);
      ctx.stroke();
      ctx.strokeStyle = '#d6dae4';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(24,18,44,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx - 1.6, hy);
      ctx.lineTo(hx + 4.2, hy);
      ctx.stroke();
      ctx.strokeStyle = '#e06a5b';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.lineCap = 'butt';
      rr(ctx, hx + 3.4, deckY - 1.4, 10, 1.6, 0.6);
      fillPath(ctx, '#4fa8e0', 0.4);
      for (const wx of [hx + 4.6, hx + 12.6]) {
        dot(ctx, wx, deckY + 1.2, 1.5, '#2a2a34', 0.3);
        dot(ctx, wx, deckY + 1.2, 0.6, '#d6dae4', 0);
      }
    },
  },
  // Pilates mom: a rolled yoga mat on her back, and a water bottle.
  yogaMat: {
    pose: 'hang',
    back: true,
    drawBack(ctx) {
      // Slung diagonally across her back, both ends showing.
      ctx.save();
      ctx.translate(0, -32);
      ctx.rotate(-0.55);
      rr(ctx, -17, -2.6, 34, 5.2, 2.6);
      const g = ctx.createLinearGradient(0, -2.6, 0, 2.6);
      g.addColorStop(0, '#b8e6d8');
      g.addColorStop(1, '#6ac4a8');
      fillPath(ctx, g, 0.5);
      for (const ex of [-17, 17]) {
        ctx.beginPath();
        ctx.ellipse(ex, 0, 1.3, 2.6, 0, 0, Math.PI * 2);
        fillPath(ctx, '#8ad4bc', 0.35);
        ctx.strokeStyle = '#5a9a8a';
        ctx.lineWidth = 0.25;
        ctx.beginPath();
        ctx.ellipse(ex, 0, 0.6, 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8a7ab8';
      ctx.lineWidth = 0.8;
      for (const sx of [-11, 11]) {
        ctx.beginPath();
        ctx.moveTo(sx, -2.8);
        ctx.lineTo(sx, 2.8);
        ctx.stroke();
      }
      ctx.restore();
    },
    draw(ctx, [hx, hy]) {
      rr(ctx, hx - 1.4, hy + 1, 2.8, 7, 1);
      fillPath(ctx, 'rgba(180,220,255,0.85)', 0.4);
      rr(ctx, hx - 1.2, hy + 0.2, 2.4, 1.4, 0.4);
      fillPath(ctx, '#c9b6e8', 0.3);
      ctx.fillStyle = 'rgba(80,150,220,0.5)';
      ctx.fillRect(hx - 1.2, hy + 4, 2.4, 3.8);
    },
  },
  // Professor: a worn leather briefcase.
  briefcase: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      ctx.strokeStyle = '#4a2a18';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(hx, hy + 2.2, 1.8, Math.PI, 0);
      ctx.stroke();
      rr(ctx, hx - 5, hy + 2, 10, 7.4, 1);
      const g = ctx.createLinearGradient(0, hy + 2, 0, hy + 9.4);
      g.addColorStop(0, '#8a5a32');
      g.addColorStop(1, '#6a3e22');
      fillPath(ctx, g, 0.45);
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy + 4.4);
      ctx.lineTo(hx + 5, hy + 4.4);
      outline(ctx, 0.3);
      for (const dx of [-2.6, 2.6]) {
        rr(ctx, hx + dx - 0.7, hy + 3.8, 1.4, 1.4, 0.2);
        fillPath(ctx, '#e8c25a', 0.15);
      }
      // A rolled paper sticking out.
      rr(ctx, hx + 2.6, hy - 0.4, 1.4, 3, 0.4);
      fillPath(ctx, '#fbf6e6', 0.25);
    },
  },
  // All-nighter: a can of energy drink.
  energyDrink: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      const x = hx - 0.8;
      rr(ctx, x - 1.7, hy - 6.6, 3.4, 6.6, 0.6);
      const g = ctx.createLinearGradient(x - 1.7, 0, x + 1.7, 0);
      g.addColorStop(0, '#3a3a48');
      g.addColorStop(0.4, '#6a6a7a');
      g.addColorStop(1, '#2a2a34');
      fillPath(ctx, g, 0.4);
      ctx.fillStyle = '#c4f04a';
      ctx.beginPath();
      ctx.moveTo(x - 0.4, hy - 5.2);
      ctx.lineTo(x + 0.8, hy - 3.8);
      ctx.lineTo(x - 0.2, hy - 3.6);
      ctx.lineTo(x + 0.6, hy - 1.6);
      ctx.lineTo(x - 0.8, hy - 3.4);
      ctx.lineTo(x + 0.2, hy - 3.6);
      ctx.closePath();
      ctx.fill();
      rr(ctx, x - 1.5, hy - 7.2, 3, 0.8, 0.3);
      fillPath(ctx, '#c8ccd6', 0.25);
    },
  },
  // Cat lover: a tote with a cat peeking out of it.
  catTote: {
    pose: 'hang',
    draw(ctx, [hx, hy], t) {
      ctx.strokeStyle = '#d8c8a8';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 4);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx + 3, hy + 4);
      ctx.stroke();
      // The cat, head and paws over the edge, ears twitching.
      const twitch = Math.sin(t * 4) > 0.9 ? 0.3 : 0;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 4.4, 3, 2.4, 0, 0, Math.PI * 2);
      fillPath(ctx, '#f2a65a', 0.4);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + dir * 1.2, hy + 2.6);
        ctx.lineTo(hx + dir * (2.8 + (dir > 0 ? twitch : 0)), hy + 1);
        ctx.lineTo(hx + dir * 2.8, hy + 3.4);
        ctx.closePath();
        fillPath(ctx, '#f2a65a', 0.3);
      }
      ctx.strokeStyle = '#c4782a';
      ctx.lineWidth = 0.3;
      for (const dx of [-0.8, 0, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(hx + dx, hy + 2.4);
        ctx.lineTo(hx + dx, hy + 3.4);
        ctx.stroke();
      }
      for (const dir of [-1, 1]) {
        ctx.strokeStyle = '#2a1e1a';
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.arc(hx + dir * 1.1, hy + 4.4, 0.5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      dot(ctx, hx, hy + 5.2, 0.3, '#e8558f', 0);
      rr(ctx, hx - 4.6, hy + 5.6, 9.2, 8.4, 0.8);
      fillPath(ctx, '#efe2c4', 0.45);
      for (const dir of [-1, 1]) dot(ctx, hx + dir * 1.8, hy + 6, 0.8, '#f2a65a', 0.25);
      // A printed paw.
      dot(ctx, hx, hy + 10.4, 1, '#8a5a3a', 0);
      for (const [dx, dy] of [[-1.2, -1.4], [0, -1.8], [1.2, -1.4]]) dot(ctx, hx + dx, hy + 10.4 + dy, 0.4, '#8a5a3a', 0);
    },
  },
  // Backpacker: a huge hiking pack behind, and a folded map in hand.
  hikingPack: {
    pose: 'hug',
    back: true,
    drawBack(ctx) {
      rr(ctx, -12.6, -48, 25.2, 30, 4);
      const g = ctx.createLinearGradient(-12, 0, 12, 0);
      g.addColorStop(0, '#e06a3a');
      g.addColorStop(1, '#a8482a');
      fillPath(ctx, g, 0.55);
      // A bedroll strapped on top.
      rr(ctx, -11, -52.6, 22, 5, 2.4);
      fillPath(ctx, '#4f8a5a', 0.45);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 0.7;
      for (const x of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(x, -52.8);
        ctx.lineTo(x, -47.6);
        ctx.stroke();
      }
    },
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3);
      ctx.rotate(-0.2);
      rr(ctx, -4, -3.4, 8, 6.8, 0.3);
      fillPath(ctx, '#f6eccc', 0.4);
      ctx.strokeStyle = 'rgba(120,100,60,0.5)';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(-1.3, -3.4);
      ctx.lineTo(-1.3, 3.4);
      ctx.moveTo(1.3, -3.4);
      ctx.lineTo(1.3, 3.4);
      ctx.stroke();
      ctx.strokeStyle = '#4fa8e0';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-3.4, 1.6);
      ctx.quadraticCurveTo(-1, -2, 2.6, 0.4);
      ctx.stroke();
      ctx.strokeStyle = '#d23a4a';
      ctx.setLineDash([0.5, 0.4]);
      ctx.beginPath();
      ctx.moveTo(-2.8, -2.2);
      ctx.lineTo(2.4, 2.4);
      ctx.stroke();
      ctx.setLineDash([]);
      dot(ctx, 2.4, 2.4, 0.5, '#d23a4a', 0);
      ctx.restore();
    },
  },
  // Retired teacher: knitting, a ball of yarn and two needles.
  knitting: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const x = hx - 1.6;
      const y = hy - 3;
      // The knitted piece hanging from the needles.
      rr(ctx, x - 3.4, y - 1, 6.8, 5, 0.6);
      fillPath(ctx, '#e8709c', 0.4);
      ctx.strokeStyle = '#c4507a';
      ctx.lineWidth = 0.2;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          ctx.beginPath();
          ctx.moveTo(x - 3 + c * 1.1, y + r * 1.1);
          ctx.lineTo(x - 2.5 + c * 1.1, y + 0.8 + r * 1.1);
          ctx.lineTo(x - 2 + c * 1.1, y + r * 1.1);
          ctx.stroke();
        }
      }
      const click = Math.sin(t * 6) * 0.08;
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 0.5;
      ctx.lineCap = 'round';
      for (const [r, dx] of [[-0.5 + click, -3], [0.5 - click, 3]]) {
        ctx.save();
        ctx.translate(x + dx * 0.3, y - 1);
        ctx.rotate(r);
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineCap = 'butt';
      // The yarn ball tucked against her.
      dot(ctx, x + 4.6, y + 5.4, 2.2, '#e8709c', 0.4);
      ctx.strokeStyle = '#c4507a';
      ctx.lineWidth = 0.25;
      for (const a of [0, 0.8, 1.6]) {
        ctx.beginPath();
        ctx.ellipse(x + 4.6, y + 5.4, 2, 0.8, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  // Indie guitarist: a guitar case on his back, a set list in hand.
  guitarCase: {
    pose: 'hang',
    back: true,
    drawBack(ctx) {
      // On his back, the neck rising past his left shoulder (viewer's right).
      ctx.save();
      ctx.translate(2, -27);
      ctx.rotate(0.42);
      ctx.beginPath();
      ctx.ellipse(0, 6, 8, 9, 0, 0, Math.PI * 2);
      fillPath(ctx, '#1e1e24', 0.55);
      ctx.beginPath();
      ctx.ellipse(0, -7, 6, 6.6, 0, 0, Math.PI * 2);
      fillPath(ctx, '#1e1e24', 0.55);
      rr(ctx, -2.4, -32, 4.8, 22, 1.8);
      fillPath(ctx, '#1e1e24', 0.55);
      rr(ctx, -3, -36, 6, 5.4, 1.6);
      fillPath(ctx, '#26262e', 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-1.2, -30);
      ctx.lineTo(-1.2, -12);
      ctx.stroke();
      // Stickers on the neck where they show.
      rr(ctx, -2, -26, 4, 2.4, 0.4);
      fillPath(ctx, '#4fa8e0', 0.2);
      dot(ctx, 0, -20, 1.4, '#ffd166', 0.2);
      ctx.fillStyle = '#ff8fb8';
      star(ctx, 0, -33.4, 1.4);
      ctx.fill();
      ctx.restore();
    },
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx, hy + 3.4);
      ctx.rotate(0.1);
      rr(ctx, -2.4, -1.4, 4.8, 6.4, 0.2);
      fillPath(ctx, '#fbfbf6', 0.35);
      ctx.fillStyle = '#2a2a34';
      for (let i = 0; i < 4; i++) ctx.fillRect(-1.8, 0.2 + i * 1.2, 2.6 + (i % 2) * 0.8, 0.35);
      ctx.restore();
    },
  },
  // Grad student: a laptop and a stack of printed papers with sticky notes.
  papers: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.6);
      ctx.rotate(-0.1);
      rr(ctx, -4.8, -4.4, 9.6, 7, 0.6);
      fillPath(ctx, '#c8ccd6', 0.45);
      dot(ctx, 0, -1, 0.8, '#ffffff', 0);
      for (let i = 0; i < 3; i++) {
        rr(ctx, -4.2 + i * 0.3, 2.6 + i * 0.9, 8.6, 1, 0.1);
        fillPath(ctx, '#fbfbf6', 0.25);
      }
      rr(ctx, 2.4, 1.8, 2, 2, 0.1);
      fillPath(ctx, '#ffd166', 0.15);
      ctx.restore();
    },
  },
  // Florist: a bouquet wrapped in kraft paper.
  bouquet: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const x = hx - 1;
      const y = hy - 2;
      const nod = Math.sin(t * 1.6) * 0.3;
      ctx.strokeStyle = '#5a8a4a';
      ctx.lineWidth = 0.4;
      for (const dx of [-2, -0.6, 0.8, 2.2]) {
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x + dx * 1.6 + nod, y - 7);
        ctx.stroke();
      }
      for (const [dx, dy, c] of [[-3.2, -8, '#ff8fb8'], [-0.6, -10, '#ffffff'], [2, -9.2, '#ffd166'], [3.6, -7, '#e8558f'], [0.6, -7.4, '#c9a8e8'], [-2, -5.6, '#ffffff']]) {
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(x + dx + nod + Math.cos(a) * 0.9, y + dy + Math.sin(a) * 0.9, 0.85, 0.6, a, 0, Math.PI * 2);
          fillPath(ctx, c, 0.15);
        }
        dot(ctx, x + dx + nod, y + dy, 0.4, '#e8a83a', 0);
      }
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 6);
      ctx.lineTo(x + 5, y - 6);
      ctx.lineTo(x + 1.2, y + 4);
      ctx.lineTo(x - 1.2, y + 4);
      ctx.closePath();
      fillPath(ctx, '#d8b88a', 0.45);
      ctx.strokeStyle = 'rgba(140,100,60,0.5)';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(x - 2.6, y - 6);
      ctx.lineTo(x, y + 3);
      ctx.stroke();
      ctx.strokeStyle = '#e8558f';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 1.8, y + 1.2);
      ctx.lineTo(x + 1.8, y + 1.2);
      ctx.stroke();
    },
  },
  // Chess-club kid: a wooden chess-set box with a knight on top.
  chessSet: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      const x = hx - 1.6;
      const y = hy - 3;
      rr(ctx, x - 4.4, y - 2.4, 8.8, 5, 0.5);
      fillPath(ctx, '#a8743a', 0.45);
      ctx.save();
      rr(ctx, x - 3.6, y - 1.8, 7.2, 3.8, 0.2);
      ctx.clip();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#5a3418' : '#f2d8a8';
          ctx.fillRect(x - 3.6 + c * 1.2, y - 1.8 + r * 1.27, 1.2, 1.27);
        }
      }
      ctx.restore();
      // A white knight standing on top.
      ctx.beginPath();
      ctx.moveTo(x - 1.2, y - 2.4);
      ctx.lineTo(x + 1.2, y - 2.4);
      ctx.lineTo(x + 0.8, y - 4.4);
      ctx.quadraticCurveTo(x + 1.6, y - 5.6, x + 0.6, y - 7);
      ctx.quadraticCurveTo(x - 1, y - 7.2, x - 1.4, y - 5.2);
      ctx.lineTo(x - 0.4, y - 5.2);
      ctx.lineTo(x - 0.8, y - 4.4);
      ctx.closePath();
      fillPath(ctx, '#f8f6f0', 0.35);
    },
  },
  // Book-club witch: a spellbook with a glowing rune.
  grimoire: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      book(ctx, hx - 1.4, hy - 3.6, 8.6, 10.6, '#4a2a6a', -0.14);
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.6);
      ctx.rotate(-0.14);
      ctx.strokeStyle = '#e8c25a';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(-3.4, -4.4, 6.8, 8.8);
      const glow = 0.5 + 0.5 * Math.sin(t * 2.4);
      ctx.fillStyle = `rgba(160,240,255,${0.25 + glow * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(200,250,255,${0.6 + glow * 0.4})`;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.moveTo(0, -1.8);
      ctx.lineTo(1.5, 1);
      ctx.lineTo(-1.5, 1);
      ctx.closePath();
      ctx.stroke();
      for (const [cx, cy] of [[-3.4, -4.4], [3.4, -4.4], [-3.4, 4.4], [3.4, 4.4]]) dot(ctx, cx, cy, 0.6, '#e8c25a', 0.1);
      ctx.restore();
    },
  },
};

/** Every prop a patron can carry, by name (library-people.js's `prop`). */
export const PROPS = { ...FIRST_PROPS, ...MORE_PROPS };
