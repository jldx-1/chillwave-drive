import * as THREE from 'three';
import { CYBER_VEHICLES } from './cyber-vehicles';
import type { Agent } from './traffic';
import { sceneZ } from './road';
import { clamp, damp, type Quality } from './config';

interface Slot { id?:number; level:number }
const fadeRange=(distance:number):number=>{
  const t=clamp((distance-50)/40,0,1);
  return 1-t*t*(3-2*t);
};
/** Fixed light budget with persistent owners and fade-out before a slot changes vehicles. */
export class VehicleLighting {
  readonly group=new THREE.Group();
  readonly positions=Array.from({length:4},()=>new THREE.Vector3());
  readonly colors=Array.from({length:4},()=>new THREE.Color('#000000'));
  private warnings=Array.from({length:4},(_,i)=>new THREE.PointLight(i%2?'#1675ff':'#ff253a',0,19,2));
  private beams=Array.from({length:2},()=>new THREE.SpotLight('#d0e4ff',0,65,.27,.75,1.8));
  private targets=Array.from({length:2},()=>new THREE.Object3D());
  private warningSlots:Slot[]=Array.from({length:2},()=>({level:0}));
  private beamSlots:Slot[]=Array.from({length:2},()=>({level:0}));
  private units=0;
  private origin=0;
  constructor(){
    this.group.add(...this.warnings,...this.beams,...this.targets);
    this.beams.forEach((beam,i)=>beam.target=this.targets[i]);
  }
  private assign(slots:Slot[], candidates:Agent[],playerS:number,dt:number): (Agent|undefined)[] {
    const used=new Set(slots.map(slot=>slot.id));
    return slots.map(slot=>{
      const car=candidates.find(a=>a.id===slot.id);
      const next=candidates.find(a=>!used.has(a.id));
      // Hysteresis prevents equally distant cars from exchanging light slots each frame.
      const change=!car || !!next && Math.abs(next.s-playerS)+20<Math.abs(car.s-playerS);
      const target=car&&!change?fadeRange(Math.abs(car.s-playerS)):0;
      slot.level=damp(slot.level,target,8,Math.min(.1,Math.max(0,dt)));
      if(change && slot.level<.01){
        used.delete(slot.id);slot.level=0;slot.id=next?.id;
        if(next)used.add(next.id);
        return next;
      }
      return car;
    });
  }
  update(agents:Agent[],playerS:number,origin:number,time:number,quality:Quality,dt=1/60,alpha=1):void{
    if(origin!==this.origin){
      const shift=origin-this.origin;
      for(const object of this.group.children)object.position.z+=shift;
      for(const position of this.positions)position.z+=shift;
      this.origin=origin;
    }
    const close=agents.filter(a=>Math.abs(a.s-playerS)<100).sort((a,b)=>Math.abs(a.s-playerS)-Math.abs(b.s-playerS));
    const patrols=close.filter(a=>a.kind==='police'&&a.active||a.model==='aegis'&&a.emergency);
    const active=this.assign(this.warningSlots,patrols,playerS,dt);
    this.units=active.filter(Boolean).length;
    this.warnings.forEach((light,i)=>{
      const slot=Math.floor(i/2),car=active[slot],red=i%2===0;
      // The lightbar still signals; its reflected illumination crossfades rather than strobing the scene.
      const phase=.5+.5*Math.cos(time*Math.PI*2/.6);
      const strength=this.warningSlots[slot].level*(red?phase:1-phase);
      light.intensity=strength*(quality==='low'?22:46);
      const rescue=car?.model==='aegis',color=rescue?(red?'#ffba45':'#35d8ee'):(red?'#ff253a':'#1675ff');
      light.color.set(color);this.colors[i].set(color).multiplyScalar(strength);
      if(car){
        const x=car.oldX+(car.x-car.oldX)*alpha,s=car.oldS+(car.s-car.oldS)*alpha;
        light.position.set(x+(red?-.42:.42)*Math.cos(car.yaw),car.model?CYBER_VEHICLES[car.model].height-.08:1.84,sceneZ(s,origin)+(red?-.42:.42)*Math.sin(car.yaw));
        this.positions[i].copy(light.position);
      }
    });
    const headlights=this.assign(this.beamSlots,quality==='low'?[]:close,playerS,dt);
    this.beams.forEach((light,i)=>{
      const car=headlights[i];light.intensity=this.beamSlots[i].level*22;
      if(!car)return;
      const x=car.oldX+(car.x-car.oldX)*alpha,s=car.oldS+(car.s-car.oldS)*alpha;
      const z=sceneZ(s,origin),sin=Math.sin(car.yaw),cos=Math.cos(car.yaw);
      const front=car.model?CYBER_VEHICLES[car.model].length/2+.12:2.2;
      light.position.set(x+sin*front,car.model==='titan'?1.48:car.model==='barricade'?1.53:.88,z-cos*front);
      this.targets[i].position.set(x+sin*34,0,z-cos*34);
    });
  }
  get diagnostics(){return {warningLights:this.warnings.length,headlightBeams:this.beams.length,activeUnits:this.units};}
}
