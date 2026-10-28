import { road, overpassesAt } from './road';
import type { Vehicle } from './vehicle';
import { bridgeForChunk } from './city-infrastructure';

export interface RoadSign { id:number; x:number; s:number; width:number; bottom:number; top:number }
/** The overhead sign placement is shared by the streamed geometry and collision checks. */
export function roadSignForChunk(id:number):RoadSign | undefined {
  if ((id % 3 + 3) % 3 !== 1) return;
  const start=id*120, route=road.routeAt(start+90);
  return {id,x:route?13:7,s:start+96,width:route?6:9,bottom:7.2,top:9};
}
export interface EnvironmentHit { kind:'sign'|'overpass'; x:number; s:number; speed:number; id:number }
/** Continuous swept checks prevent a fast airborne car from tunneling through an overhead obstacle. */
export class EnvironmentCollisions {
  readonly brokenSigns=new Set<number>();
  reset():void { this.brokenSigns.clear(); }
  step(player:Vehicle):EnvironmentHit[] {
    if(!player.airborne && player.jumpHeight<=0)return [];
    const from=player.previous, low=Math.min(from.s,player.s)-player.tuning.length/2, high=Math.max(from.s,player.s)+player.tuning.length/2;
    const minX=Math.min(from.x,player.x)-player.tuning.width/2, maxX=Math.max(from.x,player.x)+player.tuning.width/2;
    const lowY=Math.min(from.height??0,player.jumpHeight),highY=Math.max(from.height??0,player.jumpHeight)+1.3;
    const hits:EnvironmentHit[]=[];
    for(let id=Math.floor(low/120)-1;id<=Math.floor(high/120)+1;id++){
      const sign=roadSignForChunk(id);
      if(!sign||this.brokenSigns.has(id)||sign.s<low||sign.s>high||maxX<sign.x-sign.width/2||minX>sign.x+sign.width/2||highY<sign.bottom||lowY>sign.top)continue;
      const speed=Math.hypot(player.velocityS,player.lateral,player.jumpVelocity);
      if(speed>=14){this.brokenSigns.add(id);hits.push({kind:'sign',x:player.x,s:sign.s,speed,id});player.speed*=.9;player.collide(speed*.12);}
    }
    const structures=overpassesAt((low+high)/2);
    if(highY>=10)for(let id=Math.floor(low/120)-1;id<=Math.floor(high/120)+1;id++){
      const bridge=bridgeForChunk(id);if(bridge)structures.push({id:1000000+id,s:bridge.s,x:(bridge.left+bridge.right)/2,width:bridge.right-bridge.left,length:bridge.depth,underside:bridge.floor-.8,thickness:1.4});
    }
    for(const bridge of structures){
      if(high<bridge.s-bridge.length/2||low>bridge.s+bridge.length/2||maxX<bridge.x-bridge.width/2||minX>bridge.x+bridge.width/2||highY<bridge.underside||lowY>bridge.underside+bridge.thickness)continue;
      const speed=Math.hypot(player.velocityS,player.lateral,player.jumpVelocity);
      hits.push({kind:'overpass',x:player.x,s:bridge.s,speed,id:bridge.id});
      const deckTop=bridge.underside+bridge.thickness;
      if((from.height??0)>=deckTop){player.jumpHeight=deckTop+.05;player.jumpVelocity=Math.max(1,Math.abs(player.jumpVelocity)*.4);}
      else {player.jumpHeight=Math.max(0,bridge.underside-1.3-.05);player.jumpVelocity=-Math.max(1,Math.abs(player.jumpVelocity)*.4);}
      player.s=Math.min(player.s,bridge.s-bridge.length/2-player.tuning.length/2);player.speed*=.35;
      if(speed>=25&&player.shield<=0)player.explode();else player.collide(speed*.75);
      break;
    }
    return hits;
  }
}
