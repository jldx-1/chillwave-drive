import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {rigCanonicalPlayer} from '../src/drive/car-asset';
import {cyberPlayerPrefab,cyberPrefab} from '../src/drive/cyber-prefabs';
import {rigFleetCar,disposeFleetRig} from '../src/drive/fleet-asset';
import {VEHICLE_LAMPS} from '../src/drive/lamp-levels';

describe('automotive finishes and visible lighting',()=>{
  it('keeps layered paint, glass and alloy physically distinct on independent rigs',()=>{
    const rig=rigFleetCar(cyberPrefab('nebula'),'nebula','#00a8d6');
    expect(rig.paint.every(m=>m.clearcoat>.9&&m.roughness<.3&&m.metalness<.7)).toBe(true);
    const glass=rig.unique.find(m=>m.userData.vehicleRole==='glass') as THREE.MeshPhysicalMaterial;
    const alloy=rig.unique.find(m=>m.userData.vehicleRole==='metal') as THREE.MeshPhysicalMaterial;
    expect(glass.metalness).toBeLessThan(.2);expect(glass.roughness).toBeLessThan(.1);
    expect(alloy.metalness).toBeGreaterThan(.85);
    const accent=rig.unique.find(m=>m.userData.vehicleRole==='accent') as THREE.MeshStandardMaterial;
    expect(accent.emissiveIntensity).toBeGreaterThan(2);
    expect(VEHICLE_LAMPS.brake).toBeGreaterThan(VEHICLE_LAMPS.tail*2);
    disposeFleetRig(rig);
  });
  it('preserves player damage and wet paint hooks alongside the metallic finish',()=>{
    const rig=rigCanonicalPlayer(cyberPlayerPrefab(),'#00a8d6');
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
    rig.paint[0].onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('damageAmount');
    expect(shader.fragmentShader).toContain('roughnessFactor=mix');
    expect(shader.fragmentShader).toContain('finishAA');
    expect(rig.windows.every(m=>m.transparent&&m.metalness<.2)).toBe(true);
    rig.unique.forEach(m=>m.dispose());
  });
});
