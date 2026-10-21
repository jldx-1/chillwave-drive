import * as THREE from 'three';

type Profile = ReadonlyArray<readonly [number, number]>;
/** Smooth scalar profiles keep shoulders continuous across the bonnet, doors and rear quarters. */
function profile(points: Profile, z: number): number {
  let i = 0;
  while (i < points.length - 2 && z > points[i + 1][0]) i++;
  const a = points[i], b = points[i + 1], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 2)];
  const length = b[0] - a[0], t = THREE.MathUtils.clamp((z - a[0]) / length, 0, 1);
  const ma = (b[1] - before[1]) / (b[0] - before[0]), mb = (after[1] - a[1]) / (after[0] - a[0]);
  return (2*t*t*t-3*t*t+1)*a[1]+(t*t*t-2*t*t+t)*length*ma+(-2*t*t*t+3*t*t)*b[1]+(t*t*t-t*t)*length*mb;
}
const belt: Profile = [[-2.49,1.025],[-2.25,1.105],[-1.25,1.205],[-.85,1.225],[.6,1.238],[1.65,1.232],[2.18,1.205],[2.48,1.12]];
const breadth: Profile = [[-2.49,.76],[-2.35,.89],[-2.05,.978],[-1.5,1.005],[-.6,.99],[.4,.987],[1.5,1.012],[2.15,.968],[2.48,.805]];
const crown: Profile = [[-1.16,1.22],[-.93,1.453],[-.56,1.738],[-.28,1.786],[.8,1.795],[1.6,1.772],[1.94,1.693],[2.22,1.505],[2.39,1.231]];
export const policeBelt = (z: number) => profile(belt,z);
export const policeRoofHeight = (z: number) => profile(crown,z);
export function policeSkinX(y: number,z: number): number {
  const height=(y-.4)/.8;
  const tuck=.067*Math.pow((height-.69)/.85,2);
  const flare=.014*(Math.exp(-Math.pow((z+1.5)/.42,2))+Math.exp(-Math.pow((z-1.51)/.42,2)))*Math.exp(-Math.pow((y-.83)/.24,2));
  return profile(breadth,z)-tuck+flare;
}
export function policeCabinX(y: number,z: number): number {
  const t=THREE.MathUtils.clamp((y-1.225)/.56,0,1);
  return .976-.178*t+.012*Math.sin(t*Math.PI)-.035*Math.pow(Math.max(0,z-1.6)/.8,2);
}
/** Indexed curved surface. UVs remain continuous so lettering follows the actual coachwork. */
export function policePatch(sample:(u:number,v:number)=>number[],columns=32,rows=12):THREE.BufferGeometry {
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const u=i/columns,v=j/rows;p.push(...sample(u,v));uv.push(u,v);
    if(i<columns&&j<rows){const a=j*(columns+1)+i;indices.push(a,a+1,a+columns+1,a+1,a+columns+2,a+columns+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function policeLowerSide(side:number):THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const z=-2.49+4.97*u;
    let bottom=.355;
    for(const center of [-1.5,1.51]){const d=z-center;if(Math.abs(d)<.454)bottom=Math.max(bottom,.405+Math.sqrt(.454*.454-d*d));}
    const y=THREE.MathUtils.lerp(bottom,policeBelt(z),v);
    const x=policeSkinX(y,z);
    const wrapped=THREE.MathUtils.clamp(z,policeFrontZ(x,y),policeRearZ(x,y));
    return [side*x,y,wrapped];
  },180,12);
}
export function policeHood():THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const cross=u*2-1,edge=1-cross*cross,noseY=1.046+.065*cross*cross;
    const noseX=cross*(.955-.066*Math.pow((noseY-.7)/.54,2));
    const z=THREE.MathUtils.lerp(policeFrontZ(noseX,noseY),-1.13,v);
    const blend=THREE.MathUtils.smoothstep(v,0,.3);
    const x=THREE.MathUtils.lerp(noseX,cross*policeSkinX(policeBelt(z),z),blend);
    const crease=.006*Math.exp(-Math.pow((Math.abs(cross)-.61)/.055,2))*Math.sin(v*Math.PI);
    const y=THREE.MathUtils.lerp(noseY,policeBelt(z)+edge*.038,blend)+crease;
    return[x,y,z];
  },40,32);
}
export function policeCabinSide(side:number):THREE.BufferGeometry {
  // Cut real apertures rather than laying transparent glass over opaque white panels.
  const shape=new THREE.Shape();
  for(let i=0;i<=80;i++){const z=-1.16+3.55*i/80;i?shape.lineTo(z,policeBelt(z)):shape.moveTo(z,policeBelt(z));}
  for(let i=80;i>=0;i--){const z=-1.16+3.55*i/80;shape.lineTo(z,policeRoofHeight(z));}
  shape.closePath();
  for(const polygon of [
    [[-1.035,1.283],[.34,1.283],[.34,1.726],[-.51,1.703]],
    [[.47,1.283],[1.46,1.283],[1.33,1.715],[.47,1.728]],
    [[1.62,1.285],[2.255,1.279],[2.10,1.565],[1.49,1.708]]
  ]){
    const hole=new THREE.Path();polygon.forEach(([z,y],i)=>i?hole.lineTo(z,y):hole.moveTo(z,y));hole.closePath();shape.holes.push(hole);
  }
  const g=new THREE.ShapeGeometry(shape),pos=g.getAttribute('position');
  for(let i=0;i<pos.count;i++){const z=pos.getX(i),y=pos.getY(i);pos.setXYZ(i,side*policeCabinX(y,z),y,z);}
  g.computeVertexNormals();return g;
}
export function policeRoof():THREE.BufferGeometry {
  // A grid aligned to glazing boundaries leaves the windscreen and rear glass genuinely open.
  const us=[...new Set([...Array.from({length:29},(_,i)=>i/28),.029,.971])].sort((a,b)=>a-b);
  const edges=[-1.115,-.545,1.985,2.355].map(z=>(z+1.16)/3.55);
  const vs=[...new Set([...Array.from({length:73},(_,i)=>i/72),...edges])].sort((a,b)=>a-b);
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const v of vs)for(const u of us){const z=-1.16+3.55*v,y=policeRoofHeight(z),cross=u*2-1;p.push(cross*policeCabinX(y,z),y+.043*(1-cross*cross),z);uv.push(u,v);}
  for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
    const u=(us[i]+us[i+1])/2,v=(vs[j]+vs[j+1])/2;
    if(u>.029&&u<.971&&((v>edges[0]&&v<edges[1])||(v>edges[2]&&v<edges[3])))continue;
    const a=j*us.length+i;indices.push(a,a+1,a+us.length,a+1,a+us.length+1,a+us.length);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** A small corner radius avoids hard rectangular window outlines. */
export function policeSidePanel(side:number,corners:number[][],glass=false):THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const radius=glass?.065:0;
    const end=v<radius?(radius-v)/radius:v>1-radius?(v-(1-radius))/radius:0;
    const inset=radius*(1-Math.sqrt(Math.max(0,1-end*end)));
    const a=THREE.MathUtils.lerp(inset,1-inset,u);
    const low=corners[0].map((n,i)=>THREE.MathUtils.lerp(n,corners[1][i],a));
    const high=corners[3].map((n,i)=>THREE.MathUtils.lerp(n,corners[2][i],a));
    const z=THREE.MathUtils.lerp(low[0],high[0],v),y=THREE.MathUtils.lerp(low[1],high[1],v);
    return[side*((glass?policeCabinX(y,z):policeSkinX(y,z))+.0035),y,z];
  },32,glass?8:4);
}
export function policeWindshield(rear=false):THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const cross=(u*2-1)*.942,z=rear?THREE.MathUtils.lerp(2.355,1.985,v):THREE.MathUtils.lerp(-1.115,-.545,v);
    const y=policeRoofHeight(z),x=cross*policeCabinX(y,z);
    return[x,y+.043*(1-cross*cross)+.004,z];
  },40,24);
}
/** Fascia patches wrap around the corners rather than sitting on a flat bumper box. */
export const policeFrontZ=(x:number,y:number)=>-2.505+.31*Math.pow(Math.abs(x)/.99,4)+.018*Math.pow((y-.8)/.5,2);
export const policeRearZ=(x:number,y:number)=>2.498-.235*Math.pow(Math.abs(x)/.99,4)-.028*Math.pow((y-.8)/.6,2);
export function policeFascia(rear=false):THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const cross=u*2-1,top=rear?1.133+.063*cross*cross:1.046+.065*cross*cross;
    const y=THREE.MathUtils.lerp(.355,top,v),width=.955-.066*Math.pow((y-.7)/.54,2),x=cross*width;
    return[x,y,(rear?policeRearZ:policeFrontZ)(x,y)];
  },40,18);
}
/** Close the shoulder between the swept rear glass/roof and the rounded tailgate. */
export function policeTailShoulder():THREE.BufferGeometry {
  return policePatch((u,v)=>{
    const cross=u*2-1,roofY=policeRoofHeight(2.39),topX=cross*policeCabinX(roofY,2.39);
    const topY=roofY+.043*(1-cross*cross),bottomY=1.133+.063*cross*cross;
    const bottomX=cross*(.955-.066*Math.pow((bottomY-.7)/.54,2));
    const x=THREE.MathUtils.lerp(topX,bottomX,v),y=THREE.MathUtils.lerp(topY,bottomY,v)+.008*Math.sin(Math.PI*v)*(1-cross*cross);
    const z=THREE.MathUtils.lerp(2.39,policeRearZ(bottomX,bottomY),v);
    return[x,y,z];
  },40,12);
}
export function policeFacePanel(x:number,y:number,w:number,h:number,rear=false,radius=.04,offset=.005):THREE.BufferGeometry {
  const geometry=policePatch((u,v)=>{
    const e=Math.min(radius,h/2,w/2),dy=(v-.5)*h;
    const round=Math.max(0,Math.abs(dy)-(h/2-e));
    const inset=round===0?0:e-Math.sqrt(Math.max(0,e*e-round*round));
    const px=x+(u*2-1)*(w/2-inset),py=y+dy;
    return[px,py,(rear?policeRearZ:policeFrontZ)(px,py)+(rear?offset:-offset)];
  },20,6);
  if(!rear){const indices=geometry.getIndex()!;for(let i=0;i<indices.count;i+=3){const a=indices.getX(i);indices.setX(i,indices.getX(i+2));indices.setX(i+2,a);}geometry.computeVertexNormals();}
  return geometry;
}
