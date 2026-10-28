import * as THREE from 'three';
import { cityChunk } from './world-layout';
import { catalogPlan } from './catalog-architecture';
import { catalogEntryHeight,catalogFrontage } from './catalog-frontage';
import { roadLamp } from './city-infrastructure';
import type { Quality } from './config';
import { sceneZ } from './road';
interface Source { key:string;x:number;y:number;s:number;category:number;color:string;power:number }
interface Slot {light:THREE.PointLight;category:number;owner?:Source;pending?:Source;fade:number}
/** Six bounded real lights; fixed fixture geometry and static reflection spill fill the distance. */
export class CityLighting {
  readonly group=new THREE.Group();
  private slots:Slot[]=[];
  private sources:Source[]=[];
  private key='';
  constructor() {
    for(let i=0;i<6;i++) {
      const light=new THREE.PointLight('#ffc180',0,i<4?38:22,2);light.castShadow=false;
      this.group.add(light);this.slots.push({light,category:i<2?0:i<4?1:2,fade:0});
    }
  }
  update(seed:string,s:number,origin:number,dt:number,quality:Quality):void {
    const chunk=Math.floor(s/120),key=`${seed}:${chunk}`;
    if(key!==this.key) {
      this.key=key;this.sources=[];
      for(let id=chunk-1;id<=chunk+1;id++) {
        for(const side of [-1,1]) for(const ds of [12,48,84]) {
          const lamp=roadLamp(id*120+ds,side);
          this.sources.push({...lamp,key:`road:${id}:${side}:${ds}`,category:side<0?0:1,color:'#ffbd7b',power:340});
        }
        for(const p of cityChunk(seed,id).parcels) if(p.row===0 && p.style!=='warehouse' && p.style!=='fuel') {
          const plan=p.assetId?catalogPlan(p.assetId):undefined;
          const width=plan?.asset.id===1?58:plan?.asset.width??p.width;
          const bays=plan?catalogFrontage(plan.asset.id,plan.asset.depth):[];
          const lobby=bays.find(b=>b.use===plan?.asset.ground)??bays[Math.floor(bays.length/2)];
          this.sources.push({key:`shop:${p.id}`,category:2,x:p.x-p.side*(width/2-2.1),y:plan?catalogEntryHeight(plan.asset.ground,plan.podium)-.16:3.7,s:p.s-(lobby?.center??0),color:'#ffe0b3',power:170});
        }
      }
    }
    for(let i=0;i<this.slots.length;i++) {
      const slot=this.slots[i];let candidate:Source|undefined,nearest=Infinity;
      for(const source of this.sources) {
        if(source.category!==slot.category || this.slots.some(other=>other!==slot&&(other.owner?.key===source.key||other.pending?.key===source.key))) continue;
        const distance=Math.abs(source.s-s)+(source.category===2&&source.s<s?15:0);if(distance<nearest){nearest=distance;candidate=source;}
      }
      const oldDistance=slot.owner?Math.abs(slot.owner.s-s):Infinity;
      if(!slot.owner && candidate) {slot.owner=candidate;slot.fade=0;}
      else if(candidate&&candidate.key!==slot.owner?.key&&(oldDistance>62||oldDistance>nearest+16)) slot.pending=candidate;
      const enabled=quality!=='low'||i===0||i===2||i===4;
      const target=slot.pending||!slot.owner||Math.abs(slot.owner.s-s)>78||!enabled?0:1;
      slot.fade+=(target-slot.fade)*(1-Math.exp(-Math.min(dt,.1)*7));
      if(slot.pending&&slot.fade<.015){slot.owner=slot.pending;slot.pending=undefined;slot.fade=0;}
      if(slot.owner) {
        slot.light.position.set(slot.owner.x,slot.owner.y,sceneZ(slot.owner.s,origin));slot.light.color.set(slot.owner.color);
        const range=1-THREE.MathUtils.smoothstep(Math.abs(slot.owner.s-s),48,76);
        slot.light.intensity=slot.owner.power*slot.fade*range;
      }
    }
  }
  reset():void {this.key='';for(const slot of this.slots){slot.owner=slot.pending=undefined;slot.fade=0;slot.light.intensity=0;}}
  get diagnostics(){return {physicalLights:this.slots.length,activeLights:this.slots.filter(s=>s.light.intensity>1).length,sources:this.slots.map(s=>({key:s.owner?.key??'',position:s.light.position.toArray(),intensity:s.light.intensity}))};}
}
