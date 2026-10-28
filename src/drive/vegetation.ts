import * as THREE from 'three';
import { Random } from '../core/random';
import type { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';
export interface Branch { from: [number,number,number]; to: [number,number,number]; radius: number }
export interface BlossomCluster { x:number;y:number;z:number;size:number;rotation:number;color:number }
export function floweringTree(seed:number): {branches:Branch[];clusters:BlossomCluster[];height:number} {
  const r=new Random(seed), height=r.range(4.6,7.1), lean=r.range(-.45,.45), width=r.range(1.6,2.7), branches:Branch[]=[],clusters:BlossomCluster[]=[];
  branches.push({from:[0,0,0],to:[lean,height*.57,.13],radius:r.range(.1,.17)});
  const count=4+seed%3;
  for(let i=0;i<count;i++) {
    const angle=i*Math.PI*2/count+r.range(-.4,.4), spread=width*r.range(.65,1.15), join=height*r.range(.35,.53);
    const tip:[number,number,number]=[lean+Math.cos(angle)*spread,height*r.range(.72,.96),Math.sin(angle)*spread];
    const fork:[number,number,number]=[lean*.7+tip[0]*.43,join+.6,tip[2]*.4];
    branches.push({from:[lean*.7,join,.05],to:fork,radius:.065},{from:fork,to:tip,radius:.043});
    for(let j=0;j<2;j++) {
      const end:[number,number,number]=[tip[0]+r.range(-.6,.6),tip[1]+r.range(-.2,.8),tip[2]+r.range(-.6,.6)];
      branches.push({from:tip,to:end,radius:.02});
      clusters.push({x:end[0],y:end[1],z:end[2],size:r.range(1.25,2.05),rotation:r.range(0,Math.PI),color:Math.floor(r.next()*3)});
    }
  }
  return {branches,clusters,height};
}
export function tree(b:UrbanBatch,m:CityMaterials,x:number,z:number,seed:number): void {
  const model=floweringTree(seed);
  b.box(m.concrete,x,.23,z,2.2,.46,2.2); b.box(m.terrain,x,.48,z,1.9,.06,1.9);
  b.box(seed%2?m.pink:m.neutralLight,x,.35,z+1.11,1.4,.055,.035);
  for(const branch of model.branches) b.beam(m.bark,new THREE.Vector3(x+branch.from[0],branch.from[1]+.48,z+branch.from[2]),new THREE.Vector3(x+branch.to[0],branch.to[1]+.48,z+branch.to[2]),branch.radius,6);
  for(const cluster of model.clusters) for(let i=0;i<2;i++) b.panel(m.leaves[cluster.color],x+cluster.x,cluster.y+.45,z+cluster.z,cluster.size*1.2,cluster.size,cluster.rotation+i*Math.PI/2);
  for(let i=0;i<3;i++) b.panel(m.leaves[seed%3],x+Math.sin(i*2)*.6,.85,z+Math.cos(i*2)*.6,.8,.65,i*2);
}
/** Curved fronds have separate tapered leaflets, not rigid cylindrical spokes. */
export function palm(b:UrbanBatch,m:CityMaterials,x:number,z:number,seed=1,base=0): void {
  if(base===0){b.box(m.concrete,x,.21,z,2.1,.42,2.1);b.box(m.terrain,x,.44,z,1.8,.05,1.8);}
  const r=new Random(seed), height=r.range(7.5,11.5), lean=r.range(.35,1.2), count=8+seed%3;
  for(let i=0;i<5;i++) {
    const t=i/5, u=(i+1)/5;
    b.beam(m.bark,new THREE.Vector3(x+lean*t*t,base+height*t,z),new THREE.Vector3(x+lean*u*u,base+height*u,z),.15*(1-t*.45),7);
    b.cylinder(m.trim,x+lean*t*t,base+height*t,z,.16*(1-t*.4),.045,7);
  }
  for(let i=0;i<count;i++) {
    const angle=i*Math.PI*2/count, length=r.range(3,4.8), dx=Math.cos(angle),dz=Math.sin(angle), vertices:number[]=[],uv:number[]=[];
    const point=(t:number)=>new THREE.Vector3(x+lean+dx*length*t,base+height+Math.sin(t*Math.PI)*.85-t*t*1.6,z+dz*length*t);
    for(let j=0;j<=8;j++) {
      const t=j/8,p=point(t),width=Math.sin(Math.PI*t)*.26;
      vertices.push(p.x-dz*width,p.y,p.z+dx*width,p.x+dz*width,p.y,p.z-dx*width);uv.push(0,t,1,t);
      if(j>0&&j<8) for(const side of [-1,1]) {
        const tip=point(Math.min(1,t+.12)), spread=Math.sin(Math.PI*t)*.8;
        vertices.push(p.x,p.y,p.z,tip.x-dz*spread*side,tip.y-.18,tip.z+dx*spread*side,p.x+dx*.17,p.y-.03,p.z+dz*.17); uv.push(.5,t,0,t,1,t);
      }
    }
    // The central ribbon and leaflets use separate indexing as vertices are interleaved above.
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    // Rebuild ribbon indices from the explicit row starts, skipping inserted leaflet vertices.
    const ribbon:number[]=[]; let offset=0;
    for(let j=0;j<=8;j++){ribbon.push(offset);offset+=2+(j>0&&j<8?6:0);}
    const faces:number[]=[];
    for(let j=1;j<ribbon.length;j++){const a=ribbon[j-1],c=ribbon[j];faces.push(a,a+1,c,c,a+1,c+1);}
    for(let j=1;j<8;j++){const a=ribbon[j]+2;faces.push(a,a+1,a+2,a+3,a+4,a+5);}
    g.setIndex(faces);g.computeVertexNormals();b.add(m.palmLeaf,g);
  }
}
