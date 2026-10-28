import * as THREE from 'three';
import { hashSeed, Random } from '../core/random';
import { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';
import { sceneZ } from './road';
export type AerialKind='hovercar'|'transport'|'drone';
const kinds:AerialKind[]=['hovercar','transport','drone'];
const speeds=[6,-4.5,2];
export function aerialPose(seed:string,cell:number,kind:AerialKind,time:number,reduced=false) {
  const type=kinds.indexOf(kind), r=new Random(hashSeed(`${seed}:air:${cell}:${kind}`)),phase=r.range(0,Math.PI*2);
  const t=reduced?0:time;
  return {x:type===0?-10+Math.sin(t*.07+phase)*2:type===1?11+Math.sin(t*.05+phase)*2:Math.sin(t*.08+phase)*16,
    y:[24.5,35,46][type]+(reduced?0:Math.sin(t*.7+phase)*.28),
    s:cell*240+[105,155,215][type]+t*speeds[type],yaw:type===1?Math.PI:0};
}
interface Fleet {kind:AerialKind; parts:THREE.InstancedMesh[];poses:{x:number;y:number;s:number}[]}
/** Three readable silhouettes, instanced into a fixed pool along world-space flight lanes. */
export class AerialTraffic {
  readonly group=new THREE.Group();
  private fleets:Fleet[]=[];
  private transform=new THREE.Object3D();
  private projected=new THREE.Vector3();
  private visible=0;
  constructor(m:CityMaterials) {
    for(const kind of kinds) {
      const b=new UrbanBatch();
      if(kind==='hovercar') {
        b.tapered(m.steel,0,0,0,3.6,5.4,.7,.78);b.rounded(m.glass,0,.65,-.3,2.3,2.9,.72,.65);
        for(const side of [-1,1]) {b.box(m.dark,side*1.8,.23,.3,.65,.65,3.8);b.box(m.cyan,side*1.8,.12,2.25,.4,.25,.1);b.box(side<0?m.pink:m.neutralLight,side*1.85,.5,-1.8,.18,.15,.15);}
        b.box(m.cyan,0,-.08,0,2.2,.08,2.7);
      } else if(kind==='transport') {
        b.rounded(m.steel,0,0,0,4.6,8.5,1.3,.6);b.tapered(m.dark,0,1.3,1.7,3.2,4.1,.8,.8);
        b.box(m.glass,0,1.1,-3.8,3.4,.8,.15);
        for(const side of [-1,1]) {b.box(m.dark,side*2.3,.35,.2,.85,.9,5.8);b.box(m.neutralLight,side*1.8,.6,-4.3,.4,.14,.12);b.box(m.cyan,side*2.7,-.05,.2,.1,.12,4);}
        b.box(m.pink,0,.65,4.3,2.5,.12,.12);
      } else {
        b.tapered(m.dark,0,0,0,1.6,2,.7,.65);
        for(const side of [-1,1]) for(const end of [-1,1]) {
          b.beam(m.trim,new THREE.Vector3(0,.3,0),new THREE.Vector3(side*1.55,.3,end*1.2),.09,5);
          b.cylinder(m.dark,side*1.55,.4,end*1.2,.55,.15,10);
          b.box(side<0?m.pink:m.cyan,side*1.55,.2,end*1.2,.24,.12,.24);
        }
        b.box(m.cyan,0,-.1,0,.6,.1,1.2);
      }
      const template=b.build(),parts:THREE.InstancedMesh[]=[];
      for(const object of template.children) {
        const mesh=object as THREE.Mesh,instance=new THREE.InstancedMesh(mesh.geometry,mesh.material,5);
        instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);instance.frustumCulled=false;instance.castShadow=false;
        this.group.add(instance);parts.push(instance);
      }
      this.fleets.push({kind,parts,poses:[]});
    }
  }
  update(seed:string,s:number,origin:number,time:number,reduced:boolean):void {
    for(let type=0;type<this.fleets.length;type++) {
      const fleet=this.fleets[type],cell=Math.floor((s-(reduced?0:time)*speeds[type])/240);fleet.poses.length=0;
      let count=0;
      for(let id=cell-1;id<=cell+3;id++) {
        const pose=aerialPose(seed,id,fleet.kind,time,reduced);fleet.poses.push(pose);
        this.transform.position.set(pose.x,pose.y,sceneZ(pose.s,origin));this.transform.rotation.set(0,pose.yaw,0);this.transform.scale.setScalar(type===0?1.45:type===1?1.25:1);this.transform.updateMatrix();
        for(const part of fleet.parts) part.setMatrixAt(count,this.transform.matrix);count++;
      }
      for(const part of fleet.parts){part.count=count;part.instanceMatrix.needsUpdate=true;}
    }
  }
  inspectView(camera:THREE.Camera,origin:number):void {
    this.visible=0;
    for(const fleet of this.fleets) for(const pose of fleet.poses) {
      this.projected.set(pose.x,pose.y,sceneZ(pose.s,origin)).project(camera);
      if(Math.abs(this.projected.x)<.96&&Math.abs(this.projected.y)<.96&&this.projected.z>-1&&this.projected.z<1)this.visible++;
    }
  }
  get diagnostics(){return {visible:this.visible,count:this.fleets.length*5,kinds:kinds,poses:this.fleets.flatMap(f=>f.poses.map(p=>({...p,kind:f.kind}))) };}
  dispose():void {for(const fleet of this.fleets)for(const part of fleet.parts)part.geometry.dispose();}
}
