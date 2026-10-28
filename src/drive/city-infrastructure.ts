import * as THREE from 'three';
import { road } from './road';
import type { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
export interface Skybridge { id:number;s:number;left:number;right:number;floor:number;type:'enclosed'|'open'|'gantry';depth:number }
/** Fixed routes and structural clearances are shared with the rain shelter query. */
export function bridgeForChunk(id:number):Skybridge|null {
  if(((id%3)+3)%3!==0) return null;
  let left=23,right=23;
  for(let ds=0;ds<=120;ds+=4) for(const [a,b] of road.corridorAt(id*120+ds)){left=Math.max(left,-a+3.5);right=Math.max(right,b+3.5);}
  const type=(['enclosed','open','gantry'] as const)[((Math.floor(id/3)%3)+3)%3];
  return {id,s:id*120+100,left:-left,right,floor:type==='gantry'?11.8:type==='open'?18.2:16.4,type,depth:type==='gantry'?2.2:3.8};
}
export function roadLamp(s:number,side:number):{x:number;y:number;s:number} {
  const outer=side<0?17.9:Math.max(17.9,...road.corridorAt(s).map(v=>v[1]+.4));
  return {x:side*(outer-3.3),y:10.7,s};
}
export function streetLamp(b:UrbanBatch,m:CityMaterials,x:number,z:number,side:number,highway=false): void {
  const h=highway?10.7:6.8,reach=highway?3.3:1.4;
  b.box(m.concrete,x,.18,z,.65,.36,.65);b.box(m.steel,x,.5,z,.28,.65,.28);
  b.cylinder(m.dark,x,(h-1)/2,z,highway?.13:.09,h-1,8);
  b.beam(m.dark,v(x,h-1,z),v(x-side*.55,h-.1,z),.12,7);
  b.beam(m.dark,v(x-side*.55,h-.1,z),v(x-side*reach,h,z),.105,7);
  b.box(m.dark,x-side*reach,h,z,1.7,.28,.65);
  b.box(m.trim,x-side*reach,h+.15,z,1.9,.09,.7);
  b.box(highway?m.light:m.neutralLight,x-side*reach,h-.17,z,1.55,.055,.5);
  for(const dx of [-.2,.2]) b.cylinder(m.trim,x+dx,.4,z+.2,.035,.15,5);
}
export function skybridge(b:UrbanBatch,m:CityMaterials,p:Skybridge,start:number): void {
  const z=-(p.s-start),width=p.right-p.left,center=(p.left+p.right)/2,y=p.floor;
  b.box(m.concrete,center,y-.3,z,width,.6,p.depth);
  for(const side of [-1,1]) {
    const dz=side*(p.depth/2+.1);
    b.box(m.steel,center,y-.65,z+dz,width,.35,.3);
    b.box(m.neutralLight,center,y-.47,z+dz,width-.7,.065,.08);
    b.box(m.trim,center,y+1.1,z+dz,width,.08,.08);
    if(p.type!=='gantry') b.box(m.shopGlass,center,y+.58,z+dz,width,1,.08);
    for(let x=p.left+.4;x<p.right;x+=4) {
      b.box(m.steel,x,y+.6,z+dz,.12,1.2,.12);
      b.beam(m.steel,v(x,y-.8,z+dz),v(Math.min(x+4,p.right),y-.15,z+dz),.07,5);
      if(p.type==='enclosed') b.box(m.trim,x,y+1.6,z+dz,.12,3.2,.12);
    }
    if(p.type==='enclosed') {
      b.box(m.shopGlass,center,y+2.2,z+dz,width,2.1,.07);
      b.box(m.trim,center,y+3.3,z+dz,width,.17,.2);
    }
  }
  if(p.type==='enclosed') {b.box(m.dark,center,y+3.4,z,width,.2,p.depth+.4);b.box(m.neutralLight,center,y+3.25,z,width-.8,.05,.18);}
  if(p.type==='gantry') {
    for(const dy of [0,2.2]) b.box(m.steel,center,y+dy,z,width,.18,.25);
    for(let x=p.left;x<p.right;x+=3) b.beam(m.steel,v(x,y,z),v(Math.min(p.right,x+3),y+2.2,z),.08,5);
    b.box(m.dark,12,y+1.5,z+.8,.8,.5,1.1);b.box(m.glass,12,y+1.45,z+1.4,.55,.28,.1);
  }
  for(const x of [p.left-.7,p.right+.7]) {
    b.box(m.concrete,x,y/2-.3,z,1.25,y-.6,1.8);
    b.box(m.steel,x,y+1.1,z,1.9,2.2,p.depth+.7);
    b.box(m.neutralLight,x,y+1.1,z+p.depth/2+.4,.5,1.6,.06);
  }
  b.box(m.dark,4,y-1.45,z+p.depth/2+.25,10,2.2,.3);
  b.panel(m.sign,4,y-1.45,z+p.depth/2+.43,9.7,1.9,0,m.signRects[16]);
  for(const x of [0,8]) b.box(m.steel,x,y-.6,z+p.depth/2+.2,.1,1.8,.1);
}
export function streetscape(b:UrbanBatch,m:CityMaterials,edge:number,side:number):void {
  const x=side*(edge-1.8);
  for(let ds=4;ds<120;ds+=4) b.box(m.dark,x,.126,-ds,2.9,.014,.025);
  for(const ds of [26,70,110]) {
    b.box(m.steel,x,.15,-ds,.75,.035,1.2);
    for(let i=0;i<5;i++) b.box(m.dark,x,.173,-ds-.45+i*.22,.6,.014,.04);
    b.box(m.concrete,x+side*.6,.23,-ds-3,1.4,.46,2.5);b.box(m.terrain,x+side*.6,.48,-ds-3,1.15,.08,2.2);
    b.box(m.dark,x,.55,-ds+3,.7,.14,2);b.box(m.dark,x+side*.22,.95,-ds+3,.12,.7,2);
    for(const dz of [-.7,.7]) b.box(m.steel,x,.3,-ds+3+dz,.45,.6,.12);
    for(const dz of [-2,2]) {b.cylinder(m.steel,side*(edge-3),.6,-ds+dz,.09,1.05,6);b.box(m.neutralLight,side*(edge-3),.93,-ds+dz,.15,.06,.15);}
  }
}
