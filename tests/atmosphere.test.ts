import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { CityAtmosphere,mistOpacity,sunsetScreenPosition,cityMistCoverage,CITY_MIST_END,sunsetDirection } from '../src/drive/atmosphere';
import { DriveCamera } from '../src/drive/camera';
import { Vehicle } from '../src/drive/vehicle';
import { CITY_CHUNK,CITY_STREAM_BEHIND,CITY_STREAM_AHEAD } from '../src/drive/world-layout';
import { STEP } from '../src/drive/config';
import { withoutColorEffects } from '../src/drive/stable-lighting';

describe('street mist and permanent neon sunset',()=>{
  it('keeps foreground haze gentle while progressively covering distant ground and clearing above the mist',()=>{
    expect(mistOpacity(0,3,3)).toBe(0);
    expect(mistOpacity(20,3,3)).toBeLessThan(.025);
    expect(mistOpacity(250,3,3)).toBeGreaterThan(.15);
    expect(mistOpacity(700,3,3)).toBeGreaterThan(mistOpacity(250,3,3));
    expect(mistOpacity(250,3,180)).toBeLessThan(mistOpacity(250,3,3)*.2);
    expect(mistOpacity(250,3,3.00001)).toBeCloseTo(mistOpacity(250,3,3),6);
  });
  it('fully hides both streamed edges before chunks can enter or leave a forward or rear view',()=>{
    expect(cityMistCoverage(420)).toBe(0);expect(cityMistCoverage(CITY_MIST_END)).toBe(1);
    for(let offset=0;offset<CITY_CHUNK;offset++) {
      const behind=CITY_STREAM_BEHIND*CITY_CHUNK+offset-18;
      const ahead=(CITY_STREAM_AHEAD+1)*CITY_CHUNK-offset-18;
      expect(cityMistCoverage(behind)).toBe(1);expect(cityMistCoverage(ahead)).toBe(1);
    }
    expect(CITY_STREAM_BEHIND+CITY_STREAM_AHEAD+1).toBe(14);
  });
  it('fixes the sunset to the forward world bearing, with perspective changes and no rear-view sun',()=>{
    const camera=new DriveCamera(),car=new Vehicle();
    for(const [w,h]of [[960,540],[390,844],[844,390]])for(const view of ['chase','cockpit']as const)for(const rear of [false,true]) {
      camera.reset();camera.resize(w,h);car.speed=75;car.s=1012;
      camera.update(STEP,car,{...car.pose(1),s:1012,yaw:0},1000,view,rear,true);
      const atmosphere=new CityAtmosphere();atmosphere.inspectView(camera.camera);
      expect(atmosphere.diagnostics.sunsetInView).toBe(!rear);
      expect(atmosphere.diagnostics.sunsetDepthTest).toBe(true);
      if(!rear) {const sun=sunsetScreenPosition(camera.camera);expect(Math.abs(sun.x)).toBeLessThan(.04);expect(sun.y).toBeGreaterThan(0);expect(sun.y).toBeLessThan(.75);}
      atmosphere.sky.geometry.dispose();(atmosphere.sky.material as THREE.Material).dispose();
    }
    camera.reset();camera.update(STEP,car,{...car.pose(1),yaw:0},1000,'chase',false,true);
    const before=sunsetScreenPosition(camera.camera);
    camera.reset();camera.update(STEP,car,{...car.pose(1),yaw:.3},1000,'chase',false,true);
    expect(Math.abs(sunsetScreenPosition(camera.camera).x-before.x)).toBeGreaterThan(.1);
    expect(sunsetDirection().x).toBe(0);expect(sunsetDirection().z).toBeLessThan(-.99);
  });
  it('retains existing material shaders, marks mist only once, and excludes the sunset from AO',()=>{
    const scene=new THREE.Scene(),atmosphere=new CityAtmosphere();
    const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);
    let previousCalls=0;material.onBeforeCompile=()=>{previousCalls++;};scene.add(mesh,atmosphere.sky);
    atmosphere.apply(scene);const version=material.version;atmosphere.apply(scene);expect(material.version).toBe(version);
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <fog_vertex>',fragmentShader:'#include <common>\n#include <fog_fragment>'} as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader,{}as THREE.WebGLRenderer);expect(previousCalls).toBe(1);
    expect(shader.fragmentShader).toContain('combinedFog');
    expect(shader.fragmentShader).toContain('cityFogSkyColor');expect(shader.fragmentShader).not.toContain('sunAxis');expect(shader.fragmentShader).not.toContain('sunColor');
    expect((atmosphere.sky.material as THREE.ShaderMaterial).fragmentShader).toContain('sunAxis');expect(shader.vertexShader).toContain('instanceMatrix*mistVertex');
    atmosphere.update(1000);expect(shader.uniforms.mistOrigin.value).toBe(1000);
    expect(atmosphere.diagnostics.sunsetDepthTest).toBe(true);
    withoutColorEffects(scene,()=>{expect(atmosphere.sky.visible).toBe(false);expect(mesh.visible).toBe(true);});
    expect(atmosphere.sky.visible).toBe(true);
    scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
  });
});
