import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POLICE_SIZE } from './config';

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
  const trim = new THREE.MeshStandardMaterial({ color: '#15191c', roughness: .68 });
  const steel = new THREE.MeshStandardMaterial({ color: '#252a2d', metalness: .8, roughness: .35 });
  const silver = new THREE.MeshStandardMaterial({ color: '#a8afb3', metalness: .95, roughness: .25 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#17191b', roughness: .93 });
  const tint = new THREE.MeshPhysicalMaterial({ color: '#111c22', metalness: .34, roughness: .12, clearcoat: 1, side: THREE.DoubleSide });
  const lens = new THREE.MeshPhysicalMaterial({ color: '#78818b', metalness: .35, roughness: .12, clearcoat: 1 });
  const amber = new THREE.MeshStandardMaterial({ color: '#df9b31', emissive: '#9a4a0a', emissiveIntensity: .3 });
  const green = new THREE.MeshStandardMaterial({ color: '#488361', roughness: .4 });
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
  const panel = (m: Surface, points: number[][]) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); put(m, g);
  };
  const tube = (m: Surface, points: number[][], radius: number, segments = 16) =>
    put(m, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), segments, radius, 6, false));
  const cylinder = (m: Surface, x: number, y: number, z: number, r: number, depth: number, axis: 'x' | 'z' = 'x', segments = 24) =>
    put(m, new THREE.CylinderGeometry(r, r, depth, segments), x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);

  // Bevelled lower shell with real open wheel arches, rather than wheels hidden in a box.
  const side = new THREE.Shape();
  const path = [[-2.45,.38],[-2.4,.91],[-2.28,1.09],[-1.18,1.16],[-.95,1.23],[2.15,1.23],[2.43,1.1],[2.46,.38]];
  path.forEach(([z,y], i) => i ? side.lineTo(-z,y) : side.moveTo(-z,y));
  for (const z of [1.51, -1.5]) {
    const angle = Math.asin((.405 - .38) / .455);
    side.lineTo(-z - Math.cos(angle) * .455, .38);
    side.absarc(-z, .405, .455, Math.PI + angle, -angle, true);
  }
  side.closePath();
  const shell = new THREE.ExtrudeGeometry(side, { depth: 1.92, bevelEnabled: true, bevelSegments: 3, bevelSize: .045, bevelThickness: .045, steps: 1, curveSegments: 24 });
  shell.rotateY(Math.PI / 2); shell.translate(-.96, 0, 0); put(white, shell);
  box(trim, 0, .29, .05, 1.65, .18, 4.35, .06);

  // Crown of the hood; subtle raised shoulders produce continuous paint highlights.
  const hood: number[] = [], hi: number[] = [], hu: number[] = [];
  const hoodZ = [-2.41,-2.29,-2.03,-1.63,-1.2];
  for (let j = 0; j < hoodZ.length; j++) for (let i = 0; i <= 16; i++) {
    const u = i / 16, edge = Math.sin(Math.PI * u), y = [1.015,1.09,1.125,1.15,1.17][j];
    hood.push((u * 2 - 1) * [.83,.92,.94,.94,.92][j], y + edge * .035, hoodZ[j]); hu.push(u, j / 4);
    if (j < 4 && i < 16) { const a = j * 17 + i; hi.push(a,a+1,a+17,a+1,a+18,a+17); }
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hood, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(hu, 2)); hg.setIndex(hi); hg.computeVertexNormals(); put(white, hg);
  for (const s of [-1,1]) tube(white, [[s*.55,1.155,-1.25],[s*.57,1.145,-1.7],[s*.61,1.105,-2.18]], .009);

  // White A/D pillars, upright wagon roof and three distinct side windows.
  const sx = (y: number) => .996 - (y - 1.2) * .25;
  const cab = [[-1.2,1.18],[-.56,1.76],[-.28,1.81],[1.75,1.8],[2.27,1.61],[2.4,1.18]];
  const cabin = new THREE.Shape(); cab.forEach(([z,y],i)=>i?cabin.lineTo(-z,y):cabin.moveTo(-z,y)); cabin.closePath();
  // Side skins slope inward with height, including the white pillars between the glass.
  for (const s of [-1,1]) {
    const face = new THREE.ShapeGeometry(cabin, 12), p = face.getAttribute('position');
    for(let i=0;i<p.count;i++) { const z=-p.getX(i), y=p.getY(i); p.setXYZ(i,s*sx(y),y,z); }
    face.computeVertexNormals(); put(white,face);
    const window = (p: number[][]) => panel(tint,p.map(([z,y])=>[s*(sx(y)+.006),y,z]));
    window([[-1.035,1.26],[.34,1.26],[.34,1.733],[-.51,1.722]]);
    window([[.48,1.26],[1.47,1.26],[1.33,1.73],[.48,1.733]]);
    window([[1.62,1.26],[2.25,1.26],[2.15,1.57],[1.49,1.724]]);
    panel(trim,[[s*(sx(1.245)+.009),1.245,-1.045],[s*(sx(1.245)+.009),1.245,2.26],[s*(sx(1.267)+.009),1.267,2.26],[s*(sx(1.267)+.009),1.267,-1.045]]);
    panel(trim,[[s*(sx(1.25)+.01),1.25,.34],[s*(sx(1.25)+.01),1.25,.48],[s*(sx(1.74)+.01),1.74,.48],[s*(sx(1.74)+.01),1.74,.34]]);
    // Door seams, inset handles, black mirror shells and lower green fleet stripe.
    for (const z of [-1.02,.42,1.47]) tube(trim,[[s*1.007,.65,z],[s*1.008,.93,z],[s*1.007,1.22,z]],.004,4);
    for (const z of [.2,1.27]) { box(trim,s*1.02,1.214,z,.033,.048,.23,.018); box(steel,s*1.038,1.225,z,.018,.022,.17,.009); }
    box(trim,s*1.053,1.32,-.94,.16,.055,.13); box(trim,s*1.105,1.375,-.94,.255,.135,.31,.055);
    box(lens,s*1.105,1.375,-.784,.18,.085,.008,.012);
    box(trim,s*1.01,.465,.02,.065,.17,1.9,.02);
    box(green,s*1.047,.567,.02,.006,.016,1.88,.002);
    const left = s < 0 ? -1.05 : 2.15, right = s < 0 ? 2.15 : -1.05;
    panel(sideLabel,[[s*1.008,.894,left],[s*1.008,.894,right],[s*1.008,1.206,right],[s*1.008,1.206,left]]);
    const labelSide = (m: THREE.Material, z: number, width: number, y: number, h: number) => {
      const a=z-s*width/2,b=z+s*width/2;
      panel(m,[[s*1.011,y-h/2,b],[s*1.011,y-h/2,a],[s*1.011,y+h/2,a],[s*1.011,y+h/2,b]]);
    };
    labelSide(service,-1.55,.72,1.13,.06); labelSide(hybrid,-.68,.33,.62,.046);
    // Raised moulded wheel-arch cladding has its own inner lip and a visible wheel well.
    for (const z of [-1.5,1.51]) {
      const positions: number[] = [], uv: number[] = [], indices: number[] = [];
      for(let i=0;i<=32;i++) { const a=-.06+(Math.PI+.12)*i/32; for(const r of [.452,.504]) { positions.push(s*1.023,.405+Math.sin(a)*r,z+Math.cos(a)*r); uv.push(i/32,r); } if(i<32){const a=i*2;if(s<0)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);} }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();put(trim,g);
      tube(trim,Array.from({length:33},(_,i)=>{const a=-.06+(Math.PI+.12)*i/32;return[s*1.014,.405+Math.sin(a)*.454,z+Math.cos(a)*.454];}),.019,32);
    }
    // Roof rails, tiny feet and a slim black lightbar mounting saddle.
    for(const z of [.12,1.57]) box(trim,s*.69,1.832,z,.09,.06,.18);
    tube(steel,[[s*.69,1.85,-.02],[s*.69,1.87,.2],[s*.69,1.87,1.5],[s*.69,1.83,1.72]],.018);
  }
  panel(tint,[[-.91,1.218,-1.163],[.91,1.218,-1.163],[.796,1.735,-.552],[-.796,1.735,-.552]]);
  box(trim,0,1.206,-1.18,1.76,.035,.065);
  for(const x of [-.45,.3]) tube(trim,[[x-.25,1.225,-1.162],[x+.27,1.238,-1.146]],.009,3);
  box(white,0,1.781,.62,1.68,.07,2.36,.035);
  panel(white,[[-.84,1.804,1.73],[.84,1.804,1.73],[.895,1.61,2.28],[-.895,1.61,2.28]]);
  panel(tint,[[.904,1.235,2.403],[-.904,1.235,2.403],[-.835,1.624,2.242],[.835,1.624,2.242]]);
  box(white,0,1.785,1.98,1.77,.065,.31,.027);
  box('brake',0,1.761,2.145,.48,.022,.012,.004);
  tube(trim,[[.3,1.288,2.39],[-.17,1.3,2.382]],.01,3);

  // Mesh grille, slim LED headlamps with amber outer corners, and the front push bumper.
  box(trim,0,.883,-2.485,1.24,.335,.075,.07);
  box(steel,0,1.055,-2.475,1.28,.023,.032,.009);
  for(let row=0;row<5;row++) for(let col=0;col<18;col++) {
    const x=(col-8.5)*.063+(row%2)*.0315,y=.76+row*.054;
    if(Math.abs(x)>.56)continue;
    const ring=new THREE.RingGeometry(.023,.028,6);put(steel,ring,x,y,-2.529,0,Math.PI);
  }
  cylinder(blueOval,0,.941,-2.52,.064,.018,'z');
  box(trim,0,.396,-2.41,1.91,.19,.23,.06);
  box(trim,0,.561,-2.485,.92,.16,.035,.018);
  for(const s of [-1,1]) {
    box(lens,s*.806,.992,-2.432,.428,.185,.12,.04);
    box('head',s*.79,.982,-2.497,.28,.027,.012,.009);
    cylinder(silver,s*.72,1.018,-2.497,.049,.01,'z',16);
    cylinder('head',s*.72,1.018,-2.505,.033,.01,'z',16);
    box(amber,s*.98,1.012,-2.476,.055,.033,.017,.008);
    box(trim,s*.783,.665,-2.458,.355,.135,.075,.032);
    box('head',s*.78,.684,-2.501,.245,.022,.008,.004);
    box(lens,s*.78,.646,-2.501,.245,.018,.008,.004);
    tube(steel,[[s*.635,.32,-2.43],[s*.635,.39,-2.65],[s*.635,.98,-2.66],[s*.635,1.13,-2.53],[s*.635,1.09,-2.46]],.038,24);
  }
  for(const y of [.53,.84]) tube(steel,[[-.66,y,-2.66],[.66,y,-2.66]],.031,2);
  box(steel,0,.543,-2.685,.39,.115,.018,.008);
  // Driver-side round A-pillar spotlight.
  tube(trim,[[-.94,1.31,-1.03],[-1.1,1.43,-1.05]],.021,3);
  cylinder(trim,-1.105,1.45,-1.09,.075,.10,'z'); cylinder(lens,-1.105,1.45,-1.145,.058,.008,'z');

  // Hatch seams, vertical rear lamp clusters, number plate and textured black bumper.
  box(trim,0,.385,2.48,1.94,.24,.20,.05);
  box(steel,0,.495,2.489,1.5,.043,.045);
  for(const s of [-1,1]) {
    box('brake',s*.904,1.075,2.505,.15,.29,.073,.026);
    box('brake',s*.744,1.165,2.514,.19,.085,.028,.014);
    box('head',s*.904,.972,2.546,.10,.029,.012,.003);
    box('brake',s*.77,.405,2.584,.27,.024,.015,.003);
    tube(trim,[[s*.81,.59,2.478],[s*.82,1.02,2.477],[s*.8,1.23,2.42]],.004,5);
  }
  box(trim,0,.811,2.493,.56,.29,.028,.018);
  panel(plate,[[-.23,.705,2.512],[.23,.705,2.512],[.23,.907,2.512],[-.23,.907,2.512]]);
  cylinder(blueOval,0,1.115,2.477,.053,.015,'z');
  panel(sideLabel,[[-.45,.976,2.496],[.45,.976,2.496],[.45,1.063,2.496],[-.45,1.063,2.496]]);
  cylinder(steel,-.62,.28,2.42,.047,.19,'z');

  // A low-profile bar with individual dark lenses while patrolling, red/blue when alerted.
  for(const s of [-1,1])box(trim,s*.45,1.846,-.24,.10,.06,.14);
  box(steel,0,1.889,-.24,1.39,.045,.253,.02);
  box(lens,0,1.922,-.24,1.37,.042,.245,.018);
  for(let i=0;i<10;i++) {
    const x=(i-4.5)*.13,m: Lamp=i<5?'red':'blue';
    box(m,x,1.924,-.366,.10,.028,.012,.004);box(m,x,1.924,-.114,.10,.028,.012,.004);
  }
  for(const s of [-1,1]) { box(s<0?'red':'blue',s*.31,.872,-2.524,.13,.032,.012,.005); box(s<0?'red':'blue',s*.49,1.55,2.285,.1,.03,.015,.004); }
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
    const pivot=new THREE.Group();pivot.name=z<0?'Front steering wheel':'Rear wheel';pivot.position.set(side*.895,POLICE_SIZE.wheelRadius,z);
    const spin=new THREE.Group();spin.name='Steel wheel and tire';spin.scale.x=side;add(spin,assets.wheel);pivot.add(spin);group.add(pivot);wheels.push(pivot);spins.push(spin);
  }
  return {group,wheels,spins};
}
