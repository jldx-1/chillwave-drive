import { Random, hashSeed } from '../core/random';
import { road, overpassesAt, districtPassagesAt } from './road';
import { BUILDING_CATALOG, buildingAsset, type BuildingAsset } from './building-catalog';

export const CITY_CHUNK = 120;
export const CITY_STREAM_BEHIND=6;
export const CITY_STREAM_AHEAD=7;
export const GROUND_HALF_WIDTH = 740;
export const CITY_ROW_SPACING = 56;
export const CITY_ROWS = 4;
export const CITY_BUILDING_GAP = 4;
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
/** Dense frontage plots follow the actual street reserve; the catalog supplies identity and height. */
export function cityChunk(seed:string,id:number):CityChunkSpec {
  const start=id*CITY_CHUNK,overpasses=overpassesAt(start+60).filter(p=>Math.floor(p.s/CITY_CHUNK)===id);
  const front:[number,number]=[23,23];
  const district=road.routeAt(start+60)?.district??(Math.floor(id/8)%3===2?'industrial':'commercial');
  const intervals:[number,number][]=[];let cursor=start+6;
  for(const bridge of overpasses) {
    intervals.push([cursor,bridge.s-bridge.length/2-5]);cursor=bridge.s+bridge.length/2+5;
  }
  intervals.push([cursor,start+CITY_CHUNK-6]);
  const parcels:CityParcel[]=[];
  const passages=districtPassagesAt(start+60);
  for(const side of [-1,1] as const)for(let row=0;row<CITY_ROWS;row++) {
    let slot=0;
    for(const [lo,hi] of intervals) {
      let at=lo;
      while(hi-at>=26) {
        const lane=(side<0?0:CITY_ROWS)+row;
        const gateway=[[11,4,88],[51,3,81]];
        const a=id===0&&slot===0&&row<3?buildingAsset(gateway[side<0?0:1][row]):catalogAt(seed,id*CITY_ROWS*6+lane*3+slot);
        const parcelSeed=hashSeed(`${seed}:parcel:${id}:${side}:${row}:${slot}`);
        const width=28+parcelSeed%8*2,depth=Math.min(26+(parcelSeed>>>4)%5*2,hi-at);
        const center=at+depth/2,blocked:[number,number][]=[];
        for(let s=center-depth/2;s<=center+depth/2+.01;s+=2)for(const [a,b] of road.corridorAt(s))
          blocked.push(side===1?[a-3.5,b+3.5]:[-b-3.5,-a+3.5]);
        for(const q of parcels)if(q.side===side&&Math.abs(q.s-center)<(q.depth+depth)/2+CITY_BUILDING_GAP)
          blocked.push([Math.abs(q.x)-q.width/2-CITY_BUILDING_GAP,Math.abs(q.x)+q.width/2+CITY_BUILDING_GAP]);
        for(const passage of passages)if(Math.abs(passage.s-center)<(passage.length+depth)/2+1.5)
          blocked.push(side===1?[passage.x-passage.width/2-1.5,passage.x+passage.width/2+1.5]:[-passage.x-passage.width/2-1.5,-passage.x+passage.width/2+1.5]);
        blocked.sort((a,b)=>a[0]-b[0]);
        let edge=front[side<0?0:1];
        for(const [a,b] of blocked) {if(edge+width<=a)break;if(edge<b&&edge+width>a)edge=b;}
        parcels.push({id:`${id}:${side}:${row}:${slot}`,assetId:a.id,x:side*(edge+width/2),s:center,width,depth,height:a.height,side,row,style:family(a),seed:parcelSeed,floors:a.floors,sign:parcelSeed%16});
        slot++;at+=depth+CITY_BUILDING_GAP;
      }
    }
  }
  if(id%7===3&&!overpasses.length) {
    const p=parcels.find(p=>p.row===0&&p.side===1)!;
    if(p)Object.assign(p,{assetId:undefined,style:'fuel',height:6,floors:1});
  }
  return {id,start,front,parcels,district,overpasses};
}
export function parcelRoadClearance(p: CityParcel): number {
  let clearance = Infinity;
  for (let s = p.s - p.depth / 2; s <= p.s + p.depth / 2 + .01; s += 2) for (const [a, b] of road.corridorAt(s)) {
    clearance = Math.min(clearance, Math.max(a-(p.x+p.width/2),p.x-p.width/2-b));
  }
  return clearance;
}
