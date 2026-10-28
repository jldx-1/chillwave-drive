/** Reference-sheet reconstruction in metres. -Z is the nose; no image planes are used. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CyberVehicleSpec } from './cyber-vehicles';

export type VehicleSurface='paint'|'livery'|'caliper'|'rotor'|'trim'|'carbon'|'metal'|'rubber'|'glass'|'lens'|'head'|'brake'|'turn'|'reverse'|'red'|'blue'|'amber'|'accent'|'interior';
export interface VehicleParts {
  readonly spec:CyberVehicleSpec; readonly group:THREE.Group;
  add(role:VehicleSurface,g:THREE.BufferGeometry,side?:string):void;
  shape(role:VehicleSurface,g:THREE.BufferGeometry,x:number,y:number,z:number,sx?:number,sy?:number,sz?:number,rx?:number,ry?:number,rz?:number,side?:string):void;
  box(role:VehicleSurface,x:number,y:number,z:number,w:number,h:number,d:number,rx?:number,ry?:number,rz?:number,side?:string):void;
  line(role:VehicleSurface,a:readonly number[],b:readonly number[],width:number,depth?:number,side?:string):void;
  branch(group:THREE.Group):VehicleParts; finish():void;
}
type Section=readonly [z:number,width:number,deck:number];
interface Design { sections:readonly Section[]; sill:number; cabin:readonly [start:number,roofStart:number,roofEnd:number,end:number,base:number,roof:number,width:number]; type:'coupe'|'sedan'|'suv'|'taxi'|'van'|'bus'|'cab'; wing?:number; }
/** Individual plan/side profiles; the sheet names differ, so gameplay identities remain stable. */
const designs:Record<string,Design>={
  nebula:{sections:[[-1,.77,.51],[-.85,.94,.62],[-.60,1,.69],[-.3,.89,.72],[.15,.87,.75],[.6,1,.81],[.86,.97,.77],[1,.85,.69]],sill:.24,cabin:[-1.15,-.43,.36,1.36,.73,1.24,.81],type:'coupe',wing:.98},
  vortex:{sections:[[-1,.84,.58],[-.82,.98,.69],[-.6,1,.74],[-.3,.91,.77],[.2,.91,.79],[.62,1,.84],[.9,.95,.8],[1,.89,.73]],sill:.29,cabin:[-1.32,-.54,.55,1.62,.77,1.33,.87],type:'sedan',wing:1.05},
  phantom:{sections:[[-1,.73,.51],[-.8,.94,.64],[-.61,1,.72],[-.28,.88,.74],[.3,.88,.76],[.62,1,.82],[.89,.94,.77],[1,.84,.68]],sill:.27,cabin:[-1.3,-.48,.38,1.6,.74,1.29,.8],type:'coupe'},
  vector:{sections:[[-1,.78,.4],[-.84,.96,.52],[-.62,1,.72],[-.2,.79,.62],[.24,.82,.64],[.62,1,.79],[.86,.99,.72],[1,.87,.6]],sill:.21,cabin:[-1.27,-.5,.28,1.27,.63,1.11,.72],type:'coupe',wing:.96},
  aurora:{sections:[[-1,.82,.63],[-.84,.95,.75],[-.62,1,.8],[-.24,.94,.82],[.35,.94,.84],[.64,1,.87],[.89,.96,.8],[1,.88,.72]],sill:.29,cabin:[-1.43,-.59,.68,1.93,.82,1.44,.88],type:'sedan'},
  lumen:{sections:[[-1,.84,.63],[-.8,.97,.75],[-.61,1,.78],[-.2,.97,.84],[.62,1,.87],[.85,.96,.85],[1,.88,.78]],sill:.29,cabin:[-1.36,-.56,.85,1.91,.83,1.47,.83],type:'sedan'},
  sentinel:{sections:[[-1,.9,1.05],[-.8,.99,1.16],[-.6,1,1.19],[-.2,.97,1.18],[.6,1,1.21],[.89,.97,1.18],[1,.93,1.12]],sill:.4,cabin:[-1.4,-.62,1.4,2.26,1.18,1.85,.99],type:'suv'},
  aegis:{sections:[[-1,.89,1.12],[-.8,.99,1.22],[-.59,1,1.25],[-.1,.98,1.24],[.6,1,1.26],[.9,.97,1.22],[1,.92,1.16]],sill:.41,cabin:[-1.41,-.62,1.52,2.38,1.24,1.99,1],type:'suv'},
  nova:{sections:[[-1,.89,.99],[-.8,.99,1.13],[-.61,1,1.15],[-.23,.95,1.16],[.25,.96,1.14],[.61,1,1.18],[.9,.98,1.14],[1,.94,1.1]],sill:.4,cabin:[-1.48,-.62,.46,.99,1.15,1.83,.97],type:'suv'},
  mira:{sections:[[-1,.82,.78],[-.8,.96,.9],[-.62,1,.95],[-.1,.98,.99],[.63,1,.98],[.89,.97,.93],[1,.88,.86]],sill:.29,cabin:[-1.96,-1.03,1.22,2.12,.96,1.63,.91],type:'taxi'},
  pulse:{sections:[[-1,.86,1.08],[-.84,.98,1.2],[-.62,1,1.24],[.6,1,1.24],[.92,.99,1.24],[1,.93,1.2]],sill:.38,cabin:[-2.6,-1.91,2.35,2.68,1.22,2.42,.995],type:'van'},
  orbit:{sections:[[-1,.83,1.16],[-.92,.97,1.28],[-.63,1,1.31],[.7,1,1.31],[.94,.98,1.3],[1,.88,1.21]],sill:.43,cabin:[-5.1,-4.45,4.6,5.11,1.3,3.12,1.21],type:'bus'},
  barricade:{sections:[[-1,.9,1.7],[-.84,.99,1.79],[-.63,1,1.8],[.5,1,1.8],[1,.95,1.75]],sill:.53,cabin:[-3.08,-2.47,-.96,-.45,1.76,2.43,1.1],type:'cab'},
  cargo:{sections:[[-1,.88,1.44],[-.91,.99,1.51],[-.67,1,1.52],[-.4,.96,1.45],[1,.94,1.13]],sill:.52,cabin:[-3.88,-3.3,-2.04,-1.67,1.48,2.88,1.1],type:'cab'},
  titan:{sections:[[-1,.84,1.84],[-.94,.98,2.02],[-.8,1,2.06],[-.57,.98,1.95],[-.43,.86,1.22]],sill:.57,cabin:[-8.37,-7.56,-4.67,-3.92,1.97,3.81,1.15],type:'cab'},
};
function geometry(points:number[],indices:number[]):THREE.BufferGeometry {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(points.length/3*2),2));g.setIndex(indices);g.computeVertexNormals();const normal=g.getAttribute('normal');for(let i=0;i<normal.count;i++)if(normal.getX(i)===0&&normal.getY(i)===0&&normal.getZ(i)===0)normal.setXYZ(i,0,1,0);return g;
}
/** Monotone cubic prevents overshoot at body ends while removing polygonal profile kinks. */
function profile(sections:readonly Section[],z:number,column:1|2):number {
  let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;
  const a=sections[i],b=sections[i+1],span=b[0]-a[0],t=THREE.MathUtils.clamp((z-a[0])/span,0,1);
  const slope=(j:number)=>{if(j===0||j===sections.length-1)return 0;const left=(sections[j][column]-sections[j-1][column])/(sections[j][0]-sections[j-1][0]),right=(sections[j+1][column]-sections[j][column])/(sections[j+1][0]-sections[j][0]);return left*right<=0?0:2*left*right/(left+right);};
  return (2*t*t*t-3*t*t+1)*a[column]+(t*t*t-2*t*t+t)*span*slope(i)+(-2*t*t*t+3*t*t)*b[column]+(t*t*t-t*t)*span*slope(i+1);
}
function widthAt(p:VehicleParts,d:Design,z:number):number{return profile(d.sections,z/(p.spec.length/2),1)*p.spec.width/2;}
function deckAt(p:VehicleParts,d:Design,z:number):number{return profile(d.sections,z/(p.spec.length/2),2);}
function archHeight(p:VehicleParts,d:Design,z:number):number {
  const r=p.spec.wheelRadius+.052,cy=p.spec.wheelRadius+.012;let y=d.sill;
  for(const axle of p.spec.axles){const dz=Math.abs(z-axle);if(dz<r)y=Math.max(y,cy+Math.sqrt(r*r-dz*dz));}
  return y;
}
/** Open-bottom skin. The outer edge rises around each tire, leaving actual empty wheel wells. */
function shell(p:VehicleParts,d:Design,lod:number):void {
  const L=p.spec.length/2,from=d.sections[0][0]*L+.012,to=d.sections[d.sections.length-1][0]*L-.012;
  const n=lod===0?100:lod===1?56:24,zs=Array.from({length:n+1},(_,i)=>THREE.MathUtils.lerp(from,to,i/n));
  const r=p.spec.wheelRadius+.052,cy=p.spec.wheelRadius+.012;
  // Insert exact arch/sill intersection; no triangles bridge across the tire opening.
  for(const a of p.spec.axles)for(const sign of [-1,1]){const z=a+sign*Math.sqrt(r*r-(d.sill-cy)**2);if(z>from&&z<to)zs.push(z);}
  zs.sort((a,b)=>a-b);for(let i=zs.length-1;i>0;i--)if(zs[i]-zs[i-1]<1e-5)zs.splice(i,1);
  const ring=[[-1,0],[-1,.31],[-.985,.78],[-.92,1],[-.73,1],[-.43,1],[0,1],[.43,1],[.73,1],[.92,1],[.985,.78],[1,.31],[1,0]],vertices:number[]=[],idx:number[]=[];
  for(const z of zs){const w=widthAt(p,d,z),deck=deckAt(p,d,z),bottom=archHeight(p,d,z),top=Math.max(deck+.025,bottom+.055);
    for(const [x,t]of ring){const side=Math.abs(x),roof=side>.88?top:THREE.MathUtils.lerp(deck+.032,top,Math.max(0,(side-.43)/.49));const y=side>.98?THREE.MathUtils.lerp(bottom,roof,t):roof;vertices.push(x*w,y,z);}
  }
  for(let j=0;j<zs.length-1;j++)for(let k=0;k<ring.length-1;k++){if(p.spec.id==='nova'&&zs[j]>1.01&&k>=4&&k<8)continue;const a=j*ring.length+k,b=a+ring.length;idx.push(a,b,a+1,a+1,b,b+1);}
  p.add('paint',geometry(vertices,idx));
  // Narrow battery/chassis floor leaves the wheel wells empty, even from the underside.
  p.box(lod===2?'trim':'carbon',0,d.sill+.025,(from+to)/2,p.spec.width*.62,.09,to-from-.12);
  for(const side of [-1,1])for(const axle of p.spec.axles){if(axle<from||axle>to)continue;
    const points:number[]=[],indices:number[]=[],steps=lod===0?28:lod===1?18:10;
    const start=Math.asin(THREE.MathUtils.clamp((d.sill-cy)/r,-1,1));
    for(let i=0;i<=steps;i++){const a=start+(Math.PI-2*start)*i/steps;
      for(const offset of [0,.037]){const rr=r+offset,z=axle-Math.cos(a)*rr,w=widthAt(p,d,z);points.push(side*(w+.004+offset*.4),cy+Math.sin(a)*rr,z);}}
    for(let i=0;i<steps;i++){const a=i*2;if(side<0)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    p.add(d.type==='suv'||d.type==='cab'?'trim':'paint',geometry(points,indices));
  }
}
function round(p:VehicleParts,role:VehicleSurface,x:number,y:number,z:number,w:number,h:number,l:number,r=.035,lod=0):void {
  if(lod===2){p.box(role,x,y,z,w,h,l);return;}
  const g=new RoundedBoxGeometry(w,h,l,lod===0&&Math.min(w,h,l)>.18?2:1,Math.min(r,w*.4,h*.4,l*.4));p.shape(role,g,x,y,z);g.dispose();
}
/** A genuine recessed aperture with a beveled rim, dark back and internal vanes. */
function intake(p:VehicleParts,x:number,y:number,z:number,w:number,h:number,lod:number):void {
  const outer=new THREE.Shape(),points=[[-.5,-.36],[-.43,.45],[.43,.45],[.5,-.36],[.34,-.5],[-.34,-.5]];
  points.forEach(([a,b],i)=>i?outer.lineTo(a*w,b*h):outer.moveTo(a*w,b*h));outer.closePath();
  if(lod<2){const inner=new THREE.Path();[...points].reverse().forEach(([a,b],i)=>i?inner.lineTo(a*w*.83,b*h*.76):inner.moveTo(a*w*.83,b*h*.76));inner.closePath();outer.holes.push(inner);}
  const g=new THREE.ExtrudeGeometry(outer,{depth:.065,bevelEnabled:lod===0,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:1});p.shape(lod===2?'trim':'carbon',g,x,y,z);g.dispose();
  p.box('trim',x,y,z+.08,w*.87,h*.8,.025);
  if(lod===0)for(let i=0;i<3;i++)p.box('metal',x,y-h*.23+i*h*.23,z+.056,w*.76,.012,.015);
}
function canopyPoint(d:Design,z:number,u:number):[number,number,number] {
  const [start,rs,re,end,base,roof,width]=d.cabin;
  const lift=z<rs?THREE.MathUtils.smoothstep(z,start,rs):z>re?1-THREE.MathUtils.smoothstep(z,re,end):1;
  const taper=['bus','van','cab'].includes(d.type)?.04:d.type==='suv'?.12:.17;
  const half=width*(1-taper*lift),height=(roof-base)*lift;
  // Rounded roof shoulders with relatively upright glazing; the roof has a shallow crown.
  const a=Math.abs(u),rise=1-Math.pow(a,12),x=u*half;
  return [x,base+height*rise+.008*(1-a*a),z];
}
function path(p:VehicleParts,role:VehicleSurface,points:readonly (readonly number[])[],radius:number,lod:number):void {
  if(lod===2)return;
  const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),g=new THREE.TubeGeometry(curve,Math.max(2,points.length*3),radius,4,false);p.add(role,g);
}
function canopy(p:VehicleParts,d:Design,lod:number):void {
  const [start,rs,re,end]=d.cabin,n=lod===0?36:lod===1?20:10,m=lod===0?20:lod===1?12:8;
  // Separate surfaces for windscreen, roof, side glass and commercial rear panels.
  const surfaces=new Map<VehicleSurface,{v:number[];i:number[]}>();
  const breaks=[start,rs,re,end];
  for(let zone=0;zone<3;zone++)for(let j=0;j<n/2;j++)for(let k=0;k<m;k++){
    const z1=THREE.MathUtils.lerp(breaks[zone],breaks[zone+1],j/Math.ceil(n/2)),z2=THREE.MathUtils.lerp(breaks[zone],breaks[zone+1],(j+1)/Math.ceil(n/2)),u1=-1+2*k/m,u2=-1+2*(k+1)/m;
    const side=Math.abs((u1+u2)/2)>.77;
    let role:VehicleSurface=zone===1&&!side?'paint':'glass';
    if(d.type==='van'&&z1>-.48)role='paint';
    if(d.type==='suv'&&p.spec.id==='nova'&&zone===2)role='glass';
    const entry=surfaces.get(role)??{v:[],i:[]},a=entry.v.length/3;
    for(const [z,u]of [[z1,u1],[z2,u1],[z1,u2],[z2,u2]])entry.v.push(...canopyPoint(d,z,u));
    entry.i.push(a,a+1,a+2,a+2,a+1,a+3);surfaces.set(role,entry);
  }
  // Weld quads before normal computation, so a curved screen never looks tiled.
  for(const [role,{v,i}]of surfaces){const g=geometry(v,i);const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),sums=new Map<string,THREE.Vector3>();for(let j=0;j<pos.count;j++){const key=[pos.getX(j),pos.getY(j),pos.getZ(j)].map(v=>v.toFixed(5)).join(),sum=sums.get(key)??new THREE.Vector3();sum.add(new THREE.Vector3().fromBufferAttribute(normal,j));sums.set(key,sum);}for(let j=0;j<pos.count;j++){const key=[pos.getX(j),pos.getY(j),pos.getZ(j)].map(v=>v.toFixed(5)).join(),n=sums.get(key)!.normalize();normal.setXYZ(j,n.x,n.y,n.z);}p.add(role,g);}
  if(lod===2)return;
  for(const side of [-1,1]){
    for(const z of [rs,re]){const points=Array.from({length:9},(_,i)=>canopyPoint(d,z,side*(.73+i*.27/8)));path(p,'paint',points,.025,lod);}
    const border=Array.from({length:19},(_,i)=>canopyPoint(d,THREE.MathUtils.lerp(start,end,i/18),side*.997));path(p,'metal',border,.012,lod);
    const upper=Array.from({length:13},(_,i)=>canopyPoint(d,THREE.MathUtils.lerp(rs,re,i/12),side*.78));path(p,'paint',upper,.025,lod);
    const pillars=d.type==='bus'?Array.from({length:6},(_,i)=>-3.5+i*1.4):d.type==='coupe'?[]:d.type==='van'?[-.57]:[rs+(re-rs)*.49];
    for(const z of pillars){path(p,'trim',Array.from({length:7},(_,i)=>canopyPoint(d,z,side*(.76+.24*i/6))),.033,lod);}
    if(d.type==='suv'){const rail=[rs+.1,rs+.45,re-.1].map(z=>{const v=canopyPoint(d,z,side*.78);return [v[0],v[1]+.04,v[2]];});path(p,'trim',rail,.026,lod);for(const z of [rs+.1,re-.1]){const v=canopyPoint(d,z,side*.78);p.line('metal',v,[v[0],v[1]+.04,z],.024);}}
  }
  // Roof center and windshield borders remain modeled and non-emissive.
  for(const z of [rs,re])path(p,'paint',Array.from({length:17},(_,i)=>canopyPoint(d,z,-.8+i*.1)),.023,lod);
}
function aero(p:VehicleParts,d:Design,lod:number):void {
  const s=p.spec,L=s.length/2,w=s.width/2,front=deckAt(p,d,-L),rear=deckAt(p,d,L);
  // Front and rear fascias have separate upper bridges and lower sculpted splitters.
  for(const z of [-L+.035,L-.035]){
    const y=z<0?front:rear,ww=widthAt(p,d,z)*1.94;
    round(p,'paint',0,y-.055,z,ww,.12,.1,.035,lod);
    round(p,lod===2?'trim':'carbon',0,d.sill+.035,z,ww*.99,.09,.14,.025,lod);
    for(const side of [-1,1])p.line('paint',[side*ww*.48,d.sill+.07,z],[side*ww*.44,y-.09,z],.075,.1);
  }
  if(lod===2)return;
  const low=d.type==='coupe'||d.type==='sedan',fy=(front+d.sill)*.5;
  intake(p,0,fy,-L-.018,s.width*(low?.48:.56),Math.max(.12,front-d.sill-.17),lod);
  for(const side of [-1,1]){
    if(low)intake(p,side*w*.73,fy,-L-.014,w*.33,Math.max(.15,front-d.sill-.13),lod);
    const z1=s.axles[0]+s.wheelRadius+.12,z2=s.axles[s.axles.length-1]-s.wheelRadius-.1;
    if(z2>z1){const pts=Array.from({length:9},(_,i)=>{const z=THREE.MathUtils.lerp(z1,z2,i/8);return [side*(widthAt(p,d,z)+.012),d.sill+.04+Math.sin(i*Math.PI/8)*.035,z];});path(p,'carbon',pts,.055,lod);path(p,'accent',pts.map(v=>[v[0]+side*.008,v[1]-.026,v[2]]),.008,lod);}
    // Hood extraction vents lie on the curved hood, not on the windscreen.
    if(low){const z=(d.cabin[0]-L)*.5,y=deckAt(p,d,z)+.025;round(p,'carbon',side*w*.42,y,z,w*.23,.026,.46,.012,lod);if(lod===0)for(let i=0;i<5;i++)p.box('trim',side*w*.42,y+.018,z-.17+i*.078,w*.21,.015,.019);}
    if(d.type==='coupe'){
      const x=side*(widthAt(p,d,.65)+.012);p.box('carbon',x,.55,.65,.035,.25,.54,0,side*.14);
      path(p,'paint',[[x,.43,.37],[x+side*.02,.64,.45],[x-side*.055,.78,.91]],.038,lod);
    }
  }
  // Rear diffuser blades are a shaped undertray with independent aero strakes.
  p.box('carbon',0,d.sill+.1,L-.045,s.width*.66,.18,.16);
  for(let i=-3;i<=3;i++)p.box('trim',i*s.width*.105,d.sill+.03,L-.055,.023,.2,.22,-.16);
  for(const side of [-1,1]){
    const g=new THREE.TorusGeometry(low?.073:.065,.014,6,lod===0?20:12);p.shape('metal',g,side*(s.id==='nebula'?.11:w*.65),d.sill+.11,L+.028);g.dispose();
    p.shape('trim',new THREE.CircleGeometry(low?.057:.05,12),side*(s.id==='nebula'?.11:w*.65),d.sill+.11,L+.025);
  }
  if(d.wing){const z=L-.34,y=d.wing;
    for(const side of [-1,1]){p.line('metal',[side*w*.48,rear,z],[side*w*.48,y,z+.04],.035,.09);round(p,'paint',side*w*.86,y+.055,z,.035,.15,.28,.01,lod);}
    // Thin cambered airfoil, rather than a rectangular plank.
    const shape=new THREE.Shape();shape.moveTo(-.19,0);shape.quadraticCurveTo(0,.052,.2,.015);shape.lineTo(.2,-.012);shape.quadraticCurveTo(0,.012,-.19,-.012);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:w*1.73,bevelEnabled:false,curveSegments:8});g.rotateY(Math.PI/2);g.translate(-w*.865,y,z);p.add('carbon',g);
  }
}
const lettering:Record<string,string[]>={P:['111','101','111','100','100'],O:['111','101','101','101','111'],L:['100','100','100','100','111'],I:['111','010','010','010','111'],C:['111','100','100','100','111'],E:['111','100','110','100','111'],'9':['111','101','111','001','111'],'1':['010','110','010','010','111'],T:['111','010','010','010','010'],A:['010','101','111','101','101'],X:['101','101','010','101','101']};
function label(p:VehicleParts,text:string,side:number,y:number,z:number,size:number,role:VehicleSurface='livery'):void {
  const length=text.length*size*.8,verts:number[]=[],idx:number[]=[],d=designs[p.spec.id];
  for(let letter=0;letter<text.length;letter++)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(lettering[text[letter]]?.[row][col]==='1'){
    const yy=y+(2-row)*size/5,zz=z+side*(length/2-letter*size*.8-col*size/5),a=verts.length/3;
    for(const [dy,dz]of [[-.09,-.09],[.09,-.09],[-.09,.09],[.09,.09]])verts.push(side*(widthAt(p,d,zz+dz*size)+.028),yy+dy*size,zz+dz*size);
    if(side<0)idx.push(a,a+2,a+1,a+1,a+2,a+3);else idx.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  p.add(role,geometry(verts,idx));
}
function appointments(p:VehicleParts,d:Design,lod:number):void {
  if(lod===2)return;
  const s=p.spec,w=s.width/2,L=s.length/2,base=d.cabin[4];
  const doorZ=d.type==='coupe'?[-.95,.89]:d.type==='van'?[-1.9,-.55,1.8]:d.type==='bus'?[-3.3,-1.6,1.7,3.3]:[-.95,.18,1.21];
  for(const side of [-1,1]){
    for(const z of doorZ){if(z<d.cabin[0]||z>d.cabin[3])continue;const pts=Array.from({length:8},(_,i)=>{const y=THREE.MathUtils.lerp(d.sill+.13,base-.015,i/7),x=widthAt(p,d,z)*(.995-.012*Math.sin(i*Math.PI/7));return [side*(x+.004),y,z];});path(p,'trim',pts,.006,lod);}
    for(const z of (d.type==='coupe'?[.35]:[-.15,.94])){if(z>d.cabin[3])continue;round(p,'metal',side*(widthAt(p,d,z)+.01),base-.09,z,.023,.025,.17,.008,lod);}
    const mz=d.cabin[0]+.65,my=base+.2;
    p.line('trim',[side*w*.84,my-.05,mz],[side*(w+.04),my,mz],.032);
    round(p,'paint',side*(w+.035),my,mz,.15,.085,.23,.03,lod);
    p.box('metal',side*(w+.04),my,mz+.117,.1,.055,.008);
  }
  if(lod===0){
    for(const axle of s.axles){p.shape('metal',new THREE.CylinderGeometry(.028,.028,s.width*.65,8),0,s.wheelRadius+.02,axle,1,1,1,0,0,Math.PI/2);for(const side of [-1,1]){p.line('metal',[side*w*.46,d.sill+.09,axle-.18],[side*w*.87,s.wheelRadius,axle],.035);p.line('metal',[side*w*.46,d.sill+.09,axle+.18],[side*w*.87,s.wheelRadius,axle],.035);}}
    for(let i=0;i<5;i++)round(p,'trim',0,d.sill-.027,-L*.54+i*L*.24,s.width*.56,.035,L*.2,.01,lod);
    p.box('metal',0,Math.max(.48,deckAt(p,d,L)-.19),L+.035,.32,.095,.017);
  }
  if(s.emergency){
    if(s.id!=='phantom'){
      round(p,'trim',0,s.height-.065,0,1.17,.065,.29,.025,lod);
      if(lod===0)for(const side of [-1,1])for(let i=0;i<6;i++)p.box(s.emergency==='rescue'?(side<0?'amber':'blue'):(side<0?'red':'blue'),side*(.1+i*.077),s.height-.012,-.115,.038,.027,.015);
      if(s.emergency==='police')for(const side of [-1,1]){
        // Contrasting doors, laid over the skin with polygonal facets.
        const points=[[-.88,.51],[-.91,base-.04],[.09,base-.04],[.15,.48]],verts:number[]=[];for(const [z,y]of points)verts.push(side*(widthAt(p,d,z)+.012),y,z);
        p.add('livery',geometry(verts,side<0?[0,2,1,0,3,2]:[0,1,2,0,2,3]));
        if(lod===0){label(p,'POLICE',side,base-.22,-.35,.15,'trim');label(p,'911',side,base-.22,L-.27,.1);}
      }
    }
    if(['vortex','sentinel','barricade'].includes(s.id)){
      for(const side of [-1,1])p.line('metal',[side*w*.45,d.sill+.06,-L-.057],[side*w*.45,Math.min(1.14,deckAt(p,d,-L)+.06),-L-.057],.052,.05);
      p.line('metal',[-w*.48,d.sill+.14,-L-.063],[w*.48,d.sill+.14,-L-.063],.065,.045);
    }
  }
}
function rearDoors(p:VehicleParts,z:number,width:number,base:number,top:number,lod:number):void {
  round(p,'trim',0,(base+top)/2,z,width*.95,top-base,.04,.04,lod);
  for(const side of [-1,1]){round(p,'paint',side*width*.231,(base+top)/2,z+.025,width*.45,top-base-.08,.035,.02,lod);p.line('metal',[side*width*.32,base+.15,z+.05],[side*width*.32,top-.15,z+.05],.022);if(lod===0)for(const y of [base+.24,top-.24])p.box('metal',side*width*.45,y,z+.049,.08,.1,.017);}
}
function utility(p:VehicleParts,d:Design,lod:number):void {
  const s=p.spec,w=s.width/2,L=s.length/2;
  switch(s.id){
    case 'nova':{
      // Open load bed: the body skin does not span its cavity.
      round(p,'trim',0,.84,1.92,1.66,.09,1.54,.015,lod);
      for(const side of [-1,1]){round(p,'paint',side*.94,1.13,1.96,.21,.39,1.6,.04,lod);path(p,'metal',[[side*.86,1.34,1.24],[side*.86,1.34,2.63]],.025,lod);const mount=canopyPoint(d,.42,side*.82);p.line('metal',mount,[side*.87,1.35,1.38],.045);}
      round(p,'paint',0,1.12,L-.07,1.89,.4,.12,.025,lod);
      if(lod===0){for(let i=0;i<9;i++)p.box('metal',(i-4)*.17,.891,1.94,.018,.016,1.38);round(p,'carbon',0,1.05,1.4,1.4,.25,.32,.035,lod);}
      break;
    }
    case 'mira':round(p,'trim',0,1.68,.2,.68,.14,.43,.05,lod);p.box('amber',0,1.69,.424,.58,.07,.015);if(lod===0)for(const side of [-1,1])label(p,'TAXI',side,.84,.4,.17);break;
    case 'pulse':rearDoors(p,L+.004,s.width,1.02,2.29,lod);if(lod<2)for(const side of [-1,1]){p.line('metal',[side*(w+.012),1.59,-.32],[side*(w+.012),1.59,2.33],.016);path(p,'trim',[[side*(w*.96),2.28,-.3],[side*w,1.03,-.3],[side*w,1.03,2.25]],.012,lod);}break;
    case 'cargo':round(p,'paint',0,2.14,1.19,2.37,2.11,5.48,.08,lod);rearDoors(p,L-.015,2.35,1.24,3.08,lod);if(lod<2)for(const side of [-1,1])for(let z=-1.4;z<3.9;z+=.75)p.box('metal',side*1.19,2.16,z,.02,1.94,.035);break;
    case 'barricade':round(p,'paint',0,1.79,1.29,2.35,1.37,3.77,.08,lod);rearDoors(p,L-.008,2.32,1.14,2.39,lod);if(lod<2)for(const side of [-1,1])for(let z=-.3;z<3;z+=.7)round(p,'carbon',side*1.18,1.73,z,.055,.83,.53,.015,lod);break;
    case 'orbit':{
      round(p,'paint',0,2.12,L-.08,2.35,1.76,.13,.07,lod);round(p,'glass',0,2.35,L+.003,1.94,1.03,.025,.03,lod);
      if(lod<2){p.box('amber',0,2.86,-L-.015,1.39,.14,.025);round(p,'trim',0,3.18,.5,1.31,.16,2.24,.04,lod);
        for(const z of [-2.6,2.6]){for(const side of [-1,1])p.line('metal',[side*1.2,1.2,z],[side*1.2,2.7,z],.025);p.line('trim',[1.216,1.3,z-.57],[1.216,1.3,z+.57],.035);}
        if(lod===0)for(let z=-3.7;z<4.2;z+=1.05)for(const side of [-1,1]){round(p,'trim',side*.8,1.46,z,.48,.14,.53,.04,lod);round(p,'interior',side*.8,1.76,z+.2,.47,.52,.11,.035,lod);p.line('metal',[side*.96,1.4,z],[side*.96,2.72,z],.019);}
      }break;
    }
    case 'sentinel':case 'aegis':for(const side of [-1,1])round(p,'paint',side*w*.85,1.15,L-.055,.22,.67,.15,.035,lod);if(lod<2){round(p,'carbon',0,1.43,L+.012,1.59,.44,.035,.03,lod);p.line('metal',[-.65,1.18,L+.04],[.65,1.18,L+.04],.025);for(const side of [-1,1]){round(p,'trim',side*(w-.02),.43,.3,.16,.12,2.43,.025,lod);p.shape('trim',new THREE.CylinderGeometry(.105,.14,.09,12),side*.55,s.height+.02,.5);}}break;
    case 'titan':{
      const trailer=new THREE.Group();trailer.name='TrailerPivot';trailer.position.z=-2.3;p.group.add(trailer);const q=p.branch(trailer);
      round(q,'paint',0,2.45,5.35,2.46,2.96,10.7,.11,lod);q.box('trim',0,.82,5.1,1.85,.24,10.3);
      rearDoors(q,10.72,2.4,1.13,3.83,lod);
      if(lod<2)for(const side of [-1,1]){q.line('metal',[side*1.235,1.08,.18],[side*1.235,1.08,10.55],.025);for(let z=.35;z<10.6;z+=lod===0?.73:2.2){q.box('metal',side*1.237,2.44,z,.016,2.68,.023);q.box('amber',side*1.248,1.05,z,.015,.045,.1);}q.box('trim',side*.95,.55,.7,.14,.75,.13);}
      q.finish();if(lod<2){for(const side of [-1,1]){round(p,'carbon',side*1.09,1.15,-5.27,.13,.63,1.54,.035,lod);p.line('metal',[side*.86,1.48,-3.93],[side*.86,2.96,-4.3],.035);}round(p,'trim',0,3.83,-5.8,1.32,.13,1.66,.05,lod);}break;
    }
  }
  // Raised commercial cabs have proper running steps and door glazing.
  if(d.type==='cab'&&lod<2)for(const side of [-1,1]){const z=d.cabin[2]-.1;for(let i=0;i<2;i++)round(p,'metal',side*(w-.045),.65+i*.19,z,.25,.07,.45,.02,lod);}
}
export function referenceCoachwork(p:VehicleParts,lod:0|1|2):void {
  const authored=designs[p.spec.id],sections=authored.sections.map((v,i)=>[v[0],i===0?Math.max(.92,v[1]):i===authored.sections.length-1?Math.max(.97,v[1]):v[1],v[2]] as const);
  const d={...authored,sections};
  shell(p,d,lod);
  canopy(p,d,lod);aero(p,d,lod);utility(p,d,lod);appointments(p,d,lod);
  p.group.userData.referenceModel={version:2,body:'curved skin with open wheel wells',frame:'metres, +Y up, -Z forward',lod};
}
