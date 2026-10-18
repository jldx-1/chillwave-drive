import * as THREE from 'three';
import type { Contact } from './collisions';
interface Fragment { x:number; y:number; s:number; vx:number; vy:number; vs:number; life:number; max:number; spark:boolean }
export class CrashEffects {
  private slots: Fragment[] = [];
  private geometry = new THREE.BufferGeometry();
  private positions = new Float32Array(512*3); private colors = new Float32Array(512*3);
  readonly points: THREE.Points;
  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));
    this.points=new THREE.Points(this.geometry,new THREE.PointsMaterial({size:.09,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));this.points.frustumCulled=false;scene.add(this.points);
  }
  emit(c:Contact):void {
    const count=Math.min(60,Math.ceil(c.speed*2));
    for(let i=0;i<count;i++){
      if(this.slots.length>=512)this.slots.shift();const spark=i%3!==0;
      this.slots.push({x:c.x,y:spark?.35:.05,s:c.s,vx:(Math.random()-.5)*4+c.nx*2,vy:Math.random()*2,vs:(Math.random()-.5)*4+c.ns*2,life:spark?.55:1.1,max:spark?.55:1.1,spark});
    }
  }
  update(dt:number,origin:number,reduced:boolean):void {
    this.slots=this.slots.filter(p=>p.life>0);let i=0;
    for(const p of this.slots){p.life-=dt;p.x+=p.vx*dt;p.s+=p.vs*dt;p.vy-=9.81*dt;p.y+=p.vy*dt;if(p.y<.02){p.y=.02;p.vy*=-.18;p.vx*=.8;p.vs*=.8;}this.positions.set([p.x,p.y,-(p.s-origin)],i*3);const a=p.life/p.max;this.colors.set(p.spark?[a,a*.53,a*.12]:[a*.5,a*.64,a*.74],i++*3);}
    this.geometry.setDrawRange(0,reduced?0:i);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
  reset():void{this.slots=[];this.geometry.setDrawRange(0,0);}
}
