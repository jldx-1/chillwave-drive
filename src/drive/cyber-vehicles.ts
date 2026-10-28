import type { FleetKind } from './vehicle-catalog';
import type { CollisionHull } from './collision-profiles';

export type CyberModel = 'vortex'|'sentinel'|'phantom'|'barricade'|'aurora'|'lumen'|'nebula'|'vector'|'mira'|'pulse'|'titan'|'cargo'|'orbit'|'nova'|'aegis';
export type WheelFamily = 'armored'|'covered'|'turbine'|'performance'|'commercial'|'luxury';
export interface CyberVehicleSpec {
  id:CyberModel; name:string; kind:FleetKind; length:number; width:number; height:number;
  wheelRadius:number; wheelbase:number; mass:number; wheels:WheelFamily;
  colors:readonly string[]; accent:string; speed:number; acceleration:number; agility:number;
  emergency:'police'|'rescue'|false; weight:number; axles:readonly number[];
}
const car=(id:CyberModel,name:string,kind:FleetKind,length:number,width:number,height:number,wheelRadius:number,wheelbase:number,mass:number,wheels:WheelFamily,colors:string[],accent:string,speed:number,acceleration:number,agility:number,weight:number,emergency:CyberVehicleSpec['emergency']=false,axles:readonly number[]=[-wheelbase/2,wheelbase/2]):CyberVehicleSpec=>({id,name,kind,length,width,height,wheelRadius,wheelbase,mass,wheels,colors,accent,speed,acceleration,agility,weight,emergency,axles});
/** Native metre dimensions and authored geometry; no contemporary car mesh is used. */
export const CYBER_VEHICLES:Record<CyberModel,CyberVehicleSpec>={
  vortex:car('vortex','VORTEX-9','police',4.9,2.05,1.35,.355,2.98,1900,'armored',['#101b2d'],'#36cfff',112,9.5,1,0,'police'),
  sentinel:car('sentinel','SENTINEL-X','police',5.3,2.2,1.9,.43,3.18,3100,'armored',['#242a34'],'#43caff',102,7.4,.78,0,'police'),
  phantom:car('phantom','PHANTOM-6','police',4.7,1.98,1.3,.35,2.86,1700,'covered',['#141320'],'#9775d8',118,10.2,1.1,0,'police'),
  barricade:car('barricade','BARRICADE-12','police',6.4,2.45,2.5,.5,4.25,6900,'armored',['#333d47'],'#399cda',88,5.2,.57,0,'police',[-2.05,.6,2.05]),
  aurora:car('aurora','AURORA LX','sedan',5.2,2,1.45,.36,3.24,2050,'luxury',['#dde5e9','#41475a','#739cbb'],'#89dcff',33,2.5,.8,16),
  lumen:car('lumen','LUMEN-E','hatchback',4.65,1.86,1.48,.32,2.83,1550,'covered',['#94a3ad','#233b5c','#3c515b','#2e9e98'],'#50b9c9',31,2.8,1,32),
  nebula:car('nebula','NEBULA XR','sport',4.55,2,1.25,.345,2.72,1480,'performance',['#542f87','#1263a3','#252535'],'#df48b6',43,4.3,1.12,9),
  vector:car('vector','VECTOR GT','sport',4.75,2.15,1.12,.35,2.95,1510,'performance',['#19abc6','#432c77','#263047'],'#ff52bf',54,5.4,1.2,2),
  mira:car('mira','MIRA-5','sedan',4.8,1.95,1.72,.32,3.03,1950,'covered',['#d9e4e5','#a4c5c8'],'#52d7c5',28,2,.7,12),
  pulse:car('pulse','PULSE CARGO','truck',5.5,2.1,2.45,.38,3.4,3100,'commercial',['#c8d1d6','#303b49','#c08c52'],'#5ebbd1',27,1.8,.63,10),
  titan:car('titan','TITAN-X','truck',17,2.5,3.95,.5,4.3,16500,'commercial',['#365978','#b9c5d0','#3a444e'],'#4cb7dc',24,1.1,.35,1, false,[-6.75,-3.3,-2,5.1,6.4,7.7]),
  cargo:car('cargo','CARGO-6','truck',8,2.4,3.2,.46,4.85,6700,'commercial',['#6d7b88','#b1bbc6','#315777'],'#469bd9',25,1.5,.48,4,false,[-2.75,2.1,3.1]),
  orbit:car('orbit','ORBIT SHUTTLE','truck',10.5,2.5,3.2,.45,6.6,9200,'turbine',['#c4d3dc','#597089'],'#8694e4',25,1.3,.43,3),
  nova:car('nova','NOVA-4','pickup',5.6,2.1,1.85,.42,3.4,2600,'turbine',['#46515f','#92a3ae','#4e636d'],'#70c4d6',30,2.3,.76,10),
  aegis:car('aegis','AEGIS-7','suv',5.4,2.2,2.05,.43,3.2,3300,'armored',['#d2dedf'],'#52cad6',35,2.8,.7,1,'rescue'),
};
export const CYBER_MODEL_IDS=Object.keys(CYBER_VEHICLES) as CyberModel[];
export const DEFAULT_CYBER_MODEL:Record<FleetKind,CyberModel>={sedan:'aurora',suv:'aegis',pickup:'nova',truck:'cargo',hatchback:'lumen',sport:'nebula',police:'vortex'};
export const cyberModel=(kind:FleetKind,model?:CyberModel):CyberModel=>model??DEFAULT_CYBER_MODEL[kind];
export function chooseCivilian(value:number):CyberVehicleSpec {
  const candidates=CYBER_MODEL_IDS.map(id=>CYBER_VEHICLES[id]).filter(s=>s.weight>0),sum=candidates.reduce((n,s)=>n+s.weight,0);
  let point=Math.min(.999999,Math.max(0,value))*sum;
  return candidates.find(s=>(point-=s.weight)<0)??candidates[candidates.length-1];
}
/** Chamfered convex body envelope in the solver's local [right,forward] convention. */
const hulls=new Map<string,CollisionHull>();
export function cyberHull(id:CyberModel,trailerAngle=0):CollisionHull {
  const step=id==='titan'?Math.round(Math.max(-.075,Math.min(.075,trailerAngle))/.005):0,key=id+':'+step;
  if(hulls.has(key))return hulls.get(key)!;
  const {width,length}=CYBER_VEHICLES[id],w=width/2,l=length/2,c=Math.min(.25,length*.04);
  let shape:CollisionHull=[[-w,-l+c],[-w+c,-l],[w-c,-l],[w,-l+c],[w,l-c],[w-c,l],[-w+c,l],[-w,l-c]];
  if(step) {
    // A convex envelope of tractor and articulated trailer prevents the visual trailer cutting
    // through another car; it feeds the existing single-body impulse solver.
    const angle=step*.005,cos=Math.cos(angle),sin=Math.sin(angle),points:[number,number][]=[];
    for(const x of [-w,w]){points.push([x,2],[x,l]);for(const z of [-l,2.3]){const d=z-2.3;points.push([x*cos-d*sin,x*sin+d*cos+2.3]);}}
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a:readonly number[],b:readonly number[],p:readonly number[])=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    const half=(list:[number,number][])=>{const h:[number,number][]=[];for(const p of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}h.pop();return h;};
    shape=[...half(points),...half([...points].reverse())];
  }
  hulls.set(key,shape);return shape;
}
