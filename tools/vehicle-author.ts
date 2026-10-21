/** Offline authoring/export only. This module is never imported by the game. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildPoliceCar } from '../src/drive/police-car';
import { rigPlayerCar } from '../src/drive/car-asset';

type Role='paint'|'glass'|'tire'|'head'|'brake'|'turn'|'red'|'blue'|'trim'|'metal'|'interior';
const targets = {
 sedan:{file:'generico-sedan',body:'Sedan Body',length:4.8},suv:{file:'generico-suv',body:'SUV Body',length:4.85},
 pickup:{file:'generico-picape',body:'Pickup Body',length:5.7},hatchback:{file:'honda-civic',length:4.25},
 sport:{file:'nissan-200sx-silvia',length:4.6}
};
function dequantize(source:THREE.BufferGeometry):THREE.BufferGeometry {
 const g=source.clone();
 for(const name of Object.keys(g.attributes)) {
  const a=g.getAttribute(name), data=new Float32Array(a.count*a.itemSize);
  for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)data[i*a.itemSize+c]=a.getComponent(i,c);
  g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,false));
 }
 return g;
}
function applyRole(m:THREE.Material,role:Role) {m.userData={...m.userData,vehicleRole:role};return m;}
function inferRole(name:string,m:THREE.MeshStandardMaterial):Role {
 if(/Tyre|Tire|Rubber|Wheel_[345]|Material\.005/i.test(name))return'tire';
 if(/glass|window|Kaca/i.test(name)||m.transparent&&m.opacity<.99||((m as THREE.MeshPhysicalMaterial).transmission??0)>.01)return'glass';
 if(/Rear.?Light|BRAK|red_light|GLASS_red/i.test(name))return'brake';
 if(/front.?light|head.?light|frontLamp|lampudepan/i.test(name))return'head';
 if(/amber|orange|seindepan/i.test(name))return'turn';
 if(/body|paint/i.test(name))return'paint';
 if(m.color?.r>.6&&m.color.g<.15&&m.color.b<.15)return'brake';
 if(m.color?.r>.8&&m.color.g>.35&&m.color.g<.8&&m.color.b<.2)return'turn';
 if(/rim|velg|chrome|metal/i.test(name))return'metal';
 return'trim';
}
function surfaceMaps() {
 const normal=document.createElement('canvas'),rough=document.createElement('canvas');normal.width=rough.width=128;normal.height=rough.height=128;
 const nc=normal.getContext('2d')!,rc=rough.getContext('2d')!,ni=nc.createImageData(128,128),ri=rc.createImageData(128,128);
 let seed=57012;for(let i=0;i<128*128;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=(seed>>>26)-32,j=i*4;ni.data.set([128+n*.035,128+n*.035,255,255],j);ri.data.set([255,Math.round(223+n*.13),255,255],j);}
 nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
 return{normal:new THREE.CanvasTexture(normal),roughness:new THREE.CanvasTexture(rough)};
}
const detail=surfaceMaps();
function pbr(source:THREE.Material,role:Role):THREE.MeshStandardMaterial {
 const old=source as THREE.MeshStandardMaterial;let m:THREE.MeshStandardMaterial;
 if(role==='paint'){const p=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(p,old);p.clearcoat=1;p.clearcoatRoughness=.16;p.roughness=Math.max(.23,Math.min(.43,old.roughness??.3));p.metalness=Math.max(.24,old.metalness??.3);m=p;}
 else if(old instanceof THREE.MeshStandardMaterial)m=old.clone();
 else m=new THREE.MeshStandardMaterial({color:(old as any).color??'#9a9da0'});
 if(role==='paint'){m.normalMap??=detail.normal;m.normalScale.set(.13,.13);m.roughnessMap??=detail.roughness;}
 if(role==='glass'){m.transparent=true;m.opacity=.35;m.depthWrite=false;m.roughness=.1;m.metalness=.25;}
 if(role==='tire'){m.metalness=0;m.roughness=.87;}
 if(role==='trim')m.emissive.set('#000000');
 if(role==='turn'){m.emissive.set('#ff9c14');m.emissiveIntensity=.03;}
 if(role==='head'){m.emissive.set('#d8ecff');m.emissiveIntensity=.45;}
 if(role==='brake'){m.emissive.set('#e51c25');m.emissiveIntensity=.25;}
 if(role==='red'||role==='blue'){m.color.set(role==='red'?'#d70d25':'#1251d8');m.emissive.copy(m.color);m.emissiveIntensity=.04;}
 return applyRole(m,role) as THREE.MeshStandardMaterial;
}
function mesh(source:THREE.Mesh,matrix:THREE.Matrix4,material:THREE.Material):THREE.Mesh {
 const g=dequantize(source.geometry);g.applyMatrix4(matrix);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.name=source.name;m.castShadow=m.receiveShadow=true;return m;
}
function selectedSource(source:THREE.Group,bodyName?:string) {
 source.updateMatrixWorld(true);let body:THREE.Object3D|undefined,parts:THREE.Mesh[]=[],wheelParents:THREE.Object3D[]=[];
 if(bodyName) {
  source.traverse(o=>{if(o.name.replace(/_/g,' ')===bodyName)body=o;});if(!body)throw new Error('Missing body '+bodyName+' names '+source.children.map(c=>c.name));
  body.traverse(o=>{if(o instanceof THREE.Mesh)parts.push(o);});
  const center=body.getWorldPosition(new THREE.Vector3());
  source.traverse(o=>{if(/^Wheel_[AE](?:00[123])?(?:_\d+)?$/.test(o.name))wheelParents.push(o);});
  wheelParents.sort((a,b)=>a.getWorldPosition(new THREE.Vector3()).distanceToSquared(center)-b.getWorldPosition(new THREE.Vector3()).distanceToSquared(center));wheelParents=wheelParents.slice(0,4);
 } else {
  source.traverse(o=>{if(/^Circle(?:[._]?00[123])?(?:_[1567])?$/.test(o.name))wheelParents.push(o);});
  const wheelSet=new Set<THREE.Object3D>();wheelParents.forEach(p=>p.traverse(o=>wheelSet.add(o)));
  source.traverse(o=>{if(o instanceof THREE.Mesh&&!wheelSet.has(o))parts.push(o);});
 }
 if(wheelParents.length!==4)throw new Error('Source must contain exactly four selected wheels: '+wheelParents.map(w=>w.name));
 return{body,parts,wheelParents};
}
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function importModel(kind:keyof typeof targets):Promise<THREE.Group> {
 const config=targets[kind],gltf=await loader.loadAsync('/tools/vehicle-sources/'+config.file+'.glb'),source=gltf.scene;
 const {body,parts,wheelParents}=selectedSource(source,'body'in config?config.body:undefined);
 // Body authoring frame differs between selected fleet models. Local Z is height in Comrade's FBX.
 let frame=new THREE.Matrix4();
 if(body){frame.copy(body.matrixWorld).invert();frame.premultiply(new THREE.Matrix4().makeRotationX(-Math.PI/2));frame.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));}
 else if(kind==='hatchback'){frame.makeRotationY(Math.PI);}
 else if(kind==='sport'){frame.makeRotationY(Math.PI/2);}
 const baked=new THREE.Group(), materials=new Map<string,THREE.Material>();
 const material=(m:THREE.Material,name:string)=>{let role=inferRole(name+' '+m.name,m as THREE.MeshStandardMaterial);if(kind==='sport'&&m.name==='Material003')role='paint';if(kind==='sport'&&m.name==='Material.003')role='paint';if(kind==='sport'){const roles:Record<string,Role>={'Material.009':'head','Material.010':'brake','Material.011':'turn','Material.021':'tire','Material.022':'metal'};role=roles[m.name]??role;}const key=m.uuid+role;if(!materials.has(key))materials.set(key,pbr(m,role));return materials.get(key)!;};
 for(const part of parts){const m=Array.isArray(part.material)?part.material[0]:part.material;baked.add(mesh(part,frame.clone().multiply(part.matrixWorld),material(m,part.name)));}
 const wheelMeshes=wheelParents.map(p=>{const g=new THREE.Group();p.traverse(o=>{if(o instanceof THREE.Mesh){const m=Array.isArray(o.material)?o.material[0]:o.material;g.add(mesh(o,frame.clone().multiply(o.matrixWorld),material(m,o.name)));}});return g;});
 wheelMeshes.forEach(w=>baked.add(w));
 let bounds=new THREE.Box3().setFromObject(baked),size=bounds.getSize(new THREE.Vector3());
 // Detect X-forward authoring for the two hand-modeled cars from wheelbase axes.
 if(size.x>size.z*1.3){const rot=new THREE.Matrix4().makeRotationY(Math.PI/2);baked.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.applyMatrix4(rot);});bounds=new THREE.Box3().setFromObject(baked);size=bounds.getSize(new THREE.Vector3());}
 const center=bounds.getCenter(new THREE.Vector3()),scale=config.length/size.z;
 const normalize=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
 baked.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.applyMatrix4(normalize);});
 const root=new THREE.Group();root.name=kind;
 for(const part of [...baked.children])if(!wheelMeshes.includes(part as THREE.Group))root.add(part);
 for(const wheel of wheelMeshes){const b=new THREE.Box3().setFromObject(wheel),center=b.getCenter(new THREE.Vector3()),pivot=new THREE.Group(),spin=new THREE.Group();pivot.position.copy(center);pivot.name='Wheel_'+(center.z<0?'F':'R')+(center.x<0?'L':'R');spin.name='Spin';
  for(const part of [...wheel.children]){(part as THREE.Mesh).geometry.translate(-center.x,-center.y,-center.z);spin.add(part);}pivot.add(spin);root.add(pivot);
 }
 // Source optics often share one texture/material front and rear; split triangles by axle plane.
 splitOptics(root);
 addSignals(root,config.length);splitTurnMaterials(root);mergeStatic(root);root.userData={...root.userData,canonicalFrame:'metres, +Y up, -Z forward, road Y=0',offlineAuthored:true,provenance:(gltf.asset as any).extras};
 return root;
}
function splitOptics(root:THREE.Group) {
 const optics:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&(/optic|lampu_0|lampuseindepan/i.test(o.name)||(o.material as THREE.Material).userData.vehicleRole==='head'))optics.push(o);});
 for(const old of optics){if(old.parent!==root)continue;const src=old.geometry.index?old.geometry.toNonIndexed():old.geometry,position=src.getAttribute('position');
  const rearRole=(old.material as THREE.Material).userData.vehicleRole==='head'?'trim':'brake';
  for(const role of ['head',rearRole] as const){const attrs:Record<string,number[]>={};for(const name of Object.keys(src.attributes))attrs[name]=[];
   for(let i=0;i<position.count;i+=3){const front=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3<0;if(front!==(role==='head'))continue;for(const name of Object.keys(attrs)){const a=src.getAttribute(name);for(let j=0;j<3;j++)for(let c=0;c<a.itemSize;c++)attrs[name].push(a.getComponent(i+j,c));}}
   if(!attrs.position.length)continue;const g=new THREE.BufferGeometry();for(const name of Object.keys(attrs))g.setAttribute(name,new THREE.Float32BufferAttribute(attrs[name],src.getAttribute(name).itemSize));const m=pbr(old.material as THREE.Material,role);const part=new THREE.Mesh(g,m);part.name=role==='head'?'Headlights':'BrakeLights';root.add(part);
  }root.remove(old);
 }
}
function canonicalize(root:THREE.Group,length:number) {
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),scale=length/bounds.getSize(new THREE.Vector3()).z,offset=new THREE.Vector3(center.x,bounds.min.y,center.z);
 for(const child of root.children){if(child instanceof THREE.Mesh){child.geometry.translate(-offset.x,-offset.y,-offset.z);child.geometry.scale(scale,scale,scale);}else{child.position.sub(offset).multiplyScalar(scale);child.scale.multiplyScalar(scale);}}
}
function addSignals(root:THREE.Group,length:number) {
 // Project added optics onto the actual body skin. Mirror/bounding-box extents are not lamp mounts.
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),width=bounds.getSize(new THREE.Vector3()).x;
 const roles=new Set<string>(),skin:THREE.Mesh[]=[];
 for(const child of root.children)if(child instanceof THREE.Mesh){
  const role=(child.material as THREE.Material).userData.vehicleRole;
  roles.add(role);if(role==='paint'||role==='trim')skin.push(child);
 }
 const ray=new THREE.Raycaster(),mounts:unknown[]=[];
 const hitAt=(x:number,y:number,end:number)=>{
  ray.set(new THREE.Vector3(x,y,end*length),new THREE.Vector3(0,0,-end));
  return ray.intersectObjects(skin,false)[0]?.point;
 };
 const add=(role:'head'|'brake'|'turn',side:number,end:number,w:number,h:number)=>{
  let x=side*width*(role==='turn'?.36:.31),y=.65;
  let hit=hitAt(x,y,end);
  if(!hit){x*=.85;hit=hitAt(x,y,end);}
  if(!hit)throw new Error('No body surface for '+root.name+' '+role+' lamp');
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=2;j++)for(let i=0;i<=6;i++){
   const px=x+(i/6-.5)*w,py=y+(j/2-.5)*h,p=hitAt(px,py,end);
   if(!p)throw new Error('Lamp crosses body silhouette on '+root.name);
   positions.push(p.x,p.y,p.z+end*.004);uv.push(i/6,j/2);
   if(i<6&&j<2){const a=j*7+i;indices.push(a,a+1,a+7,a+1,a+8,a+7);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const material=pbr(new THREE.MeshStandardMaterial({color:role==='head'?'#e7f3ff':role==='brake'?'#ad1727':'#eaa337',side:THREE.DoubleSide}),role);
  if(role==='turn')material.userData.vehicleSide=side<0?'left':'right';
  const lamp=new THREE.Mesh(g,material);lamp.name='Mounted_'+role;root.add(lamp);
  mounts.push({role,side,end,point:[hit.x,hit.y,hit.z+end*.004],skin:hit.toArray(),clearance:.004});
 };
 for(const role of ['head','brake'] as const)if(!roles.has(role))for(const side of [-1,1])add(role,side,role==='head'?-1:1,.24,.045);
 if(!roles.has('turn'))for(const side of [-1,1])for(const end of [-1,1])add('turn',side,end,.085,.035);
 root.userData.lampMounts=mounts;
}
function splitTurnMaterials(root:THREE.Group) {
 for(const old of [...root.children]){if(!(old instanceof THREE.Mesh))continue;const material=old.material as THREE.Material;if(material.userData.vehicleRole!=='turn'||material.userData.vehicleSide)continue;const src=old.geometry.index?old.geometry.toNonIndexed():old.geometry,pos=src.getAttribute('position');
  for(const side of [-1,1]){const attrs:Record<string,number[]>={};for(const name of Object.keys(src.attributes))attrs[name]=[];for(let i=0;i<pos.count;i+=3){if(Math.sign(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))!==side)continue;for(const name of Object.keys(attrs)){const a=src.getAttribute(name);for(let j=0;j<3;j++)for(let c=0;c<a.itemSize;c++)attrs[name].push(a.getComponent(i+j,c));}}if(!attrs.position.length)continue;const geometry=new THREE.BufferGeometry();for(const name of Object.keys(attrs))geometry.setAttribute(name,new THREE.Float32BufferAttribute(attrs[name],src.getAttribute(name).itemSize));const m=material.clone();m.userData={...material.userData,vehicleSide:side<0?'left':'right'};const part=new THREE.Mesh(geometry,m);part.name=side<0?'Turn_L':'Turn_R';root.add(part);}
  root.remove(old);
 }
}
function mergeStatic(root:THREE.Group) {
 const sets=new Map<THREE.Material,THREE.BufferGeometry[]>();for(const p of [...root.children])if(p instanceof THREE.Mesh){const m=p.material as THREE.Material;const list=sets.get(m)??[];list.push(p.geometry.index?p.geometry.toNonIndexed():p.geometry);sets.set(m,list);root.remove(p);}
 for(const [m,gs]of sets){const g=mergeGeometries(gs);if(!g)throw new Error('Cannot merge '+m.name);const p=new THREE.Mesh(g,m);p.name='Body_'+(m.userData.vehicleRole??m.name);root.add(p);}
}
function originalTruck() {
 const root=new THREE.Group();root.name='box-truck';
 const mats={paint:pbr(new THREE.MeshStandardMaterial({color:'#dde2e3',metalness:.35,roughness:.3}),'paint'),trim:applyRole(new THREE.MeshStandardMaterial({color:'#171d23',roughness:.72}),'trim'),glass:pbr(new THREE.MeshStandardMaterial({color:'#263943'}),'glass'),metal:applyRole(new THREE.MeshStandardMaterial({color:'#8d99a0',metalness:.85,roughness:.34}),'metal'),tire:pbr(new THREE.MeshStandardMaterial({color:'#17191b'}),'tire'),head:pbr(new THREE.MeshStandardMaterial({color:'#eff7ff'}),'head'),brake:pbr(new THREE.MeshStandardMaterial({color:'#a81a26'}),'brake'),turn:pbr(new THREE.MeshStandardMaterial({color:'#eda12d'}),'turn')};
 const put=(name:string,g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{g.translate(x,y,z);const p=new THREE.Mesh(g,m);p.name=name;root.add(p);return p;};
 const rounded=(name:string,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=.04)=>put(name,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/2,h/2,d/2)),m,x,y,z);
 // The cab is a crown-section surface with a rounded nose and real arch cutouts, authored offline.
 const shape=new THREE.Shape();shape.moveTo(-1.16,.66);shape.lineTo(-1.16,2.40);shape.quadraticCurveTo(-1.16,2.66,-.89,2.69);shape.lineTo(.89,2.69);shape.quadraticCurveTo(1.16,2.66,1.16,2.40);shape.lineTo(1.16,.66);shape.closePath();
 const windscreenHole=new THREE.Path();windscreenHole.moveTo(-.94,1.75);windscreenHole.lineTo(.94,1.75);windscreenHole.lineTo(.94,2.37);windscreenHole.lineTo(-.94,2.37);windscreenHole.closePath();shape.holes.push(windscreenHole);
 const cab=new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:5,bevelSize:.09,bevelThickness:.09,curveSegments:16});cab.translate(0,0,-3.34);put('CabPaint',cab,mats.paint);
 // Side skins have real front wheel openings; the old solid cab covered half each tire.
 for(const side of [-1,1]){
  const wall=new THREE.Shape(),base=.62,angle=Math.asin((base-.46)/.51);
  wall.moveTo(-3.34,base);wall.lineTo(-2.35-Math.cos(angle)*.51,base);
  wall.absarc(-2.35,.46,.51,Math.PI-angle,angle,true);
  wall.lineTo(-1.41,base);wall.lineTo(-1.41,2.57);wall.quadraticCurveTo(-1.41,2.68,-1.54,2.68);
  wall.lineTo(-3.20,2.68);wall.quadraticCurveTo(-3.34,2.68,-3.34,2.52);wall.closePath();
  const hole=new THREE.Path();hole.moveTo(-3.035,1.705);hole.lineTo(-1.745,1.705);hole.lineTo(-1.745,2.535);hole.lineTo(-3.035,2.535);hole.closePath();wall.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(wall,{depth:.065,bevelEnabled:false,curveSegments:24}),pos=g.getAttribute('position');
  for(let i=0;i<pos.count;i++){const z=pos.getX(i),x=side*(1.16+pos.getZ(i));pos.setXYZ(i,x,pos.getY(i),z);}
  // Reflection changes winding on the left wall.
  if(side===1){for(const name of Object.keys(g.attributes)){const a=g.getAttribute(name);for(let i=0;i<a.count;i+=3)for(let c=0;c<a.itemSize;c++){const v=a.getComponent(i+1,c);a.setComponent(i+1,c,a.getComponent(i+2,c));a.setComponent(i+2,c,v);}}}
  g.computeVertexNormals();put('CabSideWithArch',g,mats.paint);
 }
 rounded('CabRoof',mats.paint,0,2.64,-2.38,2.38,.13,1.95,.06);
 rounded('CargoBox',mats.paint,0,2.19,1.00,2.44,2.35,5.25,.065);
 for(const x of [-.55,.55]){
  rounded('SeatCushion',mats.trim,x,1.02,-2.13,.60,.18,.62,.06);
  rounded('SeatBack',mats.trim,x,1.42,-1.83,.60,.72,.17,.06);
 }
 rounded('Dashboard',mats.trim,0,1.50,-3.04,2.13,.22,.42,.05);
 const steering=new THREE.TorusGeometry(.19,.026,8,32);steering.rotateX(-.25);put('Steering',steering,mats.trim,-.55,1.64,-2.72);
 rounded('Chassis',mats.trim,0,.58,.1,1.92,.29,6.6,.06);
 rounded('Grille',mats.trim,0,1.04,-3.445,1.45,.46,.045,.08);
 for(let i=0;i<6;i++)rounded('GrilleSlat',mats.metal,0,.87+i*.065,-3.472,1.38,.018,.017,.005);
 rounded('Windscreen',mats.glass,0,2.06,-3.45,2.06,.78,.014,.10);
 rounded('Bumper',mats.trim,0,.59,-3.49,2.40,.23,.20,.06);
 for(const s of [-1,1]){
  rounded('Headlight',mats.head,s*.87,1.07,-3.478,.34,.25,.03,.065);rounded('Turn',mats.turn,s*1.055,1.07,-3.478,.07,.23,.035,.02);
  rounded('SideGlass',mats.glass,s*1.231,2.12,-2.39,.015,.85,1.31,.04);
  rounded('DoorHandle',mats.trim,s*1.267,1.53,-1.84,.025,.035,.20,.012);
  rounded('Mirror',mats.trim,s*1.34,2.07,-3.06,.15,.37,.21,.06);
  rounded('MirrorArm',mats.metal,s*1.25,1.94,-3.04,.25,.025,.025,.008);
  rounded('StepBracket',mats.trim,s*1.09,.56,-1.60,.065,.28,.14,.012);
  rounded('Step',mats.trim,s*1.17,.42,-1.60,.31,.11,.34,.025);
  rounded('SideRail',mats.metal,s*1.232,1.03,1.00,.02,.08,5.12,.004);
  for(let i=0;i<9;i++)rounded('BoxRib',mats.metal,s*1.235,2.19,-1.37+i*.59,.016,2.10,.025,.004);
  rounded('RearBrake',mats.brake,s*.93,.75,3.65,.26,.14,.035,.018);rounded('RearTurn',mats.turn,s*.93,.89,3.65,.26,.08,.035,.012);
 }
 rounded('RearLampCarrier',mats.trim,0,.79,3.62,2.20,.49,.08,.025);
 rounded('RearBumper',mats.trim,0,.48,3.67,2.39,.18,.14,.035);
 for(let i=0;i<12;i++)rounded('ShutterSlat',mats.metal,0,1.11+i*.183,3.635,2.26,.014,.014,.003);
 for(const s of [-1,1])rounded('ShutterRail',mats.metal,s*1.15,2.19,3.638,.035,2.19,.025,.006);
 const g=new THREE.Group();const wheelRadius=.46;
 for(const x of [-1.04,1.04])for(const z of [-2.35,2.08]){
  const p=new THREE.Group();p.name='Wheel_'+(z<0?'F':'R')+(x<0?'L':'R');p.position.set(x,wheelRadius,z);const spin=new THREE.Group();spin.name='Spin';
  const tire=new THREE.Mesh(new THREE.TorusGeometry(.355,.105,12,40),mats.tire);tire.rotation.y=Math.PI/2;spin.add(tire);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.22,24),mats.metal);rim.rotation.z=Math.PI/2;spin.add(rim);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,bolt=new THREE.Mesh(new THREE.SphereGeometry(.025,6,4),mats.metal);bolt.position.set(x<0?-.13:.13,Math.cos(a)*.15,Math.sin(a)*.15);spin.add(bolt);}
  p.add(spin);root.add(p);
 }
 splitTurnMaterials(root);mergeStatic(root);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),scale=7.4/bounds.getSize(new THREE.Vector3()).z;
 root.children.forEach(p=>{if(p instanceof THREE.Mesh){p.geometry.translate(-center.x,-bounds.min.y,-center.z);p.geometry.scale(scale,scale,scale);}else {p.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z)).multiplyScalar(scale);p.scale.setScalar(scale);}});
 root.userData={author:'Chillwave Drive contributors',license:'MIT',source:'tools/vehicle-author.ts',originalAuthoredMesh:true};return root;
}
function police() {
 const lamps={head:new THREE.MeshStandardMaterial({color:'#edfbff'}),brake:new THREE.MeshStandardMaterial({color:'#ae1727'}),red:new THREE.MeshStandardMaterial({color:'#e72b42'}),blue:new THREE.MeshStandardMaterial({color:'#1e5fff'})};Object.entries(lamps).forEach(([role,m])=>applyRole(m,role as Role));
 const rig=buildPoliceCar(lamps),root=new THREE.Group();root.name='police-suv';rig.group.updateMatrixWorld(true);
 const mats=new Map<THREE.Material,THREE.Material>();
 const convert=(m:THREE.Material)=>{if(!mats.has(m)){const old=m as THREE.MeshStandardMaterial;let role=m.userData.vehicleRole as Role|undefined;
  role??=old.map?.image?.width===1536||old.map?.image?.width===768||old.map?.image?.width===256||old.map?.image?.width===512?'trim':old.color&&old.color.r>.7&&old.color.g>.7&&old.color.b>.7&&old instanceof THREE.MeshPhysicalMaterial?'paint':old instanceof THREE.MeshPhysicalMaterial&&old.color.r<.12?'glass':/15191b|17191b/.test(old.color?.getHexString())?'tire':old.color&&old.color.r>.4&&old.color.g>.15&&old.color.g<.6&&old.color.b<.1?'turn':old.metalness>.6?'metal':'trim';mats.set(m,pbr(m,role));}return mats.get(m)!;};
 const wheelSet=new Set<THREE.Object3D>();rig.wheels.forEach(w=>w.traverse(o=>wheelSet.add(o)));
 rig.group.traverse(o=>{if(o instanceof THREE.Mesh&&!wheelSet.has(o))root.add(mesh(o,o.matrixWorld,convert(o.material as THREE.Material)));});
 for(const w of rig.wheels){const p=new THREE.Group(),spin=new THREE.Group(),center=w.getWorldPosition(new THREE.Vector3());p.position.copy(center);p.name='Wheel_'+(center.z<0?'F':'R')+(center.x<0?'L':'R');spin.name='Spin';w.traverse(o=>{if(o instanceof THREE.Mesh){const mat=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z).multiply(o.matrixWorld);spin.add(mesh(o,mat,convert(o.material as THREE.Material)));}});p.add(spin);root.add(p);}
 // Transparent, curved original glazing reveals seats, dash, console and steering through the windows.
 const interior=applyRole(new THREE.MeshStandardMaterial({color:'#171c22',roughness:.83}),'interior');
 const add=(g:THREE.BufferGeometry,x:number,y:number,z:number,name:string)=>{g.translate(x,y,z);const m=new THREE.Mesh(g,interior);m.name=name;root.add(m);};
 for(const x of [-.42,.42])for(const z of [.05,1.10]){add(new RoundedBoxGeometry(.53,.18,.57,2,.07),x,.72,z,'SeatCushion');const g=new RoundedBoxGeometry(.52,.67,.16,2,.06);g.rotateX(-.12);add(g,x,1.02,z+.23,'SeatBack');add(new RoundedBoxGeometry(.26,.20,.12,2,.045),x,1.4,z+.26,'Headrest');}
 add(new RoundedBoxGeometry(1.58,.21,.45,3,.07),0,1.10,-.72,'Dashboard');add(new RoundedBoxGeometry(.26,.3,.9,2,.04),0,.77,-.02,'Console');const steering=new THREE.TorusGeometry(.17,.022,8,32);steering.rotateX(-.25);add(steering,-.42,1.12,-.38,'SteeringWheel');
 splitTurnMaterials(root);canonicalize(root,5.35);mergeStatic(root);root.userData={authoredFor:'Chillwave Drive',author:'Chillwave Drive contributors',license:'MIT',source:'tools/vehicle-author.ts and src/drive/police-car.ts',originalAuthoredMesh:true,canonicalFrame:'metres, +Y up, -Z forward, road Y=0'};return root;
}
async function player() {
 const gltf=await loader.loadAsync('/models/porsche-911-gt3/model.glb'),source=gltf.scene,rig=rigPlayerCar(source,'#00a8d6');
 const root=rig.group;root.name='Cyan GT3';root.userData={...root.userData,playerRig:true,scale:rig.scale,eye:rig.eye.toArray(),provenance:(gltf.asset as any).extras,canonicalFrame:'metres, +Y up, -Z forward, road Y=0'};
 const names=['Wheel_FL','Wheel_RL','Wheel_FR','Wheel_RR'];rig.wheels.forEach((w,i)=>{w.name=names[i];rig.spins[i].name='Spin';});rig.steering.name='Steering';rig.wipers.forEach((w,i)=>w.name='Wiper_'+i);
 const paint=new Set(rig.paint),glass=new Set(rig.windows),heads=new Set(rig.headlamps),brakes=new Set(rig.lamps);
 root.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;applyRole(m,paint.has(m as THREE.MeshPhysicalMaterial)?'paint':glass.has(m as THREE.MeshPhysicalMaterial)?'glass':heads.has(m)?'head':brakes.has(m)?'brake':inferRole(o.name+' '+m.name,m));}});
 for(const p of rig.paint){p.normalMap??=detail.normal;p.normalScale.set(.13,.13);p.roughnessMap??=detail.roughness;}
 for(const [i,g]of[rig.mirror,...rig.sideMirrors].entries()){const m=new THREE.Mesh(g,applyRole(new THREE.MeshStandardMaterial({color:'#98afc1',metalness:.85,roughness:.1}),'metal'));m.name=['Mirror_Center','Mirror_Left','Mirror_Right'][i];root.add(m);}
 addSignals(root,4.6);return root;
}
function lod(source:THREE.Group,level:1|2) {
 const root=source.clone(true);root.name=source.name+'_LOD'+level;
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const material=o.material as THREE.MeshStandardMaterial,role=material.userData.vehicleRole;
  if(level===2){const simple=material.clone();simple.map=null;simple.normalMap=null;simple.roughnessMap=null;simple.metalnessMap=null;simple.alphaMap=null;simple.emissiveMap=null;simple.transparent=false;simple.opacity=1;o.material=simple;if(!['paint','glass','tire','head','brake','red','blue'].includes(role)){o.visible=false;return;}const g=o.geometry,position=g.getAttribute('position'),points:THREE.Vector3[]=[];const stride=Math.max(1,Math.floor(position.count/350));for(let i=0;i<position.count;i+=stride)points.push(new THREE.Vector3().fromBufferAttribute(position,i));try{o.geometry=new ConvexGeometry(points);}catch{o.visible=false;}}
  else {const count=o.geometry.getAttribute('position').count;if(count>1000&&count<18000){try{const g=mergeVertices(o.geometry);o.geometry=new SimplifyModifier().modify(g,Math.floor(g.getAttribute('position').count*.35));}catch{o.geometry=o.geometry.clone();}}}
 });return root;
}
function stats(root:THREE.Group) {
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),pivots=['Wheel_FL','Wheel_RL','Wheel_FR','Wheel_RR'].map(n=>root.getObjectByName(n)!);
 if(pivots.some(p=>!p))throw new Error('Missing canonical wheel on '+root.name+' '+root.children.map(o=>o.name+':'+o.position.toArray()));
 let triangles=0,meshes=0;const roles=new Set<string>();root.traverse(o=>{if(o instanceof THREE.Mesh&&o.visible){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;meshes++;roles.add((o.material as THREE.Material).userData.vehicleRole);}});
 return{length:size.z,width:size.x,height:size.y,wheelRadius:pivots[0].position.y,wheelbase:Math.abs(pivots[0].position.z-pivots[1].position.z),triangles,meshes,roles:[...roles],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}
export async function produceVehicles() {
 const out:Record<string,ReturnType<typeof stats>>= {};
 const all:Record<string,THREE.Group>={};for(const k of Object.keys(targets)as(keyof typeof targets)[])all[k]=await importModel(k);all.truck=originalTruck();all.police=police();all.player=await player();
 const exporter=new GLTFExporter();
 for(const[k,model]of Object.entries(all))for(const level of (k==='player'?[0]:[0,1,2])as(0|1|2)[]){const root=level?lod(model,level):model;root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry=mergeVertices(o.geometry,1e-5);});const result=await exporter.parseAsync(root,{binary:true,onlyVisible:true,trs:true});const key=k+(level?'-lod'+level:''),data=new Uint8Array(result as ArrayBuffer),metadata=stats(root);let raw='';for(let i=0;i<data.length;i+=16384)raw+=String.fromCharCode(...data.subarray(i,i+16384));await (window as any).writeVehicleAsset({key,base64:btoa(raw),stats:metadata});out[key]=metadata;}
 return out;
}
