import * as THREE from 'three';
import { wetSurfaceGLSL } from './wet-surface';
/** Shared world-distance UVs preserve the wetness field through seams and origin shifts. */
export function neonRoad(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n'+wetSurfaceGLSL);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      vec2 roadPoint=vMapUv*8.;vec3 wetState=roadWetState(roadPoint);
      roughnessFactor=clamp(wetState.z*(.8+roughnessFactor*.6),.035,.72);
      diffuseColor.rgb*=mix(.78,.48,wetState.x)+wetState.y*.08;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float roadX=roadPoint.x, roadS=roadPoint.y;
      float cell=mod(roadS,40.)-20.;float streak=exp(-cell*cell/110.);
      float breakup=.25+.75*wetNoise(roadPoint*vec2(1.2,.38));
      float cyan=exp(-pow((abs(roadX)-13.5)*.8,2.))+.25*exp(-pow((abs(roadX)-5.2)*1.4,2.));
      float pink=exp(-pow((abs(roadX)-9.4)*.85,2.))+.35*exp(-pow((abs(roadX)-15.5)*1.4,2.));
      float a=abs(mod(roadS-12.+60.,120.)-60.);
      float c=abs(mod(roadS-48.+60.,120.)-60.);
      float d=abs(mod(roadS-84.+60.,120.)-60.);
      float nearestLamp=min(a,min(c,d));
      float lamp=exp(-nearestLamp*nearestLamp/65.)*exp(-pow((abs(roadX)-13.5)*.32,2.));
      float roadMask=1.-smoothstep(16.,18.,abs(roadX));
      totalEmissiveRadiance+=roadMask*(.45+wetState.y*.55)*breakup*(
        vec3(.01,.12,.26)*cyan*(.25+.75*streak)+vec3(.23,.005,.1)*pink*(1.-streak*.65)+vec3(.32,.14,.045)*lamp);
    `);
  };
  material.customProgramCacheKey = () => 'wet-asphalt-v2';
}
