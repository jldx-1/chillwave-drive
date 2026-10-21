import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DriveCamera } from '../src/drive/camera';
import { Vehicle } from '../src/drive/vehicle';
import { BoostEffects } from '../src/drive/boost-effects';
import { STEP, neutral } from '../src/drive/config';

describe('steady cockpit and punchy boost',()=>{
  it('keeps a level fixed eye and field of view through speed, pitch, roll and impacts',()=>{
    const camera=new DriveCamera(),car=new Vehicle(),eye=new THREE.Vector3(-.4,1.2,.2);
    for(let frame=0;frame<120;frame++){
      car.s=frame*1.1;car.speed=frame/2;car.pitch=Math.sin(frame)*.045;car.roll=Math.cos(frame)*.045;car.impact=1;
      camera.update(STEP,car,car.pose(1),0,'cockpit',false,false,eye);
      expect(camera.camera.position.y).toBe(eye.y);expect(camera.camera.fov).toBe(71);
      const direction=camera.camera.getWorldDirection(new THREE.Vector3());expect(Math.abs(direction.y)).toBeLessThan(1e-8);
    }
  });
  it('delivers the burst immediately and expires its flame cue within a third of a second',()=>{
    const car=new Vehicle();car.speed=35;expect(car.boostClosePass()).toBe(true);
    expect(car.speed).toBeCloseTo(39,8);expect(car.boostPulse).toBe(.32);
    for(let i=0;i<20;i++)car.step(STEP,neutral());
    expect(car.boostPulse).toBe(0);
    const braking=new Vehicle();braking.speed=35;braking.boostClosePass();
    braking.step(STEP,{...neutral(),brake:1});expect(braking.boostPulse).toBe(0);expect(braking.speed).toBeLessThan(39);
  });
  it('uses two bounded flame rigs behind the rear wheel mounts and fades them without flashing',()=>{
    const flames=new BoostEffects(),mounts=[new THREE.Vector3(-.78,.33,1.4),new THREE.Vector3(.78,.33,1.4)];
    flames.setMounts(mounts);
    for(let i=0;i<2;i++){
      expect(flames.group.children[i].position.x).toBe(mounts[i].x);
      expect(flames.group.children[i].position.z).toBeGreaterThan(mounts[i].z);
    }
    const geometry=(flames.group.children[0]as THREE.Mesh).geometry,material=(flames.group.children[0]as THREE.Mesh).material;
    let previous=1;
    for(let i=0;i<=20;i++){
      flames.update(Math.max(0,.32-i*STEP),i*STEP);
      expect(flames.diagnostics.strength).toBeLessThanOrEqual(previous);previous=flames.diagnostics.strength;
      expect(flames.group.children).toHaveLength(2);
      expect((flames.group.children[0]as THREE.Mesh).geometry).toBe(geometry);
      expect((flames.group.children[1]as THREE.Mesh).material).toBe(material);
    }
    expect(flames.diagnostics.visible).toBe(false);expect(geometry.attributes.position.count).toBe(8);
    flames.dispose();
  });
});
