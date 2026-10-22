// More props for Library Shift's patrons ("add more characters until it
// matches hospital shift"): the second batch, merged into patron-props.js's
// PROPS. Same contract — `pose` (raise / hug / hang / none), an optional
// `back` + `drawBack`, and `draw(ctx, hand, t, design)`.
//
// Coordinates are the anime frame's (feet at 0, face centre about -55).

import { shadeColor } from '../shared/people.js';
import { fillPath, rr, dot, outline } from './staff-kit.js';

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

function phoneAt(ctx, x, y, rot, screen, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  rr(ctx, -2, -3.6, 4, 7.2, 0.8);
  fillPath(ctx, '#2a2a34', 0.4);
  rr(ctx, -1.6, -3.1, 3.2, 6.2, 0.4);
  ctx.fillStyle = screen;
  ctx.fill();
  // A scrolling feed.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const off = (t * 2) % 1.6;
  for (let i = 0; i < 4; i++) ctx.fillRect(-1.2, -2.6 + i * 1.6 - off + 0.8, 2.4, 0.6);
  ctx.restore();
}

export const MORE_PROPS = {
  // Office worker: a padded laptop bag on its strap.
  laptopBag: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      rr(ctx, hx - 5.4, hy + 1.6, 10.8, 7.6, 1);
      fillPath(ctx, '#3a3a48', 0.45);
      rr(ctx, hx - 5.4, hy + 1.6, 10.8, 3.2, 1);
      fillPath(ctx, '#2a2a34', 0.35);
      rr(ctx, hx - 1.4, hy + 3.6, 2.8, 1.2, 0.3);
      fillPath(ctx, '#d6dae4', 0.2);
      ctx.strokeStyle = '#1e1e24';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 1.8);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx + 3, hy + 1.8);
      ctx.stroke();
    },
  },
  // Delivery rider: a taped parcel with a shipping label.
  parcel: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      rr(ctx, hx - 5.6, hy - 6.4, 9.6, 7.6, 0.4);
      fillPath(ctx, '#c89a62', 0.45);
      ctx.fillStyle = 'rgba(240,220,170,0.8)';
      ctx.fillRect(hx - 5.6, hy - 3.2, 9.6, 1.2);
      rr(ctx, hx - 4.8, hy - 5.6, 3.6, 2, 0.2);
      fillPath(ctx, '#ffffff', 0.2);
      ctx.fillStyle = '#2a2a34';
      for (let i = 0; i < 5; i++) ctx.fillRect(hx - 4.5 + i * 0.6, hy - 5.2, 0.3, 1.2);
      ctx.strokeStyle = '#d23a4a';
      ctx.lineWidth = 0.3;
      ctx.strokeRect(hx + 0.4, hy - 1.4, 2.6, 2);
    },
  },
  // Phone people: a phone held up, a feed scrolling.
  phone: {
    pose: 'raise',
    draw(ctx, [hx, hy], t, design) {
      phoneAt(ctx, hx, hy - 2, -0.1, design.phoneScreen ?? '#9ad0ff', t);
    },
  },
  // Hiking uncle: a steel thermos of barley tea.
  thermos: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      rr(ctx, hx - 1.6, hy + 0.6, 3.2, 9, 1);
      const g = ctx.createLinearGradient(hx - 1.6, 0, hx + 1.6, 0);
      g.addColorStop(0, '#9ea4b2');
      g.addColorStop(0.4, '#eef0f6');
      g.addColorStop(1, '#7a8090');
      fillPath(ctx, g, 0.4);
      rr(ctx, hx - 1.8, hy - 0.6, 3.6, 1.8, 0.5);
      fillPath(ctx, '#d23a4a', 0.35);
      // A grip band, a printed mountain, and a cup-lid ring.
      rr(ctx, hx - 1.7, hy + 4, 3.4, 1.6, 0.3);
      fillPath(ctx, '#2a2a34', 0.2);
      ctx.fillStyle = '#4a8a5a';
      ctx.beginPath();
      ctx.moveTo(hx - 1.2, hy + 8.4);
      ctx.lineTo(hx - 0.2, hy + 6.8);
      ctx.lineTo(hx + 0.4, hy + 7.6);
      ctx.lineTo(hx + 1.2, hy + 8.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(hx - 1.7, hy + 1.6);
      ctx.lineTo(hx + 1.7, hy + 1.6);
      ctx.stroke();
    },
  },
  // Toddler mum / cosplayer: a plush bunny hugged close.
  plushToy: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const x = hx - 1.4;
      const y = hy - 3;
      const flop = Math.sin(t * 2) * 0.1;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(x + dir * 1.4, y - 4);
        ctx.rotate(dir * 0.2 + flop);
        ctx.beginPath();
        ctx.ellipse(0, -2.4, 1, 2.8, 0, 0, Math.PI * 2);
        fillPath(ctx, '#fbe6ee', 0.35);
        ctx.beginPath();
        ctx.ellipse(0, -2.4, 0.45, 2, 0, 0, Math.PI * 2);
        fillPath(ctx, '#ffb0c4', 0);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(x, y - 2.4, 3.2, 2.8, 0, 0, Math.PI * 2);
      fillPath(ctx, '#fbe6ee', 0.4);
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 3.4, 3, 0, 0, Math.PI * 2);
      fillPath(ctx, '#fbe6ee', 0.4);
      dot(ctx, x - 1.1, y - 2.6, 0.35, '#2a1e1a', 0);
      dot(ctx, x + 1.1, y - 2.6, 0.35, '#2a1e1a', 0);
      dot(ctx, x, y - 1.8, 0.3, '#ff8fb8', 0);
      rr(ctx, x - 1.6, y - 0.6, 3.2, 0.8, 0.3);
      fillPath(ctx, '#8f7ae0', 0.2);
    },
  },
  // Comic fans: a manhwa volume with a bold cover.
  comicBook: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      book(ctx, hx - 1.4, hy - 3.6, 7.8, 10.4, '#f2c94c', -0.12);
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.6);
      ctx.rotate(-0.12);
      ctx.fillStyle = '#e8558f';
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(0, -3.6);
      ctx.lineTo(3, 2);
      ctx.closePath();
      ctx.fill();
      dot(ctx, 0, -0.4, 1.4, '#ffffff', 0.2);
      ctx.fillStyle = '#1e1a22';
      ctx.fillRect(-3, -4.4, 6, 1);
      ctx.restore();
    },
  },
  // Basketball kid: a ball tucked against the hip.
  basketball: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      const x = hx - 0.6;
      const y = hy - 2;
      dot(ctx, x, y, 4.4, '#e8743a', 0.5);
      ctx.strokeStyle = '#3a1e10';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(x - 4.4, y);
      ctx.lineTo(x + 4.4, y);
      ctx.moveTo(x, y - 4.4);
      ctx.lineTo(x, y + 4.4);
      ctx.stroke();
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + dir * 5.6, y, 4, Math.PI * (dir < 0 ? -0.3 : 0.7), Math.PI * (dir < 0 ? 0.3 : 1.3));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(x - 1.6, y - 2, 1.2, 0.7, -0.6, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // Photographer: a film camera on a strap, held at the chest.
  camera: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-3.6, -43);
      ctx.quadraticCurveTo(-4, -34, hx - 5, hy - 4);
      ctx.moveTo(3.6, -43);
      ctx.lineTo(hx + 3.6, hy - 4);
      ctx.stroke();
      rr(ctx, hx - 5.2, hy - 6.6, 9, 5.6, 0.8);
      fillPath(ctx, '#2a2a30', 0.45);
      rr(ctx, hx - 5.2, hy - 6.6, 9, 1.8, 0.8);
      fillPath(ctx, '#d6dae4', 0.3);
      dot(ctx, hx - 0.8, hy - 3.4, 2.2, '#1e1e24', 0.35);
      dot(ctx, hx - 0.8, hy - 3.4, 1.3, '#4a6a9a', 0);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(hx - 1.6, hy - 4.2, 0.6, 0.6);
      dot(ctx, hx + 2.6, hy - 6.8, 0.6, '#d23a4a', 0.15);
    },
  },
  // Novelist: a manuscript notebook with a fountain pen clipped on.
  notebook: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      book(ctx, hx - 1.4, hy - 3.4, 8, 10, '#2e4a3a', -0.08);
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.4);
      ctx.rotate(-0.08);
      ctx.strokeStyle = '#d23a4a';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(2, -5);
      ctx.lineTo(2, 5);
      ctx.stroke();
      rr(ctx, 3.2, -6.4, 0.9, 7, 0.4);
      fillPath(ctx, '#1e1a22', 0.2);
      ctx.fillStyle = '#e8c25a';
      ctx.fillRect(3.2, -4.6, 0.9, 0.5);
      ctx.restore();
    },
  },
  // Chef: a cake box tied with ribbon.
  cakeBox: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      rr(ctx, hx - 5.2, hy - 6.4, 9, 7, 0.4);
      fillPath(ctx, '#fff6ee', 0.45);
      ctx.fillStyle = '#ff8fb8';
      ctx.fillRect(hx - 5.2, hy - 3.4, 9, 1);
      ctx.fillRect(hx - 1.2, hy - 6.4, 1, 7);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(hx - 0.7 + dir * 1.4, hy - 7.2, 1.4, 0.8, dir * 0.4, 0, Math.PI * 2);
        fillPath(ctx, '#ff8fb8', 0.25);
      }
      dot(ctx, hx + 2.2, hy - 1.2, 0.6, '#c4507a', 0);
    },
  },
  // Skater: a skateboard held by its truck at the side.
  skateboard: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx + 1, hy + 9);
      rr(ctx, -1.8, -9.6, 3.6, 19.2, 1.8);
      fillPath(ctx, '#2a2a34', 0.45);
      rr(ctx, -1.4, -9, 2.8, 18, 1.4);
      fillPath(ctx, '#e8558f', 0);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-1, 2);
      ctx.lineTo(0, -2);
      ctx.lineTo(1, 2);
      ctx.closePath();
      ctx.fill();
      for (const wy of [-6.4, 6.4]) {
        dot(ctx, 2.4, wy - 1, 0.9, '#f4f2ea', 0.25);
        dot(ctx, 2.4, wy + 1, 0.9, '#f4f2ea', 0.25);
      }
      ctx.restore();
    },
  },
  // Gamer: a handheld console, its screen glowing.
  gameConsole: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      rr(ctx, hx - 6, hy - 5.4, 10, 4.6, 1.8);
      fillPath(ctx, '#e8e8f0', 0.45);
      rr(ctx, hx - 3.2, hy - 4.8, 4.4, 3.4, 0.4);
      ctx.fillStyle = `hsl(${(t * 60) % 360},70%,65%)`;
      ctx.fill();
      dot(ctx, hx - 4.6, hy - 3.1, 0.7, '#4fa8e0', 0.15);
      dot(ctx, hx + 2.4, hy - 3.6, 0.45, '#e8558f', 0.1);
      dot(ctx, hx + 3.2, hy - 2.8, 0.45, '#ffd166', 0.1);
    },
  },
  // Dog walker: a little white dog on a leash, trotting at their feet.
  dog: {
    pose: 'hang',
    draw(ctx, [hx, hy], t) {
      const dx = 10;
      const bob = Math.abs(Math.sin(t * 6)) * 0.6;
      const wag = Math.sin(t * 12) * 0.5;
      ctx.strokeStyle = '#d23a4a';
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 1);
      ctx.quadraticCurveTo(hx + 4, -4, dx, -3.4 - bob);
      ctx.stroke();
      // Body, legs, tail, head with floppy ears.
      ctx.beginPath();
      ctx.ellipse(dx + 3, -0.6 - bob, 4.4, 2.6, 0, 0, Math.PI * 2);
      fillPath(ctx, '#fbfaf6', 0.45);
      for (const lx of [0.6, 2, 4.4, 5.8]) {
        rr(ctx, dx + lx - 0.5, 1.2 - bob, 1, 3.4 + bob, 0.4);
        fillPath(ctx, '#f0eee6', 0.3);
      }
      ctx.save();
      ctx.translate(dx + 7.2, -1.6 - bob);
      ctx.rotate(-0.6 + wag);
      ctx.beginPath();
      ctx.ellipse(0, -1.4, 0.7, 1.8, 0, 0, Math.PI * 2);
      fillPath(ctx, '#fbfaf6', 0.3);
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(dx, -3.6 - bob, 2.6, 2.4, 0, 0, Math.PI * 2);
      fillPath(ctx, '#fbfaf6', 0.45);
      ctx.beginPath();
      ctx.ellipse(dx - 2.2, -3.2 - bob, 0.9, 1.8, 0.3, 0, Math.PI * 2);
      fillPath(ctx, '#e8d8c4', 0.3);
      dot(ctx, dx - 0.8, -4 - bob, 0.32, '#1e1418', 0);
      dot(ctx, dx - 2.4, -2.6 - bob, 0.45, '#1e1418', 0);
      rr(ctx, dx - 1.4, -1.8 - bob, 2.6, 0.7, 0.3);
      fillPath(ctx, '#d23a4a', 0.15);
    },
  },
  // Violinist: a violin case on the back.
  violinCase: {
    pose: 'hang',
    back: true,
    drawBack(ctx) {
      ctx.save();
      ctx.translate(-1, -30);
      ctx.rotate(-0.38);
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.bezierCurveTo(5, -16, 5.6, -6, 3.4, -2);
      ctx.bezierCurveTo(6.4, 2, 6, 12, 0, 13);
      ctx.bezierCurveTo(-6, 12, -6.4, 2, -3.4, -2);
      ctx.bezierCurveTo(-5.6, -6, -5, -16, 0, -16);
      ctx.closePath();
      fillPath(ctx, '#3a2a4a', 0.55);
      ctx.strokeStyle = '#e8c25a';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
    },
    draw(ctx, [hx, hy]) {
      // A rosin tin.
      dot(ctx, hx, hy + 2.6, 1.4, '#c89a3a', 0.35);
    },
  },
  // Baker: a paper bag with a baguette poking out.
  baguetteBag: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx + 0.4, hy - 9);
      ctx.rotate(0.3);
      rr(ctx, -1.3, -3, 2.6, 9, 1.3);
      fillPath(ctx, '#d8a058', 0.4);
      ctx.strokeStyle = '#a8742a';
      ctx.lineWidth = 0.3;
      for (const yy of [-1.6, 0.4, 2.4]) {
        ctx.beginPath();
        ctx.moveTo(-0.9, yy);
        ctx.lineTo(0.9, yy - 0.8);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 6.4);
      ctx.lineTo(hx + 3, hy - 6.4);
      ctx.lineTo(hx + 3.6, hy + 1);
      ctx.lineTo(hx - 5.6, hy + 1);
      ctx.closePath();
      fillPath(ctx, '#d8b88a', 0.45);
      ctx.strokeStyle = 'rgba(140,100,60,0.5)';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 5.4);
      ctx.lineTo(hx + 3, hy - 5.4);
      ctx.stroke();
      dot(ctx, hx - 1, hy - 2.4, 1, '#7ab86a', 0.2);
    },
  },
  // Grandpas: a folded newspaper.
  newspaper: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.2, hy - 3.6);
      ctx.rotate(-0.2);
      rr(ctx, -4.4, -3.4, 8.8, 6.8, 0.2);
      fillPath(ctx, '#f2efe4', 0.4);
      ctx.fillStyle = '#2a2a34';
      ctx.fillRect(-3.8, -2.8, 7.6, 1);
      ctx.fillStyle = '#9a9aa8';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-3.8, -1.2 + i * 1, 3.4, 0.35);
        ctx.fillRect(0.4, -1.2 + i * 1, 3.4, 0.35);
      }
      rr(ctx, 0.4, -1.4, 3.4, 2.2, 0.1);
      fillPath(ctx, '#c8ccd6', 0);
      ctx.restore();
    },
  },
  // Fashion student: a sketchbook with a figure drawing.
  sketchbook: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.8);
      ctx.rotate(-0.15);
      rr(ctx, -4.4, -5.6, 8.8, 11.2, 0.4);
      fillPath(ctx, '#fbfbf6', 0.45);
      ctx.strokeStyle = '#2a2a34';
      ctx.lineWidth = 0.3;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(-4.4 + i * 1.2, -5.6, 0.4, Math.PI, 0);
        ctx.stroke();
      }
      // A quick fashion sketch: a head, a flared dress.
      dot(ctx, 0, -3, 0.9, '#f6d6bd', 0.2);
      ctx.beginPath();
      ctx.moveTo(-0.6, -2);
      ctx.lineTo(0.6, -2);
      ctx.lineTo(2.4, 3.6);
      ctx.lineTo(-2.4, 3.6);
      ctx.closePath();
      fillPath(ctx, '#e8558f', 0.25);
      ctx.restore();
    },
  },
  // Ice-cream kid: a cone, the scoop melting a little.
  iceCream: {
    pose: 'raise',
    draw(ctx, [hx, hy], t) {
      ctx.beginPath();
      ctx.moveTo(hx - 1.8, hy - 1);
      ctx.lineTo(hx + 1.8, hy - 1);
      ctx.lineTo(hx, hy + 4.4);
      ctx.closePath();
      fillPath(ctx, '#d8a058', 0.4);
      ctx.strokeStyle = '#a8742a';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(hx - 1.2, hy);
      ctx.lineTo(hx + 0.6, hy + 2.4);
      ctx.moveTo(hx + 1.2, hy);
      ctx.lineTo(hx - 0.6, hy + 2.4);
      ctx.stroke();
      dot(ctx, hx, hy - 2.6, 2.2, '#ffb0cc', 0.4);
      dot(ctx, hx - 0.4, hy - 4.6, 1.6, '#9fe3cc', 0.35);
      const drip = (t * 0.4) % 1;
      rr(ctx, hx + 1.2, hy - 1.8, 0.7, 1 + drip, 0.35);
      fillPath(ctx, '#ffb0cc', 0);
      dot(ctx, hx - 0.6, hy - 5.8, 0.4, '#d23a4a', 0.15);
    },
  },
  // Rainy-day commuter: a closed umbrella, hooked over the wrist.
  umbrella: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      ctx.strokeStyle = '#4a2a18';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(hx - 1, hy + 1.4, 1.4, 0, Math.PI);
      ctx.stroke();
      rr(ctx, hx - 0.3, hy + 1.4, 0.6, 3, 0.2);
      fillPath(ctx, '#2a2a34', 0.2);
      ctx.beginPath();
      ctx.moveTo(hx - 1.4, hy + 4.4);
      ctx.lineTo(hx + 1.4, hy + 4.4);
      ctx.lineTo(hx + 0.4, hy + 18);
      ctx.lineTo(hx - 0.4, hy + 18);
      ctx.closePath();
      fillPath(ctx, '#2e4a7a', 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(hx - 0.4, hy + 5);
      ctx.lineTo(hx, hy + 17);
      ctx.stroke();
      rr(ctx, hx - 1, hy + 9, 2, 0.8, 0.3);
      fillPath(ctx, '#2e4a7a', 0.2);
      // Raindrops still dripping off the tip.
      dot(ctx, hx, hy + 19.6, 0.35, 'rgba(120,180,255,0.8)', 0);
    },
  },
  // Market grandma: a mesh bag of vegetables.
  shoppingBag: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      ctx.strokeStyle = '#7ab86a';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy + 4);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx + 3, hy + 4);
      ctx.stroke();
      // Leeks and a radish poking out.
      for (const [x, c, h] of [[-2, '#5a9a4a', 7], [-0.6, '#7ac74f', 8]]) {
        rr(ctx, hx + x - 0.4, hy + 4 - h + 4, 0.9, h, 0.4);
        fillPath(ctx, c, 0.2);
      }
      dot(ctx, hx + 2, hy + 4, 1.5, '#f4f2ea', 0.3);
      ctx.beginPath();
      ctx.ellipse(hx, hy + 9, 4.6, 5, 0, 0, Math.PI * 2);
      fillPath(ctx, 'rgba(122,184,106,0.5)', 0.45);
      ctx.strokeStyle = '#5a9a4a';
      ctx.lineWidth = 0.2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(hx + i * 1.3, hy + 4.4);
        ctx.lineTo(hx + i * 1.1 + 1, hy + 13.6);
        ctx.moveTo(hx + i * 1.3, hy + 4.4);
        ctx.lineTo(hx + i * 1.1 - 1, hy + 13.6);
        ctx.stroke();
      }
      dot(ctx, hx - 1.4, hy + 9, 1.4, '#e8743a', 0.25);
      dot(ctx, hx + 1.6, hy + 10.4, 1.3, '#d23a4a', 0.25);
    },
  },
  // Balloon kid: a heart balloon on a string, bobbing.
  balloon: {
    pose: 'raise',
    draw(ctx, [hx, hy], t, design) {
      const sway = Math.sin(t * 1.4) * 1.4;
      const bx = hx + 2 + sway;
      const by = hy - 24;
      ctx.strokeStyle = '#d6dae4';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + sway, hy - 10, bx, by + 4);
      ctx.stroke();
      const c = design.balloon ?? '#e8558f';
      ctx.beginPath();
      ctx.moveTo(bx, by + 4);
      ctx.bezierCurveTo(bx - 6.4, by - 0.6, bx - 3.6, by - 6.6, bx, by - 3);
      ctx.bezierCurveTo(bx + 3.6, by - 6.6, bx + 6.4, by - 0.6, bx, by + 4);
      ctx.closePath();
      fillPath(ctx, c, 0.45);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(bx - 2, by - 2.4, 0.8, 1.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // Painter: a palette with blobs of paint and a brush.
  palette: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.beginPath();
      ctx.ellipse(hx - 1, hy - 3, 5, 3.6, -0.2, 0, Math.PI * 2);
      fillPath(ctx, '#d8a868', 0.45);
      dot(ctx, hx + 1.6, hy - 2, 0.8, '#f4ecdc', 0.2);
      for (const [dx, dy, c] of [[-4, -3.4, '#e8558f'], [-2.4, -5, '#ffd166'], [0, -5.4, '#4fa8e0'], [2.4, -4.6, '#7ac74f'], [-3.4, -1.4, '#ffffff']]) {
        dot(ctx, hx - 1 + dx + 1, hy - 3 + dy + 3, 0.8, c, 0.15);
      }
      ctx.save();
      ctx.translate(hx + 2, hy - 7);
      ctx.rotate(0.6);
      rr(ctx, -0.4, -4, 0.8, 7, 0.3);
      fillPath(ctx, '#8a5a32', 0.25);
      rr(ctx, -0.6, -5.6, 1.2, 1.8, 0.5);
      fillPath(ctx, '#4fa8e0', 0.2);
      ctx.restore();
    },
  },
  // Gardener: a potted seedling.
  pottedPlant: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const sway = Math.sin(t * 1.3) * 0.1;
      ctx.save();
      ctx.translate(hx - 1, hy - 5);
      ctx.rotate(sway);
      ctx.strokeStyle = '#4a8a3a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -5);
      ctx.stroke();
      for (const [dir, y] of [[-1, -2], [1, -3.4], [-1, -4.6]]) {
        ctx.beginPath();
        ctx.ellipse(dir * 1.6, y, 1.7, 0.8, dir * -0.4, 0, Math.PI * 2);
        fillPath(ctx, '#7ac74f', 0.25);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(hx - 4.4, hy - 5);
      ctx.lineTo(hx + 2.4, hy - 5);
      ctx.lineTo(hx + 1.6, hy + 0.6);
      ctx.lineTo(hx - 3.6, hy + 0.6);
      ctx.closePath();
      fillPath(ctx, '#c8643a', 0.45);
      rr(ctx, hx - 4.8, hy - 5.6, 7.6, 1.4, 0.4);
      fillPath(ctx, '#d8784a', 0.35);
    },
  },
  // Calligrapher: a rolled scroll with tassels.
  scroll: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.4);
      ctx.rotate(-0.5);
      rr(ctx, -6, -1.6, 12, 3.2, 1.6);
      fillPath(ctx, '#f6eccc', 0.4);
      for (const ex of [-6.6, 6.6]) {
        rr(ctx, ex - 0.7, -2.2, 1.4, 4.4, 0.6);
        fillPath(ctx, '#6a3a22', 0.3);
      }
      rr(ctx, -0.6, -1.7, 1.2, 3.4, 0.2);
      fillPath(ctx, '#d23a4a', 0.15);
      ctx.restore();
    },
  },
  // Science kid: a little wind-up robot.
  robotToy: {
    pose: 'hug',
    draw(ctx, [hx, hy], t) {
      const x = hx - 1;
      const y = hy - 3;
      rr(ctx, x - 2.6, y - 1.6, 5.2, 5, 0.6);
      fillPath(ctx, '#c8ccd6', 0.4);
      rr(ctx, x - 2, y - 6, 4, 3.8, 0.6);
      fillPath(ctx, '#d6dae4', 0.4);
      const blink = Math.sin(t * 3) > 0.7 ? 0.1 : 0.55;
      dot(ctx, x - 0.9, y - 4.2, blink, '#4fa8e0', 0);
      dot(ctx, x + 0.9, y - 4.2, blink, '#4fa8e0', 0);
      ctx.strokeStyle = '#9ea4b2';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y - 7.6);
      ctx.stroke();
      dot(ctx, x, y - 7.8, 0.5, '#e8558f', 0.12);
      rr(ctx, x - 1.4, y, 2.8, 1.4, 0.3);
      fillPath(ctx, '#ffd166', 0.15);
    },
  },
  // Wedding planner: a glossy magazine.
  magazine: {
    pose: 'hug',
    draw(ctx, [hx, hy]) {
      ctx.save();
      ctx.translate(hx - 1.4, hy - 3.8);
      ctx.rotate(-0.1);
      rr(ctx, -4, -5.4, 8, 10.8, 0.3);
      const g = ctx.createLinearGradient(0, -5.4, 0, 5.4);
      g.addColorStop(0, '#fbe6ee');
      g.addColorStop(1, '#e8c4d4');
      fillPath(ctx, g, 0.4);
      ctx.fillStyle = '#c4507a';
      ctx.fillRect(-3.4, -4.8, 6.8, 1.4);
      dot(ctx, 0, 0.6, 2.2, '#ffffff', 0.2);
      outline(ctx, 0.2);
      ctx.fillStyle = '#9a9aa8';
      ctx.fillRect(-3.4, 3.6, 3, 0.4);
      ctx.restore();
    },
  },
  // Elder: a carved walking stick, leaned on.
  walkingStick: {
    pose: 'hang',
    draw(ctx, [hx, hy]) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(30,18,12,0.7)';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 2.4, 6);
      ctx.stroke();
      ctx.strokeStyle = '#8a5a32';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.lineCap = 'butt';
      // A carved knob, a brass collar and carved rings down the shaft.
      dot(ctx, hx, hy - 0.4, 1.3, '#6a4228', 0.35);
      ctx.strokeStyle = 'rgba(255,220,180,0.4)';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.arc(hx, hy - 0.4, 0.7, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
      rr(ctx, hx - 0.8, hy + 0.8, 1.6, 0.7, 0.2);
      fillPath(ctx, '#c9a24a', 0.15);
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 0.25;
      for (const f of [0.3, 0.55, 0.8]) {
        const sx = hx + 2.4 * f;
        const sy = hy + (6 - hy) * f;
        ctx.beginPath();
        ctx.moveTo(sx - 0.6, sy);
        ctx.lineTo(sx + 0.6, sy - 0.1);
        ctx.stroke();
      }
      dot(ctx, hx + 2.4, 6, 0.6, '#1e1a1a', 0.15);
    },
  },
};
