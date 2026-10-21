import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StableSunShadow, colorPassReflection, withoutColorEffects } from '../src/drive/stable-lighting';
import { VehicleLighting } from '../src/drive/vehicle-lighting';
import { Traffic, type Agent } from '../src/drive/traffic';

function cars():Agent[]{
  const traffic=new Traffic('LIGHTS','low');traffic.reset();
  const source=traffic.agents.find(a=>a.kind==='police')!;
  return [10,11,40].map((s,id)=>({...source,id,s,oldS:s,x:6.5,oldX:6.5,yaw:0,active:true}));
}
describe('stable sunlight and reflection passes',()=>{
  it('anchors shadow projection texels in world space instead of crawling with the camera',()=>{
    const sun=new StableSunShadow();sun.update(8.31,1034.71,1000);
    const before=sun.target.position.clone(),basis=new THREE.Matrix4().lookAt(sun.light.position,sun.target.position,THREE.Object3D.DEFAULT_UP);
    sun.update(8.3100001,1034.7100001,1000);
    const movement=sun.target.position.clone().sub(before);
    for(const column of [0,1])expect(Math.abs(movement.dot(new THREE.Vector3().setFromMatrixColumn(basis,column)))).toBeLessThan(1e-8);
  });
  it('keeps world lighting and direction unchanged through an origin rebase',()=>{
    const sun=new StableSunShadow();sun.update(8.3,1000.1,0);
    const before=sun.target.position.clone(),direction=sun.light.position.clone().sub(sun.target.position);
    sun.update(8.3,1000.1,1000);
    expect(sun.target.position.x).toBeCloseTo(before.x,8);expect(sun.target.position.z-before.z).toBeCloseTo(1000,8);
    expect(sun.light.position.clone().sub(sun.target.position).distanceTo(direction)).toBeLessThan(1e-8);
    expect(sun.light.position.y).toBeGreaterThan(200);expect(sun.light.shadow.camera.far).toBe(900);expect(sun.light.intensity).toBe(3);
  });
  it('does not overwrite a color reflection during a normal or depth pass',()=>{
    const object=new THREE.Object3D(),scene=new THREE.Scene();let updates=0;
    object.onBeforeRender=()=>{updates++;};colorPassReflection(object);
    const renderer={} as THREE.WebGLRenderer,camera=new THREE.PerspectiveCamera(),geometry=new THREE.PlaneGeometry(),material=new THREE.MeshBasicMaterial();
    object.onBeforeRender(renderer,scene,camera,geometry,material,null!);expect(updates).toBe(1);
    scene.overrideMaterial=new THREE.MeshNormalMaterial();
    object.onBeforeRender(renderer,scene,camera,geometry,material,null!);expect(updates).toBe(1);
    scene.overrideMaterial=new THREE.MeshDepthMaterial();
    object.onBeforeRender(renderer,scene,camera,geometry,material,null!);expect(updates).toBe(1);
    scene.overrideMaterial=null;object.onBeforeRender(renderer,scene,camera,geometry,material,null!);expect(updates).toBe(2);
    geometry.dispose();material.dispose();
  });
});
describe('fluid traffic illumination',()=>{
  it('crossfades police spill continuously across the lightbar phase boundary',()=>{
    const lighting=new VehicleLighting(),agents=cars().slice(0,1);
    for(let i=0;i<120;i++)lighting.update(agents,0,0,.299,'high',1/60);
    const red=lighting.group.children[0]as THREE.PointLight,blue=lighting.group.children[1]as THREE.PointLight;
    const previous=[red.intensity,blue.intensity],total=red.intensity+blue.intensity;
    lighting.update(agents,0,0,.301,'high',.002);
    expect(total).toBeCloseTo(46,4);expect(red.intensity+blue.intensity).toBeCloseTo(total,4);
    expect(Math.abs(red.intensity-previous[0])).toBeLessThan(.02);expect(Math.abs(blue.intensity-previous[1])).toBeLessThan(.02);
  });
  it('does not swap equally close headlight owners and fades to zero before assigning a nearer car',()=>{
    const lighting=new VehicleLighting(),agents=cars();
    for(let i=0;i<120;i++)lighting.update(agents,0,0,i/60,'high');
    const beam=lighting.group.children[4]as THREE.SpotLight;
    expect(beam.intensity).toBeGreaterThan(21);
    // Reordering candidates does not move an assigned beam.
    lighting.update([...agents].reverse(),0,0,2,'high');expect(beam.position.z).toBeCloseTo(-12.2,8);
    agents[0].s=agents[0].oldS=60;agents[2].s=agents[2].oldS=0;
    let reassigned=false;
    for(let i=0;i<90;i++){
      lighting.update(agents,0,0,2+i/60,'high');
      if(Math.abs(beam.position.z+2.2)<1e-6){expect(beam.intensity).toBe(0);reassigned=true;break;}
    }
    expect(reassigned).toBe(true);
    lighting.update(agents,0,0,4,'high');expect(beam.intensity).toBeGreaterThan(0);expect(beam.intensity).toBeLessThan(4);
  });
  it('fades range limits and preserves fading lights across origin rebases',()=>{
    const lighting=new VehicleLighting(),agents=cars().slice(0,1);
    for(let i=0;i<120;i++)lighting.update(agents,0,0,i/60,'high');
    const beam=lighting.group.children[4]as THREE.SpotLight,before=beam.intensity,z=beam.position.z;
    lighting.update([],0,1000,2,'high');
    expect(beam.intensity).toBeLessThan(before);expect(beam.intensity).toBeGreaterThan(before*.8);
    expect(beam.position.z-z).toBe(1000);
    for(let i=0;i<120;i++)lighting.update([],0,1000,2+i/60,'high');
    expect(beam.intensity).toBeLessThan(.01);
  });
  it('positions moving illumination at the interpolated car pose',()=>{
    const lighting=new VehicleLighting(),agents=cars().slice(0,1);
    Object.assign(agents[0],{oldX:3,x:7,oldS:36,s:40});
    lighting.update(agents,0,0,0,'high',1/60,.25);
    const beam=lighting.group.children[4]as THREE.SpotLight;
    expect(beam.position.x).toBe(4);expect(beam.position.z).toBeCloseTo(-39.2,8);
  });
});

it('excludes color effects from auxiliary depth and restores visibility even on failure',()=>{
  const scene=new THREE.Scene(),glaze=new THREE.Mesh(),fire=new THREE.Group(),hidden=new THREE.Mesh(),building=new THREE.Mesh();
  glaze.userData.colorOnly=true;fire.userData.colorOnly=true;hidden.userData.colorOnly=true;hidden.visible=false;
  scene.add(glaze,fire,hidden,building);
  expect(()=>withoutColorEffects(scene,()=>{
    expect(glaze.visible).toBe(false);expect(fire.visible).toBe(false);expect(building.visible).toBe(true);
    throw new Error('auxiliary pass failed');
  })).toThrow('auxiliary pass failed');
  expect(glaze.visible).toBe(true);expect(fire.visible).toBe(true);expect(hidden.visible).toBe(false);
});
