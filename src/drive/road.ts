import { LANES, ONCOMING, TUNE, clamp } from './config';
import type { CollisionHull } from './collision-profiles';
import { constrainMedian } from './median';

export type RoadPhase = 'highway' | 'deceleration' | 'exit' | 'service' | 'return' | 'acceleration';
export interface RoadNode { id: string; x: number; s: number; kind: 'boundary' | 'junction' | 'connector' }
export interface RoadLane { id: string; edge: string; index: number; direction: 1 | -1; width: number; successors: string[] }
export interface RoadEdge { id: string; from: string; to: string; kind: RoadPhase; startS: number; endS: number; speedLimit: number; lane: string }
export interface RoadNetwork { id: number; nodes: RoadNode[]; edges: RoadEdge[]; lanes: RoadLane[] }
export interface RoadSample { x: number; s: number; tangentX: number; tangentS: number; width: number; curvature: number; speedLimit: number; phase: RoadPhase }
export interface Route {
  id: number; exit: number; rejoin: number; kind: 'detour'; entryEnd: number; mergeStart: number;
  district: 'commercial' | 'industrial'; name: string; edges: string[];
}
interface Phase { kind: Exclude<RoadPhase, 'highway'>; a: number; b: number; x0: number; x1: number; speed: number }
const outerLane = LANES[LANES.length - 1];
const phases: Phase[] = [
  { kind: 'deceleration', a: 0, b: 100, x0: outerLane, x1: 17.3, speed: 30 },
  { kind: 'exit', a: 100, b: 280, x0: 17.3, x1: 32, speed: 24 },
  { kind: 'service', a: 280, b: 620, x0: 32, x1: 32, speed: 22 },
  { kind: 'return', a: 620, b: 800, x0: 32, x1: 17.3, speed: 24 },
  { kind: 'acceleration', a: 800, b: 900, x0: 17.3, x1: outerLane, speed: 36 },
];
// Each exit is a continuous northbound street with a different offset and bend.
const phaseVariants: Phase[][] = [phases, ...([[36,36],[35,28]] as const).map(([entry,end]) =>
  phases.map(p => p.kind === 'exit' ? { ...p, x1: entry } :
    p.kind === 'service' ? { ...p, x0: entry, x1: end } :
    p.kind === 'return' ? { ...p, x0: end } : p))];
const routePhases = (id:number):Phase[] => phaseVariants[((id % 3) + 3) % 3];
const routeNames = ['NEON MARKET STREET', 'INDUSTRIAL ACCESS', 'CANAL DISTRICT'] as const;
const routeEdge = (id: number, phase: RoadPhase) => `detour:${id}:${phase}`;
/** Directed lane topology and the centerline geometry used by physics, rendering, and navigation. */
export class RoadGraph {
  private readonly routeCache = new Map<number, Route>();
  constructor(readonly interval = 1800, readonly exitAt = 800, readonly detourLength = 900) {}
  private route(id: number): Route {
    const cached=this.routeCache.get(id);if(cached)return cached;
    const exit = id * this.interval + this.exitAt, scale = this.detourLength / 900;
    const result:Route = { id, exit, rejoin: exit + this.detourLength, entryEnd: exit + 100 * scale,
      mergeStart: exit + 800 * scale, kind: 'detour', district: id % 2 === 0 ? 'commercial' : 'industrial', name: routeNames[((id % 3) + 3) % 3],
      edges: routePhases(id).map(p => routeEdge(id, p.kind)) };
    if(this.routeCache.size>=8)this.routeCache.delete(this.routeCache.keys().next().value!);
    this.routeCache.set(id,result);return result;
  }
  routeAt(s: number): Route | undefined {
    const id=Math.floor(s/this.interval),exit=id*this.interval+this.exitAt;
    return s>=exit&&s<=exit+this.detourLength ? this.route(id) : undefined;
  }
  /** Route selection happens before the diverging exit, while the outer lane is reachable. */
  entryWindow(s: number): Route | undefined {
    const id=Math.floor(s/this.interval),exit=id*this.interval+this.exitAt;
    return s>=exit-180&&s<=exit+35*this.detourLength/900 ? this.route(id) : undefined;
  }
  mergeWindow(s: number): Route | undefined {
    const route = this.routeAt(s);
    return route && s >= route.mergeStart ? route : undefined;
  }
  sampleDetour(s: number): RoadSample | undefined {
    const route = this.routeAt(s); if (!route) return;
    const scale = this.detourLength / 900, d = (s - route.exit) / scale;
    const routeShape = routePhases(route.id);
    const phase = routeShape.find(p => d < p.b) ?? routeShape[routeShape.length - 1];
    const u = clamp((d - phase.a) / (phase.b - phase.a), 0, 1), distance = (phase.b - phase.a) * scale;
    // Quintic transitions have zero first and second derivatives at every connection.
    const smooth = u * u * u * (10 - 15 * u + 6 * u * u);
    const derivative = (phase.x1 - phase.x0) * 30 * u * u * (1 - u) * (1 - u) / distance;
    const second = (phase.x1 - phase.x0) * 60 * u * (1 - u) * (1 - 2 * u) / (distance * distance);
    const length = Math.hypot(1, derivative);
    return { x: phase.x0 + (phase.x1 - phase.x0) * smooth, s, tangentX: derivative / length,
      tangentS: 1 / length, width: 7.2, curvature: second / length ** 3, speedLimit: phase.speed, phase: phase.kind };
  }
  branchCenter(s: number): number | undefined { return this.sampleDetour(s)?.x; }
  bounds(s: number): [number, number][] {
    const branch = this.branchCenter(s);
    return branch === undefined ? [[1.25, 15.45]] : [[1.25, 15.45], [branch - 2.6, branch + 2.6]];
  }
  /** Reserved physical roads, shoulders, and clear verges for deterministic building placement. */
  corridorAt(s: number): [number, number][] {
    const branch = this.sampleDetour(s);
    return branch ? [[-19.5, 19.5], [branch.x - branch.width / 2 - 3.8, branch.x + branch.width / 2 + 3.8]] : [[-19.5, 19.5]];
  }
  constrain(x: number, s: number): number {
    const ranges = this.bounds(s);
    if (ranges.some(([a, b]) => x >= a && x <= b)) return x;
    return ranges.map(([a, b]) => clamp(x, a, b)).sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
  }
  constrainPlayer(x: number, s: number, oldX: number, time: number, held?: number): number {
    const paved = x < 1.25 ? Math.max(-15.45, x) : this.constrain(x, s);
    return constrainMedian(paved, s, oldX, time, held);
  }
  /** Above the median, retain the roadway edges without clamping crossings to one carriageway. */
  constrainAirborne(x:number,s:number):number { return x < 1.25 ? clamp(x,-15.45,1.25) : this.constrain(x,s); }
  /** Keep the whole pursuing SUV inside its committed paved corridor, including yaw and root offsets. */
  policeBounds(s: number, yaw: number, hull: CollisionHull, route: 'main' | 'detour'): [number, number] {
    let lo = -Infinity, hi = Infinity;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const [x, z] of hull) {
      const dx = x*c+z*sn, at = s-x*sn+z*c;
      let left = .57, right = 16.38;
      const branch = route === 'detour' ? this.sampleDetour(at) : undefined;
      if (branch) {
        const half = branch.width / (2 * branch.tangentS);
        left = branch.x-half <= 16.5 ? left : branch.x-half+.18;
        right = Math.max(right, branch.x+half-.18);
      }
      lo = Math.max(lo, left-dx); hi = Math.min(hi, right-dx);
    }
    return [lo, hi];
  }
  constrainPolice(x: number, s: number, yaw: number, hull: CollisionHull, route: 'main' | 'detour'): number {
    const [lo, hi] = this.policeBounds(s, yaw, hull, route);
    return clamp(x, lo, hi);
  }
  onDetour(x: number, s: number): boolean {
    const sample = this.sampleDetour(s); return sample !== undefined && x > 16 && Math.abs(x - sample.x) < sample.width / 2;
  }
  /** One directed edge per lane makes every fork/merge endpoint geometrically unambiguous. */
  networkAt(s: number): RoadNetwork {
    const id = Math.floor(s / this.interval), route = this.route(id), start = id * this.interval, end = start + this.interval;
    const nodes: RoadNode[] = [], edges: RoadEdge[] = [], lanes: RoadLane[] = [], known = new Set<string>();
    const node = (key: string, x: number, at: number, kind: RoadNode['kind']) => {
      if (!known.has(key)) { nodes.push({ id: key, x, s: at, kind }); known.add(key); } return key;
    };
    const add = (key: string, from: string, to: string, kind: RoadPhase, a: number, b: number, direction: 1 | -1, speedLimit: number, index: number) => {
      const lane = `${key}:lane`; edges.push({ id: key, from, to, kind, startS: a, endS: b, speedLimit, lane });
      lanes.push({ id: lane, edge: key, index, direction, width: kind === 'highway' ? 3.6 : 7.2, successors: [] });
    };
    for (const direction of [1, -1] as const) for (let lane = 0; lane < 4; lane++) {
      const x = (direction === 1 ? LANES : ONCOMING)[lane], stations = [start, route.exit, route.rejoin, end];
      const keys = stations.map(at => node(`highway:${direction}:${lane}:${at}`, x, at, at === start || at === end ? 'boundary' : 'junction'));
      for (let part = 0; part < stations.length - 1; part++) add(`main:${id}:${direction}:${lane}:${part}`, keys[direction === 1 ? part : part + 1], keys[direction === 1 ? part + 1 : part], 'highway', stations[part], stations[part + 1], direction, TUNE.maxSpeed, lane);
    }
    let previous = `highway:1:3:${route.exit}`;
    const scale = this.detourLength / 900;
    for (const phase of routePhases(id)) {
      const a = route.exit + phase.a * scale, b = route.exit + phase.b * scale;
      const next = phase.kind === 'acceleration' ? `highway:1:3:${route.rejoin}` : node(`connector:${id}:${phase.kind}`, phase.x1, b, 'connector');
      add(routeEdge(id, phase.kind), previous, next, phase.kind, a, b, 1, phase.speed, 0); previous = next;
    }
    for (const lane of lanes) {
      const edge = edges.find(e => e.id === lane.edge)!;
      lane.successors = edges.filter(next => next.from === edge.to).map(next => next.lane);
    }
    return { id, nodes, edges, lanes };
  }
  /** Validation returns actionable errors instead of accepting a disconnected generated road. */
  validateNetwork(id: number): string[] {
    const network = this.networkAt(id * this.interval), errors: string[] = [];
    const nodes = new Map(network.nodes.map(n => [n.id, n])), edges = new Map(network.edges.map(e => [e.id, e]));
    const lanes = new Map(network.lanes.map(l => [l.id, l]));
    for (const edge of network.edges) {
      const from = nodes.get(edge.from), to = nodes.get(edge.to), lane = lanes.get(edge.lane);
      if (!from || !to || !lane) { errors.push(`Missing endpoint or lane: ${edge.id}`); continue; }
      if (!(edge.endS > edge.startS && lane.width > 0 && edge.speedLimit > 0)) errors.push(`Invalid dimensions: ${edge.id}`);
      for (const successor of lane.successors) {
        const next = lanes.get(successor), nextEdge = next && edges.get(next.edge);
        if (!nextEdge || nextEdge.from !== edge.to || next?.direction !== lane.direction) errors.push(`Disconnected lane successor: ${lane.id}`);
      }
      if (edge.kind !== 'highway') for (const endpoint of [from, to]) {
        const sample = this.sampleDetour(endpoint.s);
        if (!sample || Math.abs(endpoint.x - sample.x) > 1e-6) errors.push(`Centerline gap: ${edge.id}`);
      }
    }
    const route = this.route(id), exit = route.edges[0], reentry = `main:${id}:1:3:2`, pending = [exit], reached = new Set<string>();
    while (pending.length) {
      const key = pending.pop()!; if (reached.has(key)) continue; reached.add(key);
      const edge = edges.get(key), lane = edge && lanes.get(edge.lane);
      for (const next of lane?.successors ?? []) { const successor = lanes.get(next); if (successor) pending.push(successor.edge); }
    }
    if (!reached.has(reentry)) errors.push(`Detour ${id} cannot rejoin highway`);
    return errors;
  }
}
export const road = new RoadGraph();
export function sceneZ(s: number, origin: number): number { return -(s - origin); }
export function originFor(s: number): number { return Math.floor(s / 1000) * 1000; }

export interface Overpass { id: number; s: number; x: number; width: number; length: number; underside: number; thickness: number }
/** Shared deck geometry for scene construction and physical rain shelter queries. */
export function overpassesAt(s: number): Overpass[] {
  const chunk = Math.floor(s / 120), result: Overpass[] = [];
  for (let id = chunk - 2; id <= chunk + 2; id++) if ((id % 9 + 9) % 9 === 6) {
    const center = id * 120 + 60;
    result.push({ id, s: center, x: 0, width: road.routeAt(center) ? 84 : 70, length: 13, underside: 8.3, thickness: 1.4 });
  }
  return result;
}
