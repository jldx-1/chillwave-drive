import { Random, hashSeed } from '../core/random';
export interface BuildingSpec { height: number; width: number; depth: number; style: number; setback: number; tiers: number; antenna: boolean }
export function buildingSpec(seed: string, chunk: number, index: number, side: number): BuildingSpec {
  const r = new Random(hashSeed(`${seed}:architecture:${chunk}:${index}:${side}`));
  return { height: r.range(32, 155), width: r.range(15, 23), depth: r.range(18, 27), style: Math.floor(r.range(0, 5)), setback: r.range(1.5, 4), tiers: Math.floor(r.range(2, 5)), antenna: r.next() > .6 };
}
