import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHash } from 'node:crypto';
import { COLLISION_PROFILES } from '../src/drive/collision-profiles';
import { VEHICLE_CATALOG, PLAYER_ASSET_PATH } from '../src/drive/vehicle-catalog';
import { binary, geometryOnly } from './helpers/vehicle-glb';
describe('model-fitted collision footprints',()=>{
 for(const [kind,profile]of Object.entries(COLLISION_PROFILES))it(kind+' follows actual bumper/fender geometry with no stale asset measurements',async()=>{
  const path=kind==='player'?PLAYER_ASSET_PATH:VEHICLE_CATALOG[kind as keyof typeof VEHICLE_CATALOG].path;
  const {bytes,json}=binary(path);expect(createHash('sha256').update(bytes).digest('hex')).toBe(profile.sourceSha256);
  const scene=(await new GLTFLoader().parseAsync(geometryOnly(bytes,json),'')).scene;scene.updateMatrixWorld(true);
  const points:THREE.Vector2[]=[];
  scene.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   for(let parent:THREE.Object3D|null=o;parent;parent=parent.parent)if(/^(?:Wheel_|Spin|Mirror_|Wiper_|Steering)/i.test(parent.name))return;
   const material=Array.isArray(o.material)?o.material[0]:o.material;
   if(!['paint','trim','metal','head','brake'].includes(material.userData.vehicleRole))return;
   const positions=o.geometry.getAttribute('position');
   for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(p.y>=.18&&p.y<=profile.height)points.push(new THREE.Vector2(p.x,-p.z));}
  });
  expect(points.length).toBeGreaterThan(100);
  for(const [x,s]of profile.hull)expect(points.some(p=>Math.hypot(x-p.x,s-p.y)<.0002)).toBe(true);
  // Simplification may trim at most 20 mm of insignificant surface detail.
  for(let i=0;i<profile.hull.length;i++){
   const a=profile.hull[i],b=profile.hull[(i+1)%profile.hull.length],dx=b[0]-a[0],ds=b[1]-a[1],length=Math.hypot(dx,ds);
   expect(length).toBeGreaterThan(0);
   const distance=Math.min(...points.map(p=>(dx*(p.y-a[1])-ds*(p.x-a[0]))/length));
   expect(distance).toBeGreaterThan(-.021);
  }
  expect(profile.width).toBeCloseTo(Math.max(...profile.hull.map(p=>p[0]))-Math.min(...profile.hull.map(p=>p[0])),8);
 });
});
