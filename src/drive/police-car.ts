import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Offline authoring dimensions stay independent of the measured exported catalog.
export const POLICE_SOURCE_WHEEL_RADIUS = .405;
import { policeCabinSide, policeFacePanel, policeFascia, policeFrontZ, policeHood, policeLowerSide, policeRearZ, policeRoof, policeRoofHeight, policeSidePanel, policeSkinX, policeTailShoulder, policeWindshield } from './police-body';

/** Utility patrol SUV: metres, nose toward -Z. Mirrors extend beyond the collision body. */
type Lamp = 'head' | 'brake' | 'red' | 'blue';
export type PoliceLamps = Record<Lamp, THREE.Material>;
export interface PoliceCarRig { group: THREE.Group; wheels: THREE.Group[]; spins: THREE.Group[] }
type Surface = THREE.Material | Lamp;
interface Part { geometry: THREE.BufferGeometry; surface: Surface }
interface Assets { body: Part[]; wheel: Part[] }
const shared = new Set<THREE.BufferGeometry | THREE.Material>();
let assets: Assets | undefined;
export function isSharedPoliceResource(resource: THREE.BufferGeometry | THREE.Material): boolean { return shared.has(resource); }

/** One bounded cache for every patrol; retiring one car must not destroy another's buffers. */
function makeAssets(): Assets {
  const white = new THREE.MeshPhysicalMaterial({ color: '#f1f2ef', metalness: .22, roughness: .24, clearcoat: 1, clearcoatRoughness: .14, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: '#15191c', roughness: .68, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: '#252a2d', metalness: .8, roughness: .35 });
  const silver = new THREE.MeshStandardMaterial({ color: '#a8afb3', metalness: .95, roughness: .25 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#17191b', roughness: .93 });
  const tint = new THREE.MeshPhysicalMaterial({ color: '#111c22', metalness: .34, roughness: .12, clearcoat: 1, side: THREE.DoubleSide });
  const lens = new THREE.MeshPhysicalMaterial({ color: '#52616b', metalness: .35, roughness: .12, clearcoat: 1, side: THREE.DoubleSide });
  const amber = new THREE.MeshStandardMaterial({ color: '#df9b31', emissive: '#9a4a0a', emissiveIntensity: .3 });
  const green = new THREE.MeshStandardMaterial({ color: '#488361', roughness: .4, side: THREE.DoubleSide });
  const blueOval = new THREE.MeshStandardMaterial({ color: '#173147', metalness: .5, roughness: .22 });
  const sideLabel = label(1536, 256, ctx => {
    ctx.fillStyle = '#12171b'; ctx.font = 'italic 900 244px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 768, 224, 1510);
  });
  const service = label(768, 64, ctx => {
    ctx.fillStyle = '#20272b'; ctx.font = 'bold 42px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TO PROTECT & SERVE', 384, 49, 740);
  });
  const hybrid = label(256, 64, ctx => {
    ctx.fillStyle = '#333a3e'; ctx.font = 'italic bold 43px Arial, sans-serif'; ctx.fillText('HYBRID', 4, 49);
  });
  const plate = label(512, 256, ctx => {
    ctx.fillStyle = '#e0e3df'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#202b34'; ctx.textAlign = 'center';
    ctx.font = 'bold 35px Arial, sans-serif'; ctx.fillText('EXEMPT', 256, 52);
    ctx.font = 'bold 108px monospace'; ctx.fillText('P • 021', 256, 174);
    ctx.font = '26px Arial, sans-serif'; ctx.fillText('HIGHWAY PATROL', 256, 223);
  });
  const body = new Map<Surface, THREE.BufferGeometry[]>(), wheel = new Map<Surface, THREE.BufferGeometry[]>();
  let bucket = body;
  const put = (surface: Surface, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const list = bucket.get(surface) ?? []; list.push(g); bucket.set(surface, list);
  };
  const box = (m: Surface, x: number, y: number, z: number, w: number, h: number, d: number, radius = .02, rx = 0) =>
    put(m, new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), x, y, z, rx);
  const tube = (m: Surface, points: number[][], radius: number, segments = 16) =>
    put(m, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), segments, radius, 6, false));
  const cylinder = (m: Surface, x: number, y: number, z: number, r: number, depth: number, axis: 'x' | 'z' = 'x', segments = 24) =>
    put(m, new THREE.CylinderGeometry(r, r, depth, segments), x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);

  // Continuous crowned panels replace the old flat extrusion and rectangular cabin slab.
  for (const side of [-1,1]) { put(white,policeLowerSide(side)); put(white,policeCabinSide(side)); }
  put(white,policeHood());put(white,policeRoof());put(white,policeFascia());put(white,policeFascia(true));put(white,policeTailShoulder());
  box(trim, 0, .29, .05, 1.65, .18, 4.35, .06);
  const sidePanel=(m:Surface,s:number,corners:number[][],cabin=false)=>put(m,policeSidePanel(s,corners,cabin));
  const face=(m:Surface,x:number,y:number,w:number,h:number,rear=false,r=.04,offset=.008)=>put(m,policeFacePanel(x,y,w,h,rear,r,offset));
  for (const s of [-1,1]) {
    // Curved, softly radiused glazing follows the tapered cabin, leaving real white pillars.
    sidePanel(tint,s,[[-1.035,1.283],[.34,1.283],[.34,1.726],[-.51,1.703]],true);
    sidePanel(tint,s,[[.47,1.283],[1.46,1.283],[1.33,1.715],[.47,1.728]],true);
    sidePanel(tint,s,[[1.62,1.285],[2.255,1.279],[2.10,1.565],[1.49,1.708]],true);
    sidePanel(trim,s,[[-1.04,1.258],[2.265,1.258],[2.26,1.282],[-1.03,1.282]],true);
    sidePanel(trim,s,[[.34,1.27],[.47,1.27],[.47,1.742],[.34,1.742]],true);
    // Subtle door creases and handles lie on the curved side skin, not a flat decal plane.
    for(const z of [-1.02,.42,1.47])tube(trim,[.62,.81,1.02,1.222].map(y=>[s*(policeSkinX(y,z)+.002),y,z]),.0035,8);
    for(const z of [.2,1.27]) {const x=s*(policeSkinX(1.204,z)+.022);box(trim,x,1.204,z,.035,.045,.23,.018);box(steel,x+s*.013,1.213,z,.018,.019,.17,.008);}
    box(trim,s*1.039,1.31,-.94,.14,.047,.12);box(trim,s*1.09,1.365,-.94,.23,.125,.31,.055);
    box(lens,s*1.09,1.365,-.784,.17,.078,.008,.012);
    sidePanel(trim,s,[[-1.04,.353],[1.04,.353],[1.04,.524],[-1.04,.524]]);
    sidePanel(green,s,[[-1.04,.552],[1.04,.552],[1.04,.566],[-1.04,.566]]);
    const left=s<0?-1.02:2.17,right=s<0?2.17:-1.02;
    sidePanel(sideLabel,s,[[left,.883],[right,.883],[right,1.202],[left,1.202]]);
    const text=(m:THREE.Material,z:number,w:number,y:number,h:number)=>{
      const a=z+s*w/2,b=z-s*w/2;sidePanel(m,s,[[a,y-h/2],[b,y-h/2],[b,y+h/2],[a,y+h/2]]);
    };
    text(service,-1.58,.7,1.12,.056);text(hybrid,-.68,.33,.616,.046);
    // The cladding rolls over the swollen fenders; both openings remain genuinely hollow.
    for(const z of [-1.5,1.51]) {
      const positions:number[]=[],uv:number[]=[],indices:number[]=[];
      for(let i=0;i<=48;i++){const a=-.075+(Math.PI+.15)*i/48;
        for(const r of [.452,.514]){const y=.405+Math.sin(a)*r,sz=z+Math.cos(a)*r;positions.push(s*(policeSkinX(y,sz)+.013),y,sz);uv.push(i/48,r);}
        if(i<48){const a=i*2;if(s<0)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();put(trim,g);
      tube(trim,Array.from({length:49},(_,i)=>{const a=-.075+(Math.PI+.15)*i/48,y=.405+Math.sin(a)*.454,sz=z+Math.cos(a)*.454;return[s*(policeSkinX(y,sz)+.009),y,sz];}),.016,48);
    }
    for(const z of [.12,1.57])box(trim,s*.69,1.832,z,.09,.06,.18);
    tube(steel,[[s*.69,1.85,-.02],[s*.69,1.87,.2],[s*.69,1.86,1.5],[s*.69,1.82,1.72]],.017);
  }
  put(tint,policeWindshield());put(tint,policeWindshield(true));
  // Cowl and wipers sit along the lower edge of the gently convex windscreen.
  tube(trim,[[-.88,1.275,-1.112],[0,1.315,-1.112],[.88,1.275,-1.112]],.016,24);
  for(const x of [-.44,.29])tube(trim,[[x-.22,1.29,-1.101],[x+.24,1.302,-1.087]],.008,6);
  box(white,0,1.744,1.975,1.68,.054,.26,.026);
  box('brake',0,1.743,2.107,.48,.021,.013,.004);
  tube(trim,[.29,.07,-.16].map(x=>[x,policeRoofHeight(2.30)+.043*(1-Math.pow(x/.87,2))+.009,2.30]),.009,6);

  // Sculpted fascia: swept LED lamps and a broad mesh grille turn around the front corners.
  face(trim,0,.878,1.25,.326,false,.065);
  face(steel,0,1.05,1.29,.022,false,.009,.011);
  for(let row=0;row<5;row++)for(let col=0;col<18;col++){
    const x=(col-8.5)*.063+(row%2)*.0315,y=.758+row*.054;if(Math.abs(x)>.56)continue;
    put(steel,new THREE.RingGeometry(.022,.027,6),x,y,policeFrontZ(x,y)-.013,0,Math.PI);
  }
  cylinder(blueOval,0,.942,policeFrontZ(0,.942)-.017,.063,.014,'z');
  face(trim,0,.412,1.88,.182,false,.065,.014);
  face(trim,0,.589,1.0,.153,false,.028,.012);
  face(steel,0,.532,.58,.019,false,.007,.017);
  for(const s of [-1,1]) {
    face(lens,s*.798,.997,.442,.172,false,.045,.011);
    face('head',s*.796,.984,.335,.021,false,.008,.020);
    face(steel,s*.776,1.063,.341,.014,false,.006,.021);
    const x=s*.706,y=1.018,z=policeFrontZ(x,y)-.02;
    cylinder(silver,x,y,z,.048,.009,'z',24);cylinder('head',x,y,z-.007,.033,.008,'z',24);
    face(amber,s*.971,1.017,.049,.025,false,.007,.022);
    face(trim,s*.786,.682,.329,.132,false,.034,.013);
    face('head',s*.786,.702,.231,.021,false,.007,.022);
    face(lens,s*.786,.664,.231,.018,false,.005,.022);
    tube(steel,[[s*.635,.32,-2.43],[s*.635,.39,-2.65],[s*.635,.98,-2.66],[s*.635,1.13,-2.53],[s*.635,1.09,-2.46]],.035,28);
  }
  for(const y of [.53,.84])tube(steel,[[-.66,y,-2.66],[.66,y,-2.66]],.029,2);
  box(steel,0,.543,-2.685,.39,.109,.018,.008);
  // Driver-side round A-pillar spotlight.
  tube(trim,[[-.94,1.31,-1.03],[-1.1,1.43,-1.05]],.021,3);
  cylinder(trim,-1.105,1.45,-1.09,.075,.10,'z'); cylinder(lens,-1.105,1.45,-1.145,.058,.008,'z');

  // Rear quarters taper into a curved tailgate rather than a vertical cuboid wall.
  face(trim,0,.397,1.88,.215,true,.065,.015);
  face(steel,0,.507,1.47,.035,true,.013,.018);
  for(const s of [-1,1]) {
    face('brake',s*.885,1.073,.148,.278,true,.032,.013);
    face('brake',s*.744,1.159,.19,.073,true,.017,.016);
    face(lens,s*.887,.976,.095,.025,true,.006,.022);
    face('brake',s*.764,.404,.258,.023,true,.005,.026);
    tube(trim,[.585,.8,1.05,1.22].map(y=>[s*.81,y,policeRearZ(s*.81,y)+.004]),.0035,8);
  }
  face(trim,0,.812,.56,.286,true,.025,.009);
  face(plate,0,.808,.46,.202,true,.011,.016);
  cylinder(blueOval,0,1.115,policeRearZ(0,1.115)+.01,.053,.015,'z');
  face(sideLabel,0,1.016,.9,.085,true,.002,.014);
  cylinder(steel,-.62,.28,2.42,.047,.19,'z');

  // A low-profile bar with individual dark lenses while patrolling, red/blue when alerted.
  for(const s of [-1,1])box(trim,s*.45,1.846,-.24,.10,.06,.14);
  box(steel,0,1.889,-.24,1.39,.045,.253,.02);
  box(lens,0,1.922,-.24,1.37,.042,.245,.018);
  for(let i=0;i<10;i++) {
    const x=(i-4.5)*.13,m: Lamp=i<5?'red':'blue';
    box(m,x,1.924,-.366,.10,.028,.012,.004);box(m,x,1.924,-.114,.10,.028,.012,.004);
  }
  for(const s of [-1,1]) { face(s<0?'red':'blue',s*.31,.872,.13,.032,false,.005,.022); box(s<0?'red':'blue',s*.49,1.55,2.20,.1,.03,.015,.004); }
  cylinder(trim,.32,1.837,1.52,.045,.035);
  tube(trim,[[.32,1.83,1.52],[.32,2.02,1.57]],.006,3);

  // Black steel wheels with actual ventilation holes, a silver centre cap and five lug nuts.
  bucket=wheel;
  put(rubber,new THREE.TorusGeometry(.319,.086,10,40),0,0,0,0,Math.PI/2);
  cylinder(rubber,0,0,0,.322,.246);
  cylinder(steel,0,0,0,.263,.25);
  const disk = new THREE.Shape();disk.absarc(0,0,.258,0,Math.PI*2,false);
  for(let i=0;i<10;i++) { const a=i*Math.PI/5,hole=new THREE.Path();hole.absellipse(Math.cos(a)*.18,Math.sin(a)*.18,.027,.046,0,Math.PI*2,true,a);disk.holes.push(hole); }
  const dg=new THREE.ExtrudeGeometry(disk,{depth:.009,bevelEnabled:true,bevelSegments:1,bevelThickness:.003,bevelSize:.003,curveSegments:8});
  put(steel,dg,.125,0,0,0,Math.PI/2);
  put(steel,new THREE.TorusGeometry(.256,.012,6,32),.133,0,0,0,Math.PI/2);
  cylinder(silver,.143,0,0,.086,.039);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5; cylinder(silver,.149,Math.sin(a)*.111,Math.cos(a)*.111,.014,.022,'x',6);}
  cylinder(steel,.168,0,0,.045,.006);
  box(trim,.141,.263,0,.016,.025,.013,.003);

  const finish = (map: Map<Surface, THREE.BufferGeometry[]>): Part[] => Array.from(map,([surface,source])=>{
    const unindexed=source.map(g=>g.index?g.toNonIndexed():g);
    const geometry=mergeGeometries(unindexed)!; geometry.computeBoundingSphere();
    new Set([...source,...unindexed]).forEach(g=>g.dispose()); shared.add(geometry);
    if(typeof surface!=='string') shared.add(surface);
    return {geometry,surface};
  });
  return {body:finish(body),wheel:finish(wheel)};
}

function label(w: number,h: number,draw:(ctx:CanvasRenderingContext2D)=>void): THREE.MeshStandardMaterial {
  // Geometry can also be inspected headlessly; the browser supplies the actual lettering.
  const canvas=typeof document==='undefined'?undefined:document.createElement('canvas');
  if(canvas){canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);}
  const map=canvas?new THREE.CanvasTexture(canvas):new THREE.Texture();map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  return new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.48,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
}
export function buildPoliceCar(lamps: PoliceLamps): PoliceCarRig {
  assets??=makeAssets();
  const group=new THREE.Group();group.name='Police Interceptor Utility';
  group.position.z=.07; // Centre the push bumper and rear bumper inside the collision footprint.
  const add=(parent:THREE.Group,parts:Part[])=>{for(const p of parts){const mesh=new THREE.Mesh(p.geometry,typeof p.surface==='string'?lamps[p.surface]:p.surface);mesh.castShadow=typeof p.surface!=='string'&&!(mesh.material as THREE.Material).transparent;mesh.receiveShadow=true;parent.add(mesh);}};
  const body=new THREE.Group();body.name='White patrol SUV body';add(body,assets.body);group.add(body);
  const wheels:THREE.Group[]=[],spins:THREE.Group[]=[];
  for(const side of [-1,1])for(const z of [-1.5,1.51]){
    const pivot=new THREE.Group();pivot.name=z<0?'Front steering wheel':'Rear wheel';pivot.position.set(side*.895,POLICE_SOURCE_WHEEL_RADIUS,z);
    const spin=new THREE.Group();spin.name='Steel wheel and tire';spin.scale.x=side;add(spin,assets.wheel);pivot.add(spin);group.add(pivot);wheels.push(pivot);spins.push(spin);
  }
  return {group,wheels,spins};
}
