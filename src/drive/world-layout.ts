import { Random, hashSeed } from '../core/random';
import { road, overpassesAt } from './road';

export const CITY_CHUNK = 120;
export const GROUND_HALF_WIDTH = 740;
export type Architecture = 'curtain' | 'stepped' | 'masonry' | 'residential' | 'rounded' | 'garage' | 'warehouse' | 'fuel';
export interface CityParcel {
  id: string; x: number; s: number; width: number; depth: number; height: number;
  side: -1 | 1; row: number; style: Architecture; seed: number; floors: number; sign: number;
}
export interface CityChunkSpec {
  id: number; start: number; front: [number, number]; parcels: CityParcel[];
  district: 'commercial' | 'industrial'; overpasses: ReturnType<typeof overpassesAt>;
}
export function groundCovers(x: number): boolean { return Math.abs(x) <= GROUND_HALF_WIDTH; }
/** Road reserves are resolved before parcels, including their full length rather than just their centres. */
export function cityChunk(seed: string, id: number): CityChunkSpec {
  const start = id * CITY_CHUNK, r = new Random(hashSeed(`${seed}:city:${id}`));
  const overpasses = overpassesAt(start + 60).filter(p => Math.floor(p.s / CITY_CHUNK) === id);
  const front: [number, number] = [23, 23];
  for (let ds = 0; ds <= CITY_CHUNK; ds += 4) for (const [a, b] of road.corridorAt(start + ds)) {
    front[0] = Math.max(front[0], -a + 3.5); front[1] = Math.max(front[1], b + 3.5);
  }
  const district = road.routeAt(start + 60)?.district ?? (Math.floor(id / 8) % 3 === 2 ? 'industrial' : 'commercial');
  const parcels: CityParcel[] = [];
  for (const side of [-1, 1] as const) for (let row = 0; row < 3; row++) for (let slot = 0; slot < 3; slot++) {
    const s = start + 20 + slot * 40;
    // A complete cross street, including elevated approach embankments, occupies the bridge block.
    if (overpasses.some(p => Math.abs(p.s - s) < 20)) continue;
    const width = row === 0 ? r.range(19, 25) : r.range(24, 32), depth = r.range(23, 29);
    const x = side * (front[side === -1 ? 0 : 1] + width / 2 + row * 50);
    const families: Architecture[] = ['curtain', 'stepped', 'masonry', 'residential', 'rounded'];
    let style = families[Math.floor(r.next() * families.length)];
    if (row === 0 && slot === 1 && id % 5 === 2) style = 'garage';
    if (row === 0 && side === 1 && slot === 1 && id % 7 === 3) style = 'fuel';
    if (district === 'industrial' && row < 2 && (slot + row) % 2 === 0) style = 'warehouse';
    const height = style === 'fuel' ? 6 : style === 'warehouse' ? r.range(10, 18) : style === 'garage' ? r.range(18, 27)
      : row === 1 ? r.range(66, 185) : row === 0 ? r.range(28, 116) : r.range(35, 130);
    const floors = Math.max(1, Math.floor(height / (style === 'residential' ? 3.3 : 4)));
    parcels.push({ id: `${id}:${side}:${row}:${slot}`, x, s, width, depth, height, side, row, style, seed: hashSeed(`${seed}:parcel:${id}:${side}:${row}:${slot}`), floors, sign: Math.floor(r.range(0, 24)) });
  }
  return { id, start, front, parcels, district, overpasses };
}
export function parcelRoadClearance(p: CityParcel): number {
  let clearance = Infinity;
  for (let s = p.s - p.depth / 2; s <= p.s + p.depth / 2 + .01; s += 2) for (const [a, b] of road.corridorAt(s)) {
    clearance = Math.min(clearance, p.side === 1 ? p.x - p.width / 2 - b : a - p.x - p.width / 2);
  }
  return clearance;
}
