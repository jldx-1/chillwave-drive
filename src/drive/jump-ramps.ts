import { road } from './road';

export interface JumpRamp { id:number; x:number; s:number; width:number; length:number; height:number }
export const RAMP_SPACING=840;
export const RAMP_FIRST=200;
/** Ramp s is the takeoff edge; the incline approaches from lower logical distance. */
export function jumpRamps(s:number):JumpRamp[] {
  const first=Math.max(0,Math.floor((s-150-RAMP_FIRST)/RAMP_SPACING));
  const last=Math.floor((s+850-RAMP_FIRST)/RAMP_SPACING),ramps:JumpRamp[]=[];
  for(let id=first;id<=last;id++) {
    const at=RAMP_FIRST+id*RAMP_SPACING;
    if(road.routeAt(at))continue;
    ramps.push({id,x:[6.5,10.1,2.9,13.7][id%4],s:at,width:3,length:9,height:1.1});
  }
  // Give the player a reachable approach to raised expressway decks at high speed.
  const firstBridge=Math.max(0,Math.ceil((s-150-660)/1080)),lastBridge=Math.floor((s+850-660)/1080);
  for(let n=firstBridge;n<=lastBridge;n++){
    const at=660+n*1080;
    if(!road.routeAt(at)&&!ramps.some(r=>Math.abs(r.s-at)<60))ramps.push({id:100000+n,x:6.5,s:at,width:3,length:9,height:1.1});
  }
  return ramps.sort((a,b)=>a.s-b.s);
}
