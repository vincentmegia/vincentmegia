// Hospital Shift's anime game-UI kit (docs/features/hospital-shift.md): the
// user asked for "the layouts now to be anime like" — the ER, the minigame
// screens, the HUD and labels, and the page around the canvas. These are
// the shared canvas pieces every screen draws with, so the look stays
// consistent: a pastel palette with deep-plum line art, nameplate chips,
// dialog windows with a ribbon title tab, chunky buttons, speech bubbles,
// sparkles and screentone dots.
//
// Pure canvas drawing (no DOM, no game state). Callers own layout — every
// helper draws inside the rect it's given, so hit areas never move.

export const ANIME = {
  ink: '#3b2a4a', // line art and text
  inkSoft: 'rgba(59,42,74,0.72)',
  paper: '#fffaf6',
  blush: '#fdeef6',
  pink: '#ff8fb8',
  pinkDeep: '#e8558f',
  lavender: '#c9b8ff',
  lavenderDeep: '#8f7ae0',
  sky: '#8fd3ff',
  skyDeep: '#4fa8e0',
  mint: '#8fe3c8',
  mintDeep: '#3fb58f',
  gold: '#ffd166',
  goldDeep: '#e0a020',
  coral: '#ff8a7a',
  coralDeep: '#e0503e',
};

/** The rounded display face the site already loads (falls back to sans-serif). */
export const DISPLAY_FONT = '"Caprasimo", sans-serif';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Lighten (+) or darken (−) a #rrggbb color by `amount` (−1..1). */
export function tint(hex, amount) {
  // Only #rrggbb: parseInt would happily read the hex-looking prefix of a
  // named color ("rebeccapurple" → 0xebecca) and mangle it.
  if (!/^#[0-9a-f]{6}$/i.test(String(hex))) return hex;
  const n = parseInt(String(hex).slice(1, 7), 16);
  const ch = (shift) => {
    const v = (n >> shift) & 255;
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** A four-point anime sparkle. */
export function sparkle(ctx, x, y, r, color = '#ffffff') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Manga screentone: a field of small dots inside a rect. */
export function screentone(ctx, x, y, w, h, color = 'rgba(255,143,184,0.18)', pitch = 7, radius = 1.3) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  for (let row = 0, py = y + pitch / 2; py < y + h; row++, py += pitch) {
    for (let px = x + (row % 2 ? pitch / 2 : 0); px < x + w + pitch; px += pitch) {
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Text with a thick outline — the anime-game title look. */
export function outlinedText(ctx, text, x, y, fill = '#ffffff', stroke = ANIME.ink, width = 4) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * A nameplate chip centered on (x, y), 16 px tall like the old chips so
 * nothing around it moves. Default: white plate, plum outline, a little
 * offset shadow; with `fill`, a colored plate with a glossy top band.
 */
export function animeChip(ctx, x, y, text, font, fill = null, ink = ANIME.ink) {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14;
  const h = 16;
  const left = x - w / 2;
  const top = y - h / 2;
  ctx.fillStyle = 'rgba(59,42,74,0.22)';
  roundRectPath(ctx, left + 1.2, top + 1.6, w, h, 8);
  ctx.fill();
  ctx.fillStyle = fill ?? 'rgba(255,250,246,0.96)';
  roundRectPath(ctx, left, top, w, h, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRectPath(ctx, left + 2, top + 1.5, w - 4, h / 2 - 1.5, 6);
  ctx.fill();
  ctx.strokeStyle = fill ? 'rgba(59,42,74,0.55)' : 'rgba(59,42,74,0.45)';
  ctx.lineWidth = 1.1;
  roundRectPath(ctx, left, top, w, h, 8);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/** The round pink × in a dialog's corner, filling `rect`. */
export function animeCloseButton(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = rect.w / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,74,0.25)';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1.5, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, ANIME.pink);
  g.addColorStop(1, ANIME.pinkDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.moveTo(cx + 5, cy - 5);
  ctx.lineTo(cx - 5, cy + 5);
  ctx.stroke();
  ctx.restore();
}

/**
 * The full-screen dim behind a dialog: a plum vignette with a few slow
 * sparkles. `t` is seconds, for the twinkle.
 */
export function animeBackdrop(ctx, width, height, t = 0) {
  ctx.save();
  const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, width * 0.7);
  g.addColorStop(0, 'rgba(40,24,60,0.42)');
  g.addColorStop(1, 'rgba(30,16,46,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const spots = [[60, 90], [900, 70], [40, 520], [920, 540], [480, 30], [130, 300], [840, 300]];
  spots.forEach(([sx, sy], i) => {
    const a = 0.35 + 0.35 * Math.sin(t * 1.8 + i * 1.3);
    ctx.globalAlpha = Math.max(0, a);
    sparkle(ctx, sx, sy, 6 + (i % 3) * 2, i % 2 ? '#ffe3f0' : '#fff6d6');
  });
  ctx.restore();
}

/**
 * A dialog window filling `rect`: a soft paper-to-blush gradient, a plum
 * outer border with a pink inner line, screentone in two corners,
 * sparkles, and the title on a pink ribbon tab whose baseline sits at
 * rect.y + 38 (where the old title was, so content below doesn't move).
 */
export function animeWindow(ctx, rect, { title = '', subtitle = '', t = 0, accent = ANIME.pink, accentDeep = ANIME.pinkDeep } = {}) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = 'rgba(30,16,46,0.3)';
  roundRectPath(ctx, x + 4, y + 6, w, h, 22);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, ANIME.paper);
  g.addColorStop(1, ANIME.blush);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.fill();
  screentone(ctx, x + w - 150, y + h - 110, 140, 100, 'rgba(255,143,184,0.16)');
  screentone(ctx, x + 10, y + 10, 120, 70, 'rgba(201,184,255,0.22)');
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 3;
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 6, y + 6, w - 12, h - 12, 17);
  ctx.stroke();

  if (title) {
    ctx.font = `21px ${DISPLAY_FONT}`;
    const tw = ctx.measureText(title).width + 56;
    const tx = x + w / 2 - tw / 2;
    const ty = y + 13;
    const tg = ctx.createLinearGradient(0, ty, 0, ty + 34);
    tg.addColorStop(0, accent);
    tg.addColorStop(1, accentDeep);
    // Ribbon tails.
    ctx.fillStyle = accentDeep;
    for (const dir of [-1, 1]) {
      const ex = dir < 0 ? tx : tx + tw;
      ctx.beginPath();
      ctx.moveTo(ex, ty + 6);
      ctx.lineTo(ex + dir * 16, ty + 8);
      ctx.lineTo(ex + dir * 9, ty + 20);
      ctx.lineTo(ex + dir * 16, ty + 32);
      ctx.lineTo(ex, ty + 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = tg;
    roundRectPath(ctx, tx, ty, tw, 34, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRectPath(ctx, tx + 4, ty + 3, tw - 8, 12, 8);
    ctx.fill();
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    roundRectPath(ctx, tx, ty, tw, 34, 12);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    outlinedText(ctx, title, x + w / 2, y + 38, '#ffffff', ANIME.ink, 4);
    sparkle(ctx, tx - 26, ty + 4, 6, ANIME.gold);
    sparkle(ctx, tx + tw + 26, ty + 30, 5, '#ffffff');
  }
  if (subtitle) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = ANIME.inkSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(subtitle, x + w / 2, y + 64);
  }
  const twinkle = 0.6 + 0.4 * Math.sin(t * 2.2);
  ctx.globalAlpha = twinkle;
  sparkle(ctx, x + 26, y + h - 26, 7, ANIME.gold);
  sparkle(ctx, x + w - 34, y + 70, 5, ANIME.pink);
  ctx.restore();
}

/**
 * A chunky anime button filling `rect`: candy gradient, glossy top band,
 * plum outline, a pressed-looking bottom lip, outlined label.
 */
export function animeButton(ctx, rect, label, color = ANIME.pink, colorDeep = ANIME.pinkDeep, font = 'bold 15px sans-serif') {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = tint(colorDeep, -0.25);
  roundRectPath(ctx, x, y + 3, w, h, Math.min(14, h / 2));
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, color);
  g.addColorStop(1, colorDeep);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, Math.min(14, h / 2));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  roundRectPath(ctx, x + 5, y + 3, w - 10, h * 0.38, Math.min(10, h / 3));
  ctx.fill();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, w, h, Math.min(14, h / 2));
  ctx.stroke();
  if (label) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, label, x + w / 2, y + h / 2 + 1, '#ffffff', tint(colorDeep, -0.45), 3.2);
  }
  ctx.restore();
}

/**
 * A speech bubble filling `rect`, with an optional tail pointing at
 * (tailX, tailY). Draws only the bubble — callers write the text.
 */
export function speechBubble(ctx, rect, { tailX = null, tailY = null, fill = '#ffffff' } = {}) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,74,0.18)';
  roundRectPath(ctx, x + 3, y + 4, w, h, 18);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();
  if (tailX != null && tailY != null) {
    const baseX = Math.max(x + 30, Math.min(x + w - 30, tailX));
    const baseY = tailY > y + h ? y + h : y;
    ctx.beginPath();
    ctx.moveTo(baseX - 12, baseY);
    ctx.lineTo(tailX, tailY);
    ctx.lineTo(baseX + 12, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cover the bubble's outline where the tail joins it.
    ctx.fillRect(baseX - 10.5, baseY + (tailY > y + h ? -2 : 0.5), 21, 2);
  }
  ctx.restore();
}

/** A HUD plate: soft white panel with a plum outline and an offset shadow. */
export function animePlate(ctx, x, y, w, h, r = h / 2) {
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,74,0.22)';
  roundRectPath(ctx, x + 1.5, y + 2, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, ANIME.blush);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/**
 * A HUD gauge filling (x, y, w, h): screentoned track, a glossy candy fill
 * to `frac`, plum outline. Callers draw the label on top.
 */
export function animeGauge(ctx, x, y, w, h, frac, color, colorDeep) {
  const f = Math.max(0, Math.min(1, frac));
  const r = h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,74,0.22)';
  roundRectPath(ctx, x + 1.5, y + 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = '#fff4f8';
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  screentone(ctx, x, y, w, h, 'rgba(201,184,255,0.35)', 5, 0.9);
  if (f > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, color);
    g.addColorStop(1, colorDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * f, h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x, y + 2, w * f, h * 0.3);
  }
  ctx.restore();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/** A round icon badge (heart, smile, coin, level) centered on (cx, cy). */
export function animeBadge(ctx, cx, cy, r, color, colorDeep, glyph) {
  ctx.save();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, color);
  g.addColorStop(1, colorDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.45, r * 0.45, r * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ANIME.ink;
  if (glyph === 'heart') {
    const s = r * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.6, cy - s * 1.2, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.2, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else if (glyph === 'smile') {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir * r * 0.32, cy - r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.05, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (glyph) {
    ctx.font = `bold ${Math.round(r * 1.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, glyph, cx, cy + 0.5, '#ffffff', tint(colorDeep, -0.4), 2.4);
  }
  ctx.restore();
}

/** A star with plum line art (for ratings): `fill` 0..1 fills it left to right. */
export function animeStar(ctx, cx, cy, outer, inner, fill, color = ANIME.gold) {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  path();
  ctx.fillStyle = 'rgba(201,184,255,0.45)';
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - outer - 1, cy - outer - 1, (outer * 2 + 2) * Math.min(1, fill), outer * 2 + 2);
    ctx.clip();
    path();
    const g = ctx.createLinearGradient(0, cy - outer, 0, cy + outer);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.5, color);
    g.addColorStop(1, ANIME.goldDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
  path();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (fill >= 1) sparkle(ctx, cx - outer * 0.3, cy - outer * 0.25, outer * 0.32, '#ffffff');
  ctx.restore();
}

/**
 * A station tile filling (x, y, w, h): drop shadow, a top-lit gradient of
 * `color`, a glossy band along the top and plum line art.
 */
export function animeTile(ctx, x, y, w, h, r, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,74,0.2)';
  roundRectPath(ctx, x + 2, y + 4, w, h, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint(color, 0.25));
  g.addColorStop(1, tint(color, -0.08));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRectPath(ctx, x + 4, y + 3, w - 8, Math.min(14, h * 0.18), r * 0.7);
  ctx.fill();
  ctx.restore();
}

/** A painted sakura branch with blossoms, from (x, y) reaching right. */
export function sakuraBranch(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#7a5560';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(22, -6, 46, 2);
  ctx.moveTo(18, -3);
  ctx.quadraticCurveTo(26, -14, 36, -16);
  ctx.moveTo(30, 0);
  ctx.quadraticCurveTo(36, 8, 46, 12);
  ctx.stroke();
  const blossom = (bx, by, r, c) => {
    ctx.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.6, r * 0.5, r * 0.38, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8558f';
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const [bx, by, r, c] of [[12, -4, 5, '#ffd1e3'], [36, -16, 5.5, '#ffc2da'], [46, 2, 6, '#ffd1e3'], [46, 12, 4.5, '#ffb3cf'], [26, -9, 4, '#ffe3ee']]) blossom(bx, by, r, c);
  ctx.restore();
}
