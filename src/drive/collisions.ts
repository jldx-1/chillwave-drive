import type { CollisionHull } from './collision-profiles';
/** Planar rigid-body contacts. World s increases toward the horizon; yaw turns toward +x. */
export interface Body2D {
  id: number; x: number; s: number; oldX: number; oldS: number;
  vx: number; vs: number; yaw: number; spin: number; mass: number; width: number; length: number;
  hull?: CollisionHull;
}
export interface Contact { a: number; b: number; x: number; s: number; nx: number; ns: number; speed: number; impulse: number; material: 'metal' | 'concrete' }
type Point = readonly [number, number];
const dot = (ax: number, as: number, bx: number, bs: number) => ax * bx + as * bs;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const rectangle = (b: Body2D): CollisionHull => [[-b.width/2,-b.length/2],[b.width/2,-b.length/2],[b.width/2,b.length/2],[-b.width/2,b.length/2]];
interface Shape { yaw:number; width:number; length:number; hull:CollisionHull|undefined; points: Point[]; minX:number; maxX:number; minS:number; maxS:number }
const shapes=new WeakMap<Body2D,Shape>();
function shape(b: Body2D): Shape {
  let cached=shapes.get(b);if(cached&&cached.yaw===b.yaw&&cached.width===b.width&&cached.length===b.length&&cached.hull===b.hull)return cached;
  const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
  const points:Point[]=(b.hull??rectangle(b)).map(([x,z])=>[x*c+z*s,-x*s+z*c]);
  cached={yaw:b.yaw,width:b.width,length:b.length,hull:b.hull,points,minX:Infinity,maxX:-Infinity,minS:Infinity,maxS:-Infinity};
  for(const [x,z]of points){cached.minX=Math.min(cached.minX,x);cached.maxX=Math.max(cached.maxX,x);cached.minS=Math.min(cached.minS,z);cached.maxS=Math.max(cached.maxS,z);}
  shapes.set(b,cached);return cached;
}
/** Cheap swept world bounds reject distant pairs; only oriented hull SAT resolves contacts. */
export function sweptBounds(b:Body2D){
  const p=shape(b);return {minX:Math.min(b.x,b.oldX)+p.minX,maxX:Math.max(b.x,b.oldX)+p.maxX,minS:Math.min(b.s,b.oldS)+p.minS,maxS:Math.max(b.s,b.oldS)+p.maxS};
}
function project(points: Point[],x:number,s:number): [number,number] {
  let lo=Infinity,hi=-Infinity;
  for(const p of points){const n=dot(...p,x,s);lo=Math.min(lo,n);hi=Math.max(hi,n);}
  return [lo,hi];
}
function normalAxes(a:Point[],b:Point[]): Point[] {
  const out:Point[]=[];
  for(const points of [a,b])for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],dx=q[0]-p[0],ds=q[1]-p[1],length=Math.hypot(dx,ds);
    if(length<1e-8)continue;
    const nx=-ds/length,ns=dx/length;
    if(!out.some(axis=>Math.abs(dot(...axis,nx,ns))>1-1e-8))out.push([nx,ns]);
  }
  return out;
}
function supportRange(points:Point[],nx:number,ns:number,tx:number,ts:number,maximum:boolean):[number,number] {
  const extreme=project(points,nx,ns)[maximum?1:0];let lo=Infinity,hi=-Infinity;
  for(const p of points)if(Math.abs(dot(...p,nx,ns)-extreme)<1e-5){const n=dot(...p,tx,ts);lo=Math.min(lo,n);hi=Math.max(hi,n);}
  return [lo,hi];
}
export function solveContact(a: Body2D, b: Body2D, restitution = .12): Contact | undefined {
  const pa=shape(a).points,pb=shape(b).points,axes=normalAxes(pa,pb);
  let penetration=Infinity,nx=0,ns=0,overlapping=true,previouslyOverlapping=true;
  const spans=axes.map(([x,s])=>{
    const aa=project(pa,x,s),bb=project(pb,x,s);
    const lo=aa[0]-bb[1],hi=aa[1]-bb[0];
    const now=dot(b.x-a.x,b.s-a.s,x,s),old=dot(b.oldX-a.oldX,b.oldS-a.oldS,x,s);
    const overlap=Math.min(hi-now,now-lo);
    if(overlap < -1e-8)overlapping=false;
    if(old<lo-1e-8||old>hi+1e-8)previouslyOverlapping=false;
    if(overlap<penetration){penetration=overlap;const sign=hi-now<now-lo?1:-1;nx=x*sign;ns=s*sign;}
    return {x,s,lo,hi,old,now};
  });
  if(!overlapping||!previouslyOverlapping){
    // Continuous SAT uses every oriented hull edge, not the larger world-aligned boxes.
    let enter=0,leave=1,ex=0,es=0;
    for(const {x,s,lo,hi,old,now} of spans){
      const delta=now-old;
      if(Math.abs(delta)<1e-10){if(old<lo-1e-8||old>hi+1e-8)return;continue;}
      const t1=(lo-old)/delta,t2=(hi-old)/delta,start=Math.min(t1,t2);
      if(start>enter||(!ex&&!es&&start>=0)){enter=start;const sign=delta<0?1:-1;ex=x*sign;es=s*sign;}
      leave=Math.min(leave,Math.max(t1,t2));
      if(enter>leave+1e-10)return;
    }
    if(enter<0||enter>1||(!ex&&!es))return;
    a.x=a.oldX+(a.x-a.oldX)*enter;a.s=a.oldS+(a.s-a.oldS)*enter;
    b.x=b.oldX+(b.x-b.oldX)*enter;b.s=b.oldS+(b.s-b.oldS)*enter;
    nx=ex;ns=es;penetration=.004;
  }
  const ia=1/a.mass,ib=1/b.mass;
  const inertiaA=a.mass*(a.width**2+a.length**2)/12,inertiaB=b.mass*(b.width**2+b.length**2)/12;
  const tx=-ns,ts=nx,ap=project(pa,nx,ns),bp=project(pb,nx,ns);
  const normal=(ap[1]+dot(a.x,a.s,nx,ns)+bp[0]+dot(b.x,b.s,nx,ns))/2;
  const at=supportRange(pa,nx,ns,tx,ts,true),bt=supportRange(pb,nx,ns,tx,ts,false);
  const alo=at[0]+dot(a.x,a.s,tx,ts),ahi=at[1]+dot(a.x,a.s,tx,ts),blo=bt[0]+dot(b.x,b.s,tx,ts),bhi=bt[1]+dot(b.x,b.s,tx,ts);
  const tangent=(Math.max(alo,blo)+Math.min(ahi,bhi))/2;
  const x=nx*normal+tx*tangent,s=ns*normal+ts*tangent;
  const rxA=x-a.x,rsA=s-a.s,rxB=x-b.x,rsB=s-b.s;
  const rvx=b.vx+b.spin*rsB-a.vx-a.spin*rsA,rvs=b.vs-b.spin*rxB-a.vs+a.spin*rxA;
  const normalSpeed=dot(rvx,rvs,nx,ns),leverA=rsA*nx-rxA*ns,leverB=rsB*nx-rxB*ns;
  const denominator=ia+ib+leverA**2/inertiaA+leverB**2/inertiaB;
  const impulse=Math.max(0,-(1+restitution)*normalSpeed/denominator);
  const tangentA=rsA*tx-rxA*ts,tangentB=rsB*tx-rxB*ts;
  const tangentSpeed=dot(rvx,rvs,tx,ts)+impulse*(leverA*tangentA/inertiaA+leverB*tangentB/inertiaB);
  const friction=clamp(-tangentSpeed/(ia+ib+tangentA**2/inertiaA+tangentB**2/inertiaB),-impulse*.35,impulse*.35);
  const jx=nx*impulse+tx*friction,js=ns*impulse+ts*friction;
  a.vx-=jx*ia;a.vs-=js*ia;b.vx+=jx*ib;b.vs+=js*ib;
  a.spin-=(rsA*jx-rxA*js)/inertiaA;b.spin+=(rsB*jx-rxB*js)/inertiaB;
  const correction=Math.max(0,penetration-.001)*.9/(ia+ib);
  a.x-=nx*correction*ia;a.s-=ns*correction*ia;b.x+=nx*correction*ib;b.s+=ns*correction*ib;
  return {a:a.id,b:b.id,x,s,nx,ns,speed:Math.max(0,-normalSpeed),impulse,material:'metal'};
}

/** Minimum body clearance over a translation step, using the same oriented hulls as contacts. */
export function sweptClearance(a: Body2D, b: Body2D): number {
  const pa = shape(a).points;
  const oldX = b.oldX - a.oldX, oldS = b.oldS - a.oldS, x = b.x - a.x, s = b.s - a.s;
  const points = shape(b).points.flatMap(([px, ps]): Point[] => [[px + oldX, ps + oldS], [px + x, ps + s]]);
  points.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (p: Point, q: Point, r: Point) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const half = (source: Point[]) => {
    const out: Point[] = [];
    for (const p of source) { while(out.length > 1 && cross(out[out.length-2],out[out.length-1],p) <= 0) out.pop(); out.push(p); }
    out.pop(); return out;
  };
  const pb = [...half(points), ...half([...points].reverse())];
  if (!normalAxes(pa, pb).some(([nx, ns]) => { const aa=project(pa,nx,ns),bb=project(pb,nx,ns); return aa[1]<bb[0] || bb[1]<aa[0]; })) return 0;
  let squared = Infinity;
  for (const [vertices, edges] of [[pa,pb],[pb,pa]]) for (const p of vertices) for (let i=0;i<edges.length;i++) {
    const q=edges[i],r=edges[(i+1)%edges.length],dx=r[0]-q[0],ds=r[1]-q[1];
    const t=clamp(((p[0]-q[0])*dx+(p[1]-q[1])*ds)/(dx*dx+ds*ds || 1),0,1);
    squared=Math.min(squared,(p[0]-q[0]-dx*t)**2+(p[1]-q[1]-ds*t)**2);
  }
  return Math.sqrt(squared);
}
