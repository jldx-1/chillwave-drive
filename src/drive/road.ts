import { clamp } from './config';
export interface Route { id: number; exit: number; rejoin: number; kind: 'detour' }
export class RoadGraph {
  constructor(readonly interval = 3000, readonly exitAt = 800, readonly detourLength = 900) {}
  routeAt(s: number): Route | undefined {
    const id = Math.floor(s / this.interval), exit = id * this.interval + this.exitAt;
    return s >= exit && s <= exit + this.detourLength ? { id, exit, rejoin: exit + this.detourLength, kind: 'detour' } : undefined;
  }
  branchCenter(s: number): number | undefined {
    const route = this.routeAt(s);
    return route ? 14 + 15 * Math.sin(Math.PI * (s - route.exit) / this.detourLength) ** 2 : undefined;
  }
  bounds(s: number): [number, number][] {
    const branch = this.branchCenter(s);
    return branch === undefined ? [[1.25, 15.45]] : [[1.25, 15.45], [branch - 2.6, branch + 2.6]];
  }
  constrain(x: number, s: number): number {
    const ranges = this.bounds(s);
    if (ranges.some(([a, b]) => x >= a && x <= b)) return x;
    return ranges.map(([a, b]) => clamp(x, a, b)).sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
  }
  onDetour(x: number, s: number): boolean { return this.branchCenter(s) !== undefined && x > 16; }
}
export const road = new RoadGraph();
export function sceneZ(s: number, origin: number): number { return -(s - origin); }
export function originFor(s: number): number { return Math.floor(s / 1000) * 1000; }

export interface RoadObstacle { id:number; x:number; s:number; width:number; length:number }
export function roadsideObstacles(s: number): RoadObstacle[] {
  const current=Math.floor(s/120), result:RoadObstacle[]=[];
  for(let id=current-2;id<=current+3;id++)if(id>=8&&id%17===8&&!road.routeAt(id*120+75))result.push({id:-10000-id,x:14.35,s:id*120+75,width:1.6,length:3});
  return result;
}
