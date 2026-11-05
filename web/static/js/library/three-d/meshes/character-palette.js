// Resolves a patron design to every colour the 3D character needs (the old
// fpPaletteFor kept only four). Optional slots are null, never undefined.
// Pure and DOM-free.

import { shadeColor, hairTones, skinTones } from '../../../shared/people.js';

// outfit.legs is a colour under a skirt, but the keyword 'long' on a tee (it
// means trousers, see metricsFor.trousers); only colours reach the palette.
const colourOrNull = (v) => (typeof v === 'string' && v.startsWith('#') ? v : null);

export function paletteFor(design) {
  const d = design ?? {};
  const o = d.outfit ?? {};
  const skin = d.skin ?? '#efc49f';
  const hairColour = d.hair?.color ?? '#2a2030';
  return {
    skin: skinTones(skin),
    hair: hairTones(hairColour),
    top: o.top ?? '#6a7a8a',
    inner: o.inner ?? o.shirt ?? null,
    apron: o.apron ?? null,
    tie: o.tie ?? null,
    trim: o.trim ?? o.print ?? o.stripe ?? null,
    bottom: o.bottom ?? o.skirt ?? o.inner ?? '#3a3a48',
    skirt: o.skirt ?? null,
    legs: colourOrNull(o.legs),
    shoes: o.shoes ?? '#2a2226',
    eyes: d.eyes?.color ?? '#2e2a3a',
    brow: shadeColor(hairColour, -0.1),
    lips: d.eyes?.lashes ? '#d8707e' : shadeColor(skin, -0.38),
  };
}
