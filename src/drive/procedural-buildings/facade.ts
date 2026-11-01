/** Facade helpers shared by the buildings: window quads with interiors, framed windows, side frames. */
import { BufferAttribute, PlaneGeometry } from "three";
import type { Builder } from "./builder";
import type { Rng } from "./rng";

export const STYLE = { home: 0, shop: 1, office: 2, dim: 3, pod: 4 } as const;

/** a glass quad with an interior-mapped room; centred at (cx, cy), at depth z, facing +z */
export function winQuad(b: Builder, cx: number, cy: number, z: number, w: number, h: number, seed: number, style: number, cols=1, rows=1): void {
  const g = new PlaneGeometry(w, h);
  const a = new Float32Array(4 * 4);
  for (let i = 0; i < 4; i++) a.set([seed, w, h, style], i * 4);
  g.setAttribute("aWin", new BufferAttribute(a, 4));
  const grid=new Float32Array(4*2);for(let i=0;i<4;i++)grid.set([cols,rows],i*2);
  g.setAttribute("aFrame",new BufferAttribute(grid,2));
  g.translate(cx, cy, z);
  b.addRaw("win", g);
}

export interface WinOpts {
  frame?: string;
  cols?: number; // vertical mullions + 1
  rows?: number;
  sill?: boolean;
  frameW?: number;
  style?: number;
}

/** window with frame, mullions and sill; (cx, cy) centre of the glass, wall surface at z */
export function framedWindow(b: Builder, rng: Rng, cx: number, cy: number, z: number, w: number, h: number, o: WinOpts = {}): void {
  const fk = o.frame ?? "frame";
  const t = o.frameW ?? 0.06;
  const d = 0.09;
  winQuad(b, cx, cy, z + 0.012, w, h, rng.next() * 997 + 1, o.style ?? STYLE.home, o.cols??2, o.rows??1);
  // outer frame
  b.box(fk, cx, cy + h / 2 + t / 2, z + d / 2, w + t * 2, t, d);
  b.box(fk, cx, cy - h / 2 - t / 2, z + d / 2, w + t * 2, t, d);
  b.box(fk, cx - w / 2 - t / 2, cy, z + d / 2, t, h, d);
  b.box(fk, cx + w / 2 + t / 2, cy, z + d / 2, t, h, d);
  // Interior mullions are analytically filtered in the window material, avoiding subpixel geometry shimmer.
  if (o.sill !== false) b.box("concreteLight", cx, cy - h / 2 - t - 0.03, z + 0.08, w + 0.24, 0.06, 0.16);
}

/** the four side frames of a w x d footprint centred at the origin: [x0, z0, ry, length] */
export function sides(W: number, D: number): [number, number, number, number][] {
  return [
    [-W / 2, D / 2, 0, W],
    [W / 2, D / 2, Math.PI / 2, D],
    [W / 2, -D / 2, Math.PI, W],
    [-W / 2, -D / 2, -Math.PI / 2, D],
  ];
}
