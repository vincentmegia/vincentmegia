// Proportions of the 3D patron, measured from the 2D top-down art (a chibi
// 3.36 heads tall). Game px divide by UNIT_SCALE (40) to give scene units.
// Pure and DOM-free.

export const PX = 1 / 40;

// patron.js draws a patron around a hip-height origin and the figure stands
// GROUND px BELOW it, so art px are not heights:
//   - staff-kit.js `legPoses({hipY: -19.6, thigh: 10.8, shin: 10.4})` with
//     amount 0 puts the ankle at -19.6 + 10.8 + 10.4 = +1.6;
//   - patron.js `drawShoe` lays the sole at ankle-local 4.1 .. 5.5, so the
//     shoe's bottom is +7.1;
//   - staff-kit.js `groundShadow` centres its contact ellipse at y = +7,
//     confirming that +7.1, not 0, is the floor.
// Every dimension in this folder was read off that art, so `artY` is the one
// place art px (y up from the drawing origin) become scene units measured up
// from the floor the character stands on. The frame was first measured as if
// the origin WERE the floor, which lost these 7.1 px from every landmark and
// from the legs alone — the figure came out 3.03 heads tall, not 3.36.
export const GROUND = 7.1;
export const artY = (px) => (px + GROUND) * PX;

// The landmarks in the art's own coordinates, each checkable against the 2D
// source directly.
export const ART = {
  shoeTop: -2.1, // drawShoe's upper outline: ankle-local +0.5 over an ankle at +1.6
  hem: 19.4, // patron.js bodyPath's lower edge, -19.4
  shoulder: 43.4, // bodyPath's shoulder corners, -43.4
  chin: 44.4, // staff-kit facePath's chin: patron-head HEAD_Y (-55) + chin (10.6)
  eye: 53.8, // patron-head.js EYE_Y
  crown: 66.25, // facePath's top cubic peaks at HEAD_Y - 11.25
};

export const FRAME = {
  foot: 0,
  shoeTop: artY(ART.shoeTop), // 5.0 px
  hem: artY(ART.hem), // 26.5 px: legs are 36.1% of the height
  shoulder: artY(ART.shoulder), // 50.5 px
  chin: artY(ART.chin), // 51.5 px
  eye: artY(ART.eye), // 60.9 px
  crown: artY(ART.crown), // 73.35 px = 3.36 heads of 21.85 px
};

// geom.js's `prism` puts flat faces on the axes, so an 8-sided ring of radius r
// is only r*cos(pi/8) = 0.9239r wide and deep. Ring radii are therefore scaled
// up by CIRC so the silhouette a player sees equals the width we designed.
// character-body.js imports it for the torso rings, so both widen alike.
export const CIRC = 1 / Math.cos(Math.PI / 8);

export const AGE_SCALE = { kid: 0.74, teen: 0.95, elder: 0.95, adult: 1 };
export const KID_HEAD = 1.26;

export function metricsFor(design) {
  const age = design?.age;
  const kid = age === 'kid';
  const elder = age === 'elder';
  const slim = Boolean(design?.outfit?.skirt) || kid;
  // Half-width of the head as the 2D art measures it (17.85 px across for an
  // adult, so 9 px either side of the centre line).
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
    // RADII of the 8-sided head prism, not half-widths: every part of the head
    // is such a prism, or is placed relative to one, so the compensation lives
    // here, once, and the whole head (skull, ears, face details via
    // `faceOps`, hair, headwear) widens together. What renders is
    // headRX * cos(pi/8) === halfHeadX, the designed half-width above.
    headRX: halfHeadX * CIRC,
    headRZ: halfHeadX * 0.94 * CIRC,
    depth: (slim ? 5.6 : 6.6) / 40,
  };
}
