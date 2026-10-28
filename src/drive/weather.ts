import { Random } from '../core/random';
import { clamp } from './config';
import { bridgeForChunk, type Skybridge } from './city-infrastructure';
import { overpassesAt } from './road';

export const RAIN = { windX: 1.1, windZ: .45, fall: 9.5, exposure: .018 };
export const GLASS = { width: 1.48, height: .80, baseY: .914, baseZ: -.874, upY: .455, upZ: .89 };
export const WIPER_AXIS = [0, .89, -.455] as const;
/** Shared by the physical blades and the water simulation, including a parked interval. */
export function wiperSweep(time: number, index: number, reduced: boolean): number {
  if (reduced) return 0;
  const phase = ((time + index * .035) % 1.65 + 1.65) % 1.65;
  const progress = phase < .55 ? .5 - .5 * Math.cos(Math.PI * phase / .55)
    : phase < 1.15 ? .5 + .5 * Math.cos(Math.PI * (phase - .55) / .6) : 0;
  return -1.05 * progress;
}
const bridgeShelters=new Map<number,Skybridge|null>();
export function rainSheltered(x: number, s: number): boolean {
  const id=Math.floor(s/120);
  if(Math.abs(s-(id*120+100))<2.1 && ((id%3)+3)%3===0) {
    if(!bridgeShelters.has(id)){if(bridgeShelters.size>16)bridgeShelters.clear();bridgeShelters.set(id,bridgeForChunk(id));}
    const bridge=bridgeShelters.get(id);
    if(bridge && Math.abs(s-bridge.s)<=bridge.depth/2 && x>=bridge.left && x<=bridge.right) return true;
  }
  return overpassesAt(s).some(p => Math.abs(s - p.s) <= p.length / 2 && Math.abs(x - p.x) <= p.width / 2);
}
/** Camera-centred storage, world-space motion. Origin rebasing never changes rainfall velocity. */
export class RainField {
  readonly positions: Float32Array;
  readonly opacity: Float32Array;
  private heads: Float32Array;
  private random = new Random(173);
  private anchor?: { x: number; s: number };
  constructor(readonly count = 1800) {
    this.positions = new Float32Array(count * 6); this.opacity = new Float32Array(count * 2);
    this.heads = new Float32Array(count * 3); this.reset();
  }
  reset(): void {
    this.random = new Random(173); this.anchor = undefined;
    for (let i = 0; i < this.count; i++) this.heads.set([this.random.range(-34, 34), this.random.range(.05, 22), this.random.range(-72, 28)], i * 3);
  }
  update(dt: number, x: number, s: number, yaw: number, reduced: boolean, activeCount = this.count): void {
    const dx = this.anchor ? x - this.anchor.x : 0, ds = this.anchor ? s - this.anchor.s : 0;
    if (Math.abs(dx) > 68 || Math.abs(ds) > 100) this.reset();
    const shiftX = this.anchor ? dx : 0, shiftS = this.anchor ? ds : 0;
    const vx = dt > 0 ? shiftX / dt : 0, vs = dt > 0 ? shiftS / dt : 0;
    if(this.anchor){this.anchor.x=x;this.anchor.s=s;}else this.anchor={x,s};
    const exposure = reduced ? .005 : RAIN.exposure;
    const sin = Math.sin(yaw), cos = Math.cos(yaw), shelters = overpassesAt(s);
    for (let i = 0; i < Math.min(this.count, activeCount); i++) {
      const j = i * 3, k = i * 6, fall = RAIN.fall * (.83 + (i % 13) / 39);
      let px = this.heads[j] - shiftX + (reduced ? 0 : RAIN.windX * dt);
      let py = this.heads[j + 1] - (reduced ? 0 : fall * dt);
      let pz = this.heads[j + 2] + shiftS + (reduced ? 0 : RAIN.windZ * dt);
      px = ((px + 34) % 68 + 68) % 68 - 34;
      pz = ((pz + 72) % 100 + 100) % 100 - 72;
      if (py < .05) { py += 22; px = this.random.range(-34, 34); pz = this.random.range(-72, 28); }
      this.heads[j]=px;this.heads[j+1]=py;this.heads[j+2]=pz;
      const localX = px * cos + pz * sin, localZ = -px * sin + pz * cos;
      // No falling particles inside the cabin, through the roof, or below an overpass.
      let hidden = Math.abs(localX) < 1.08 && Math.abs(localZ) < 2.5 && py < 1.4;
      if(!hidden)for(const shelter of shelters){
        if(py<shelter.underside&&Math.abs(s-pz-shelter.s)<=shelter.length/2&&Math.abs(x+px-shelter.x)<=shelter.width/2){hidden=true;break;}
      }
      const distance = Math.hypot(px, pz), fade = hidden ? 0 : clamp(1 - distance / 85, 0, 1) * (reduced ? .07 : .26);
      this.opacity[i * 2] = fade; this.opacity[i * 2 + 1] = fade * .16;
      this.positions[k]=px;this.positions[k+1]=py;this.positions[k+2]=pz;
      this.positions[k+3]=px-(RAIN.windX-vx)*exposure;this.positions[k+4]=py+fall*exposure;this.positions[k+5]=pz-(RAIN.windZ+vs)*exposure;
    }
  }
}
export interface Point2 { x: number; y: number }
export interface BladeSegment { a: Point2; b: Point2 }
export interface GlassDrop extends Point2 { radius: number; age: number; life: number }
const cross = (a: Point2, b: Point2, p: Point2) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function inTriangle(p: Point2, a: Point2, b: Point2, c: Point2): boolean {
  if (Math.abs(cross(a, b, c)) < 1e-9) return false;
  const signs = [cross(a, b, p), cross(b, c, p), cross(c, a, p)];
  return signs.every(v => v >= 0) || signs.every(v => v <= 0);
}
function bladeDistance(p: Point2, blade: BladeSegment): number {
  const dx = blade.b.x - blade.a.x, dy = blade.b.y - blade.a.y;
  const t = clamp(((p.x - blade.a.x) * dx + (p.y - blade.a.y) * dy) / Math.max(1e-8, dx * dx + dy * dy), 0, 1);
  return Math.hypot(p.x - blade.a.x - t * dx, p.y - blade.a.y - t * dy);
}
/** A continuous blade sweep, rather than testing only the current blade position. */
export function sweptBladeClears(p: Point2, before: BladeSegment, after: BladeSegment): boolean {
  return bladeDistance(p, before) < .009 || bladeDistance(p, after) < .009
    || inTriangle(p, before.a, before.b, after.b) || inTriangle(p, before.a, after.b, after.a);
}
export class WaterFilm {
  drops: GlassDrop[] = [];
  private random = new Random(900);
  private accumulator = 0;
  private previous: BladeSegment[] = [];
  constructor() { this.reset(); }
  reset(): void { this.drops = []; this.previous = []; this.accumulator = 0; this.random = new Random(900); for (let i = 0; i < 145; i++) this.add(); }
  private add(): void {
    if (this.drops.length >= 340) return;
    this.drops.push({ x: this.random.range(-GLASS.width / 2, GLASS.width / 2), y: this.random.range(0, GLASS.height), radius: this.random.range(.0015, .0055), age: 0, life: this.random.range(3, 9) });
  }
  update(dt: number, speed: number, blades: BladeSegment[], sheltered: boolean, reduced: boolean): void {
    if (!reduced && !sheltered) {
      this.accumulator += dt * (42 + Math.abs(speed) * 1.2);
      while (this.accumulator >= 1) { this.accumulator--; this.add(); }
    }
    this.drops = this.drops.filter(d => {
      if (reduced) return true;
      d.age += dt;
      // Small beads stick. Larger beads run down when stopped and up with airflow at speed.
      const mobile = clamp((d.radius - .0016) / .002, 0, 1);
      d.y += (.000085 * speed * Math.abs(speed) - .022) * mobile * dt;
      d.x += .003 * mobile * dt;
      if (d.y < 0 || d.y > GLASS.height || d.age > d.life) return false;
      return !blades.some((blade, i) => sweptBladeClears(d, this.previous[i] ?? blade, blade));
    });
    this.previous = blades.map(b => ({ a: { ...b.a }, b: { ...b.b } }));
  }
}
