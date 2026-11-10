// The Return Cart: a wooden cart with shelves, posts and wheels.
// Geometry technique — flat-coloured 3D from anime-furniture.js's drawReturnCart.
// The top tray holds the cart's real books (book.js, placed by the scene at
// RETURN_CART_BOOK_SLOTS); the lower tray keeps the 2D's decorative books.

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const WOOD = '#d9a877';
const FRAME = '#8a6a4a';
const WHEEL = '#5a5a78';
const WHEEL_HUB = '#d6ecff';
const BOOK_COLOURS = ['#ff8a7a', '#8fd3ff', '#ffd166', '#8fe3c8', '#c9b8ff', '#ff8fb8'];

const TOP_TRAY = 0.82; // the top tray's surface
const LOWER_TRAY = 0.32;
/** How many of the cart's books stand on its top tray: returnCartSlots' five. */
export const RETURN_CART_VISIBLE_BOOKS = 5;
const BOOK_PITCH = 0.29; // 0.25 m books with the 2D's 4 : 30 gap, inside the posts
/**
 * Model-space base point of the cart's book in each Top-Down slot, left to
 * right as returnCartSlots lays them out (slot 0 is the viewer's left seen
 * from the cart's +Z front).
 */
export const RETURN_CART_BOOK_SLOTS = Array.from({ length: RETURN_CART_VISIBLE_BOOKS }, (_, i) => (
  [(i - (RETURN_CART_VISIBLE_BOOKS - 1) / 2) * BOOK_PITCH, TOP_TRAY, 0.05]
));

export function buildReturnCart() {
  const mesh = emptyMesh();
  merge(mesh, boxWithout([-0.8, 0.2, -0.5], [0.8, LOWER_TRAY, 0.5], WOOD, ['bottom']));
  merge(mesh, boxWithout([-0.8, 0.7, -0.5], [0.8, TOP_TRAY, 0.5], WOOD, ['bottom']));
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.45, 0.45]) {
      merge(mesh, box([x - 0.04, 0.2, z - 0.04], [x + 0.04, 1.1, z + 0.04], FRAME));
    }
  }
  merge(mesh, box([0.75, 1.05, -0.45], [0.95, 1.12, 0.45], FRAME));
  for (let i = 0; i < 5; i++) {
    const x = -0.6 + i * 0.28;
    merge(mesh, box([x, LOWER_TRAY, -0.2], [x + 0.18, LOWER_TRAY + 0.24 + (i % 3) * 0.06, 0.1], BOOK_COLOURS[i % 6]));
  }
  for (const x of [-0.55, 0.55]) {
    merge(mesh, box([x - 0.12, 0, -0.06], [x + 0.12, 0.2, 0.06], WHEEL));
    merge(mesh, box([x - 0.04, 0.06, -0.02], [x + 0.04, 0.14, 0.02], WHEEL_HUB));
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
