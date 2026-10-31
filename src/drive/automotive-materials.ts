import * as THREE from 'three';

/** Layered automotive finishes with no extra textures or per-car reflection passes. */
export function automotiveFinish(material: THREE.MeshStandardMaterial, role: string): void {
  if(material.userData.automotiveFinish) return;
  material.userData.automotiveFinish = true;
  if(role === 'paint' && material instanceof THREE.MeshPhysicalMaterial) {
    material.metalness = .48; material.roughness = .24;
    material.clearcoat = 1; material.clearcoatRoughness = .09;
    material.ior = 1.5; material.envMapIntensity = 1.5;
    const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader,renderer) => {
      previous.call(material,shader,renderer);
      shader.vertexShader = 'varying vec3 automotivePosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nautomotivePosition=position;');
      shader.fragmentShader = 'varying vec3 automotivePosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        vec3 finishCell=automotivePosition*720.;
        float finishAA=1.-smoothstep(.3,1.2,length(fwidth(finishCell)));
        float flake=fract(sin(dot(floor(finishCell),vec3(12.9898,78.233,37.719)))*43758.5453);
        roughnessFactor=clamp(roughnessFactor+(flake-.5)*.045*finishAA,.12,.42);
      `);
    };
    material.customProgramCacheKey=()=>key+':automotive-metallic-v1';
  } else if(role === 'glass' || role === 'window') {
    material.metalness = .08; material.roughness = .065; material.envMapIntensity = 1.65;
    if(material instanceof THREE.MeshPhysicalMaterial) {
      material.ior = 1.52; material.clearcoat = 1; material.clearcoatRoughness = .045;
    }
  } else if(role === 'metal') {
    material.metalness = .94; material.roughness = .23; material.envMapIntensity = 1.25;
  } else if(role === 'rotor') {
    material.color.set('#65717b'); material.metalness = .85; material.roughness = .42;
  } else if(role === 'rubber' || role === 'tire') {
    material.metalness = 0; material.roughness = .87;
  } else if(role === 'carbon' || role === 'trim') {
    material.metalness = .08; material.roughness = role === 'carbon' ? .48 : .6;
  } else if(role === 'lens') {
    material.metalness = 0; material.roughness = .045; material.envMapIntensity = 1.4;
  }
}
