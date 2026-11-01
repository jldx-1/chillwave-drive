import * as THREE from 'three';
import {it,expect} from 'vitest';
import {MaterialLib} from '../src/drive/procedural-buildings/materials';
import {CityMaterialBatches} from '../src/drive/city-material-batches';

it('merges compatible surface draws while retaining their material parameters and shader pattern',()=>{
  const library=new MaterialLib(),batch=new CityMaterialBatches(new THREE.Group());
  const a=library.get('concrete') as THREE.MeshStandardMaterial,b=library.get('concreteDark') as THREE.MeshStandardMaterial;
  const first=new THREE.BoxGeometry(),second=new THREE.BoxGeometry();
  const combined=batch.material(a,first),same=batch.material(b,second);
  expect(same).toBe(combined);
  for(const [source,g] of [[a,first],[b,second]] as const) {
    expect(Array.from(g.attributes.aCityColor.array).slice(0,3)).toEqual(source.color.toArray().map(Math.fround));
    expect(g.attributes.aCityP0.getX(0)).toBeCloseTo(source.roughness);
    expect(g.attributes.aCityP0.getY(0)).toBeCloseTo(source.metalness);
    expect(g.attributes.aCityP1.getX(0)).toBeCloseTo(source.userData.citySurface.cell);
  }
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}} as THREE.WebGLProgramParametersWithUniforms;
  combined.onBeforeCompile(shader,{}as THREE.WebGLRenderer);
  expect((combined as THREE.MeshStandardMaterial&{defines:Record<string,number>}).defines.PATTERN).toBe(a.userData.citySurface.pattern);
  expect(shader.fragmentShader).toContain('float roughnessFactor = vCityP0.x;');
  expect(shader.fragmentShader).toContain('float metalnessFactor = vCityP0.y;');
  expect(shader.fragmentShader).not.toContain('uniform float uGrime;');
  expect(shader.vertexShader).toContain('vCityP1=aCityP1;');
  first.dispose();second.dispose();combined.dispose();
});
