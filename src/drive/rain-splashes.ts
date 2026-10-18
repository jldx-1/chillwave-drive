import * as THREE from 'three';
import { sceneZ } from './road';
import { rainSheltered } from './weather';
/** Tiny horizontal ripple rings, anchored to road cells instead of floating with the car. */
export class RainSplashes {
  readonly mesh: THREE.InstancedMesh;
  private ages = new Float32Array(96);
  private transform = new THREE.Object3D();
  constructor() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute('splashAge', new THREE.InstancedBufferAttribute(this.ages, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `attribute float splashAge; varying vec2 splashUV; varying float age;
        #include <fog_pars_vertex>
        void main(){splashUV=uv;age=splashAge;vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `varying vec2 splashUV;varying float age;
        #include <fog_pars_fragment>
        void main(){float radius=length(splashUV-.5);float ring=1.-smoothstep(.025,.065,abs(radius-.38));
          gl_FragColor=vec4(.6,.7,.78,ring*(1.-age)*.16);
          #include <fog_fragment>
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, 96); this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  update(time: number, s: number, origin: number, reduced: boolean): void {
    let count = 0;
    if (!reduced) for (let i = 0; i < 96; i++) {
      const worldS = Math.floor(s / 6) * 6 + (i % 16) * 6 - 12;
      const seed = Math.sin(worldS * 12.9898 + Math.floor(i / 16) * 78.233) * 43758.5453;
      const random = seed - Math.floor(seed), x = Math.floor(i / 16) * 5 - 14 + random * 3;
      const phase = ((time * 1.7 + random * 11) % 1 + 1) % 1;
      if (phase > .3 || rainSheltered(x, worldS)) continue;
      const radius = .035 + phase * .27;
      this.transform.position.set(x, .018, sceneZ(worldS + random * 4, origin)); this.transform.rotation.x = -Math.PI / 2;
      this.transform.scale.setScalar(radius * 2); this.transform.updateMatrix(); this.mesh.setMatrixAt(count, this.transform.matrix);
      this.ages[count++] = phase / .3;
    }
    this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.getAttribute('splashAge').needsUpdate = true;
  }
}
