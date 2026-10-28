import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {CYBER_MODEL_IDS,CYBER_VEHICLES,chooseCivilian,cyberHull} from '../src/drive/cyber-vehicles';
import {cyberPrefab,cyberPlayerPrefab} from '../src/drive/cyber-prefabs';
import {rigFleetCar,animateFleetRig,disposeFleetRig} from '../src/drive/fleet-asset';
import {rigCanonicalPlayer} from '../src/drive/car-asset';
import {Traffic} from '../src/drive/traffic';
import {VEHICLE_LAMPS} from '../src/drive/lamp-levels';

describe('authored futuristic fleet',()=>{
  it('builds fifteen distinct native-scale bodies with finite geometry, real wheels and cheaper distant LODs',()=>{
    const signatures=new Set<string>();
    for(const id of CYBER_MODEL_IDS){
      const spec=CYBER_VEHICLES[id],counts:number[]=[];
      for(const lod of [0,1,2]as const){
        const source=cyberPrefab(id,lod),box=new THREE.Box3().setFromObject(source),size=box.getSize(new THREE.Vector3()),hash=createHash('sha256');let vertices=0;
        source.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');vertices+=p.count;expect(Array.from(p.array).every(Number.isFinite),id).toBe(true);hash.update(new Uint8Array(p.array.buffer,p.array.byteOffset,p.array.byteLength));}});
        counts.push(vertices);if(lod===0)signatures.add(hash.digest('hex'));
        const body=source.children.find(o=>o instanceof THREE.Mesh&&(o.material as THREE.Material).userData.vehicleRole==='paint') as THREE.Mesh;
        const normals=body.geometry.getAttribute('normal');
        expect(normals.getX(1),`${id}: left body surface faces outward`).toBeLessThan(-.05);
        expect(normals.getZ(0),`${id}: front cap faces forward`).toBeLessThan(0);
        expect(box.min.y,id).toBeGreaterThanOrEqual(-.01);expect(size.z,id).toBeGreaterThan(spec.length-.1);expect(size.z,id).toBeLessThan(spec.length+.2);
        expect(size.x,id).toBeGreaterThan(spec.width-.1);expect(size.x,id).toBeLessThan(spec.width+.35);
        expect(size.y,id).toBeGreaterThan(spec.height-.12);expect(size.y,id).toBeLessThan(spec.height+.45);
        const rig=rigFleetCar(source,id,spec.colors[0]);expect(rig.wheels.length,id).toBe(spec.axles.length*2);
        if(id==='orbit')expect(rig.unique.some(m=>m.userData.vehicleRole==='glass'&&m.transparent)).toBe(true);
        expect(rig.lamps.head.length,id).toBeGreaterThan(0);expect(rig.lamps.brake.length,id).toBeGreaterThan(0);
        expect(rig.paint.length,id).toBeGreaterThan(0);
        for(const wheel of rig.wheels){const b=new THREE.Box3().setFromObject(wheel);expect(b.min.y,id).toBeCloseTo(.012,2);}
        disposeFleetRig(rig);
      }
      expect(counts[0],id).toBeLessThan(35000);expect(counts[2],id).toBeLessThan(counts[0]*.7);
      expect(cyberHull(id).every(([x,z])=>Math.abs(x)<=spec.width/2&&Math.abs(z)<=spec.length/2)).toBe(true);
    }
    expect(signatures.size).toBe(15);
  });
  it('provides detailed non-emissive bodywork while retaining economical distant models',()=>{
    for(const id of CYBER_MODEL_IDS){
      const near=cyberPrefab(id,0),far=cyberPrefab(id,2),panels:THREE.Mesh[]=[];
      near.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.Material).userData.vehicleRole==='carbon')panels.push(o);});
      expect(panels.length,id).toBeGreaterThan(0);
      expect(panels.every(mesh=>(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity===1&&(mesh.material as THREE.MeshStandardMaterial).emissive.getHex()===0),id).toBe(true);
      let farCarbon=0;far.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.Material).userData.vehicleRole==='carbon')farCarbon++;});expect(farCarbon,id).toBe(0);
    }
  });
  it('keeps head and tail lights visible at every detail level and brightens them under braking',()=>{
    for(const id of CYBER_MODEL_IDS)for(const lod of [0,1,2] as const){
      const source=cyberPrefab(id,lod),rig=rigFleetCar(source,id,CYBER_VEHICLES[id].colors[0]);
      const lights=rig.lamps;expect(lights.head.every(m=>m.emissiveIntensity===VEHICLE_LAMPS.head)).toBe(true);
      expect(lights.brake.every(m=>m.emissiveIntensity===VEHICLE_LAMPS.tail)).toBe(true);
      animateFleetRig(rig,0,0,20,0,true,false);
      expect(lights.brake.every(m=>m.emissiveIntensity===VEHICLE_LAMPS.brake)).toBe(true);
      disposeFleetRig(rig);
    }
  });
  it('animates independent brake/turn/reverse/emergency circuits and six-axle trailer geometry',()=>{
    const a=rigFleetCar(cyberPrefab('vortex'),'vortex','#000000'),b=rigFleetCar(cyberPrefab('vortex'),'vortex','#000000');
    animateFleetRig(a,.1,0,30,.2,true,true,-1);
    expect(a.lamps.brake[0].emissiveIntensity).toBe(VEHICLE_LAMPS.brake);expect(b.lamps.brake[0].emissiveIntensity).toBe(VEHICLE_LAMPS.tail);
    expect(a.lamps.red[0].emissiveIntensity).toBe(5);expect(a.lamps.blue[0].emissiveIntensity).toBe(0);
    expect(a.lamps.turn.find(m=>m.userData.vehicleSide==='left')!.emissiveIntensity).toBe(4);
    expect(a.lamps.turn.find(m=>m.userData.vehicleSide==='right')!.emissiveIntensity).toBe(0);
    animateFleetRig(a,.1,.4,-2,0,false,true);expect(a.lamps.reverse[0].emissiveIntensity).toBe(2);expect(a.lamps.blue[0].emissiveIntensity).toBe(5);
    const t=rigFleetCar(cyberPrefab('titan'),'titan','#335577');expect(t.wheels).toHaveLength(12);expect(t.trailer).toBeDefined();
    const original=t.trailer!.rotation.y;animateFleetRig(t,.3,0,20,.2,false,false);expect(t.trailer!.rotation.y).not.toBe(original);
    expect(t.trailer!.children.filter(c=>c.userData.vehicleWheel)).toHaveLength(6);
    const straight=cyberHull('titan'),turning=cyberHull('titan',.07);
    expect(Math.max(...turning.map(([x])=>x))).toBeGreaterThan(Math.max(...straight.map(([x])=>x)));
    expect(cyberHull('titan',.07)).toBe(turning);
    [a,b,t].forEach(disposeFleetRig);
  });
  it('provides a working player cockpit, independent mirrored glazing, wipers and the same native exterior',()=>{
    const rig=rigCanonicalPlayer(cyberPlayerPrefab(),'#00a8d6');
    expect(rig.group.name).toBe('NEBULA XR');expect(rig.wheels).toHaveLength(4);expect(rig.wipers).toHaveLength(2);
    expect(rig.wipers.every(w=>w.children.some(c=>/GEO_Wiper[25]/.test(c.name)))).toBe(true);
    expect(rig.eye.y).toBeGreaterThan(rig.steering.position.y);expect(rig.windows.length).toBeGreaterThan(0);
    expect(rig.lamps.length).toBeGreaterThan(0);expect(rig.headlamps.length).toBeGreaterThan(0);rig.unique.forEach(m=>m.dispose());
  });
  it('weights everyday traffic ahead of rare heavy/sports models and keeps police out of civilian spawning',()=>{
    const counts=new Map<string,number>();for(let i=0;i<12000;i++){const s=chooseCivilian(i/12000);counts.set(s.id,(counts.get(s.id)??0)+1);expect(s.emergency).not.toBe('police');}
    expect(counts.size).toBe(11);expect(counts.get('lumen')!).toBeGreaterThan(counts.get('titan')!*20);expect(counts.get('lumen')!).toBeGreaterThan(counts.get('vector')!*10);
    const t=new Traffic('CYBER-FLEET','dense');t.reset();
    for(const a of t.agents){expect(a.model).toBeDefined();const s=CYBER_VEHICLES[a.model!];expect(a.width).toBe(s.width);expect(a.length).toBe(s.length);}
    expect(t.agents.filter(a=>a.kind==='police').every(a=>CYBER_VEHICLES[a.model!].emergency==='police')).toBe(true);
  });
});
