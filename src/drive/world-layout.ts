import { Random, hashSeed } from '../core/random';
import { road, overpassesAt } from './road';
import { BUILDING_CATALOG, buildingAsset, type BuildingAsset } from './building-catalog';

export const CITY_CHUNK = 120;
export const CITY_STREAM_BEHIND=6;
export const CITY_STREAM_AHEAD=7;
export const GROUND_HALF_WIDTH = 740;
export const CITY_ROW_SPACING = 110;
export type Architecture = 'curtain' | 'stepped' | 'masonry' | 'residential' | 'rounded' | 'garage' | 'warehouse' | 'fuel';
export interface CityParcel {
  id: string; x: number; s: number; width: number; depth: number; height: number;
  assetId?: number; side: -1 | 1; row: number; style: Architecture; seed: number; floors: number; sign: number;
}
export interface CityChunkSpec {
  id: number; start: number; front: [number, number]; parcels: CityParcel[];
  district: 'commercial' | 'industrial'; overpasses: ReturnType<typeof overpassesAt>;
}
export function groundCovers(x: number): boolean { return Math.abs(x) <= GROUND_HALF_WIDTH; }
let catalogSeed='', catalogOrder:number[]=[];
/** A shuffled catalog cycle guarantees every authored asset is available, without numeric street order. */
export function catalogAt(seed:string,index:number):BuildingAsset {
  if(seed!==catalogSeed||catalogOrder.length===0) {
    catalogSeed=seed;catalogOrder=BUILDING_CATALOG.map(a=>a.id);
    const r=new Random(hashSeed(`${seed}:catalog-order`));
    for(let i=catalogOrder.length-1;i>0;i--){const j=Math.floor(r.next()*(i+1));[catalogOrder[i],catalogOrder[j]]=[catalogOrder[j],catalogOrder[i]];}
  }
  return buildingAsset(catalogOrder[((index%100)+100)%100]);
}
function family(a:BuildingAsset):Architecture {
  if(a.id===26||a.id===67)return 'garage';
  if(a.district===7)return 'warehouse';
  if(a.district===4)return 'residential';
  if([1,4,38,52,53,55,57,59,80,94].includes(a.id))return 'rounded';
  if([3,13,20,23,27,29,35,49,58,76,84,91,97].includes(a.id))return 'stepped';
  return a.district===3?'masonry':'curtain';
}
/** Reserve native-scale plots and cross streets before choosing buildings. No footprint is squeezed to fit. */
export function cityChunk(seed:string,id:number):CityChunkSpec {
  const start=id*CITY_CHUNK,overpasses=overpassesAt(start+60).filter(p=>Math.floor(p.s/CITY_CHUNK)===id);
  const front:[number,number]=[23,23];
  for(let ds=0;ds<=CITY_CHUNK;ds+=4)for(const [a,b]of road.corridorAt(start+ds)) {
    front[0]=Math.max(front[0],-a+3.5);front[1]=Math.max(front[1],b+3.5);
  }
  const district=road.routeAt(start+60)?.district??(Math.floor(id/8)%3===2?'industrial':'commercial');
  const intervals:[number,number][]=[];let cursor=start+7;
  for(const bridge of overpasses) {
    intervals.push([cursor,bridge.s-bridge.length/2-5]);cursor=bridge.s+bridge.length/2+5;
  }
  intervals.push([cursor,start+CITY_CHUNK-7]);
  const parcels:CityParcel[]=[];
  for(const side of [-1,1]as const)for(let row=0;row<3;row++) {
    const lane=(side<0?0:3)+row;
    // A composed gateway establishes the portrait, signature sign and tall silhouettes on the first drive.
    const gateway=[[11,4,88],[51,3,81]];
    const first=id===0?buildingAsset(gateway[side<0?0:1][row]):catalogAt(seed,id*6+lane);
    const second=catalogAt(seed,id*6+lane+43);
    let slot=0;
    for(const [lo,hi]of intervals) {
      const length=hi-lo;
      if(length<25)continue;
      const fitting=BUILDING_CATALOG.filter(a=>a.plotDepth<=length);
      let a=first.plotDepth<=length?first:fitting[hashSeed(`${seed}:${id}:${lane}:infill:${slot}`)%fitting.length];
      const both=!(id===0&&row===0)&&!overpasses.length&&a.plotDepth+second.plotDepth+10<=length&&a.id!==second.id;
      const choices=both?[a,second]:[a];
      for(const [i,asset]of choices.entries()) {
        a=asset;const s=both?(i===0?lo+a.plotDepth/2:hi-a.plotDepth/2):(lo+hi)/2;
        const width=a.plotWidth,depth=a.plotDepth,x=side*(front[side<0?0:1]+width/2+row*CITY_ROW_SPACING);
        const parcelSeed=hashSeed(`${seed}:parcel:${id}:${side}:${row}:${slot}`);
        parcels.push({id:`${id}:${side}:${row}:${slot++}`,assetId:a.id,x,s,width,depth,height:a.height,side,row,style:family(a),seed:parcelSeed,floors:a.floors,sign:parcelSeed%16});
      }
    }
  }
  // Small service forecourts remain part of the street mix alongside the catalog buildings.
  if(id%7===3&&!overpasses.length) {
    const row=0,side=1 as const,p=parcels.find(p=>p.row===row&&p.side===side)!;
    Object.assign(p,{assetId:undefined,style:'fuel',width:26,depth:29,height:6,floors:1,x:front[1]+13});
  }
  return {id,start,front,parcels,district,overpasses};
}
export function parcelRoadClearance(p: CityParcel): number {
  let clearance = Infinity;
  for (let s = p.s - p.depth / 2; s <= p.s + p.depth / 2 + .01; s += 2) for (const [a, b] of road.corridorAt(s)) {
    clearance = Math.min(clearance, p.side === 1 ? p.x - p.width / 2 - b : a - p.x - p.width / 2);
  }
  return clearance;
}
