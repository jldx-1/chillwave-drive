import {VEHICLE_LAMPS} from '../src/drive/lamp-levels';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rigFleetCar, animateFleetRig, disposeFleetRig } from '../src/drive/fleet-asset';
import { rigCanonicalPlayer } from '../src/drive/car-asset';
import { VEHICLE_CATALOG, PLAYER_ASSET_PATH } from '../src/drive/vehicle-catalog';

import { binary, geometryOnly } from './helpers/vehicle-glb';
const wheels=['Wheel_FL','Wheel_RL','Wheel_FR','Wheel_RR'];
describe('independent bundled vehicle assets',()=>{
 for(const[kind,spec]of Object.entries(VEHICLE_CATALOG))it(kind+' decodes with finite metre-scale geometry, four independent pivots and controllable lamps',async()=>{
  const{bytes,json}=binary(spec.path);expect(json.asset.version).toBe('2.0');expect(json.buffers?.every(b=>!b.uri)).toBe(true);expect(json.images?.every(i=>!i.uri)??true).toBe(true);
  const scene=(await new GLTFLoader().parseAsync(geometryOnly(bytes,json),'')).scene,bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
  expect(size.z).toBeCloseTo(spec.length,2);expect(size.x).toBeGreaterThan(1.5);expect(size.x).toBeLessThan(3.1);expect(size.y).toBeGreaterThan(1.0);expect(size.y).toBeLessThan(4.0);expect(Math.abs(bounds.min.y)).toBeLessThan(.04);
  for(const name of wheels){const pivot=scene.getObjectByName(name);expect(pivot,name).toBeDefined();expect(pivot!.children.some(p=>/^Spin(?:_\d+)?$/.test(p.name))).toBe(true);expect(Math.sign(pivot!.position.x)).toBe(name.endsWith('L')?-1:1);expect(Math.sign(pivot!.position.z)).toBe(name.startsWith('Wheel_F')?-1:1);}
  const skin:THREE.Mesh[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&['paint','trim'].includes((o.material as THREE.Material).userData.vehicleRole))skin.push(o);});
  const mounts: {point:number[];end:number;clearance:number}[]=[];
  scene.traverse(o=>{if(o.userData.lampMounts)mounts.push(...o.userData.lampMounts);});
  // Check actual exported lamp positions against body geometry, not just a bounding box.
  for(const mount of mounts){
    const point=new THREE.Vector3().fromArray(mount.point),ray=new THREE.Raycaster(point,new THREE.Vector3(0,0,-mount.end));
    const hit=ray.intersectObjects(skin,false)[0];expect(hit,kind+' mounted lamp must touch the skin').toBeDefined();expect(hit!.distance).toBeCloseTo(mount.clearance,3);
  }
  const fl=scene.getObjectByName('Wheel_FL')!,rl=scene.getObjectByName('Wheel_RL')!;expect(fl.position.y).toBeCloseTo(spec.wheelRadius,2);expect(Math.abs(fl.position.z-rl.position.z)).toBeCloseTo(spec.wheelbase,2);
  scene.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');expect(p.count).toBeGreaterThan(2);for(let i=0;i<p.count;i++)expect(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i))).toBe(true);}});
  scene.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.Material).userData.vehicleRole==='head'){
    expect(new THREE.Box3().setFromObject(o).max.z,kind+' headlamps must be at the nose').toBeLessThan(0);
  }});
  const roles=new Set(json.materials.map(m=>m.extras?.vehicleRole));for(const role of['paint','glass','tire','head','brake','turn'])expect(roles.has(role),kind+':'+role).toBe(true);
  for(const side of['left','right'])expect(json.materials.some(m=>m.extras?.vehicleRole==='turn'&&m.extras?.vehicleSide===side)).toBe(true);
  if(kind==='police')for(const role of['red','blue'])expect(roles.has(role)).toBe(true);
 });
 it('ships distinct simplified GLBs with their own geometry and matching provenance hashes',()=>{
  const audit=JSON.parse(readFileSync(new URL('../public/assets/vehicles/geometry-audit.json',import.meta.url),'utf8'));const hashes=new Set<string>();
  for(const[kind,spec]of Object.entries(VEHICLE_CATALOG)){
   const base=audit.files[kind];for(const[path,key]of[[spec.path,kind],[spec.lod1Path,kind+'-lod1'],[spec.lod2Path,kind+'-lod2']]){expect(path).toBeTruthy();const{bytes,json}=binary(path!);expect(json.nodes.some(n=>n.name==='Wheel_FL')).toBe(true);const hash=createHash('sha256').update(bytes).digest('hex');expect(hash).toBe(audit.files[key!].sha256);expect(hashes.has(hash)).toBe(false);hashes.add(hash);}
   expect(audit.files[kind+'-lod1'].triangles).toBeLessThan(base.triangles);expect(audit.files[kind+'-lod2'].triangles).toBeLessThan(base.triangles*.5);
  }
 });
 it('binds the police rig with grounded tires, independent lighting and shared buffers',async()=>{
  const {bytes,json}=binary(VEHICLE_CATALOG.police.path),scene=(await new GLTFLoader().parseAsync(geometryOnly(bytes,json),'')).scene;
  const first=rigFleetCar(scene,'police','#ffffff'),second=rigFleetCar(scene,'police','#ffffff');
  const ground=new THREE.Box3().setFromObject(first.wheels[0],true).min.y;
  first.body.rotation.z=.08;first.body.rotation.x=.04;
  animateFleetRig(first,.1,.1,15,.3,true,true);
  expect(new THREE.Box3().setFromObject(first.wheels[0],true).min.y).toBeCloseTo(ground,2);
  expect(first.wheels[0].rotation.y).toBe(.3);expect(first.wheels[1].rotation.y).toBe(0);
  expect(first.spins[0].rotation.x).not.toBe(0);expect(second.spins[0].rotation.x).toBeCloseTo(0);
  expect(first.lamps.red[0]).not.toBe(second.lamps.red[0]);expect(first.lamps.red[0].emissiveIntensity).toBe(5);expect(second.lamps.red[0].emissiveIntensity).toBe(0);
  expect(first.lamps.brake[0].emissiveIntensity).toBe(VEHICLE_LAMPS.brake);
  const mesh=(g:THREE.Group)=>{const a:THREE.Mesh[]=[];g.traverse(o=>{if(o instanceof THREE.Mesh)a.push(o);});return a;};
  const a=mesh(first.group),b=mesh(second.group);expect(a[0].geometry).toBe(b[0].geometry);
  let disposed=false;b[0].geometry.addEventListener('dispose',()=>disposed=true);disposeFleetRig(first);expect(disposed).toBe(false);disposeFleetRig(second);
 });
 it('restores the actual canonical player cockpit and windshield material binding',async()=>{
  const {bytes,json}=binary(PLAYER_ASSET_PATH),scene=(await new GLTFLoader().parseAsync(geometryOnly(bytes,json),'')).scene;
  const rig=rigCanonicalPlayer(scene,'#00a8d6');expect(rig.wheels).toHaveLength(4);expect(rig.windows.length).toBeGreaterThan(0);expect(rig.headlamps.length).toBeGreaterThan(0);
  expect(rig.wipers.every(w=>w.children.some(c=>/GEO_Wiper[25]/.test(c.name)))).toBe(true);
  expect(rig.eye.toArray().every(Number.isFinite)).toBe(true);
 });
 it('retains the canonical GT3 cockpit, wipers, mirror UV meshes and driver eye metadata',()=>{
  const{json}=binary(PLAYER_ASSET_PATH),root=json.nodes.find(n=>n.extras?.playerRig);expect(root?.extras?.eye).toBeInstanceOf(Array);expect(root?.extras?.scale).toBeTypeOf('number');
  for(const name of[...wheels,'Steering','Wiper_0','Wiper_1','Mirror_Center','Mirror_Left','Mirror_Right'])expect(json.nodes.some(n=>n.name===name),name).toBe(true);
  expect(json.nodes.some(n=>n.name?.includes('GEO_Wiper2'))).toBe(true);expect(json.nodes.some(n=>n.name?.includes('GEO_Wiper5'))).toBe(true);
 });
});
