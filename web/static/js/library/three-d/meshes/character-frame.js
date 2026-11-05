// Proportions of the 3D patron, measured from the 2D top-down art (a chibi
// 3.0 heads tall). Game px divide by UNIT_SCALE (40) to give scene units.
// Pure and DOM-free.

export const PX = 1 / 40;

export const FRAME = {
  foot: 0,
  shoeTop: 4.5 / 40,
  hem: 19.4 / 40,
  shoulder: 43.4 / 40,
  chin: 44.4 / 40,
  eye: 53.8 / 40,
  crown: 66.3 / 40,
};

export const AGE_SCALE = { kid: 0.74, teen: 0.95, elder: 0.95, adult: 1 };
export const KID_HEAD = 1.26;

export function metricsFor(design) {
  const age = design?.age;
  const kid = age === 'kid';
  const elder = age === 'elder';
  const slim = Boolean(design?.outfit?.skirt) || kid;
  const halfHeadX = (kid ? 9.4 : elder ? 9.2 : 9) / 40;
  return {
    kid,
    elder,
    slim,
    // Long legs: trousers, unless a tee with no `legs` (shorts) — as patron.js's legFill.
    trousers: !design?.outfit?.skirt && !(design?.outfit?.kind === 'tee' && !design?.outfit?.legs),
    ageScale: AGE_SCALE[age] ?? 1,
    headScale: kid ? KID_HEAD : 1,
    halfTorso: (slim ? 7.8 : 9.8) / 40,
    halfShoulder: (slim ? 9.2 : 10.6) / 40,
    halfHeadX,
    halfHeadZ: halfHeadX * 0.94,
    depth: (slim ? 5.6 : 6.6) / 40,
  };
}
