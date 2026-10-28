import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { withoutColorEffects } from './stable-lighting';
import { CITY_MIST_START } from './atmosphere';
import type { Quality } from './config';
export class Presentation {
  readonly composer: EffectComposer;
  private renderPass: RenderPass;
  private ao: SSAOPass;
  private bloom: UnrealBloomPass;
  private sampleLimit: number;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    // Canvas antialiasing does not apply to the composer's offscreen scene buffers.
    this.sampleLimit = Math.min(4, renderer.capabilities.maxSamples);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.sampleLimit });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera); this.composer.addPass(this.renderPass);
    this.ao = new SSAOPass(scene, camera, 320, 200); this.ao.kernelRadius = 10; this.ao.minDistance = .001; this.ao.maxDistance = .05; this.composer.addPass(this.ao);
    // Occlusion must disappear inside the mist too; otherwise invisible distant hulls leave outlines.
    this.ao.ssaoMaterial.fragmentShader=this.ao.ssaoMaterial.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );',
      `float mistAoFade=1.-smoothstep(160.,${CITY_MIST_START.toFixed(1)},length(viewPosition));
       gl_FragColor=vec4(vec3(1.-occlusion*mistAoFade),1.);`);
    const renderAO=this.ao.render.bind(this.ao);
    this.ao.render=(...args)=>withoutColorEffects(scene,()=>renderAO(...args));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 400), .32, .6, 1.1); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  configure(quality: Quality, width: number, height: number, ratio: number): void {
    const samples = Math.min(quality === 'high' || quality === 'ultra' ? 4 : 2, this.sampleLimit);
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) if (target.samples !== samples) { target.dispose(); target.samples = samples; }
    this.composer.setPixelRatio(ratio); this.composer.setSize(width, height);
    this.ao.enabled = quality === 'ultra' || quality === 'high'; this.ao.setSize(Math.max(1, Math.floor(width * ratio / 2)), Math.max(1, Math.floor(height * ratio / 2)));
    this.bloom.enabled = quality !== 'low';
  }
  render(): void {
    // SSAOPass only refreshes these during setSize; our camera changes FOV every frame.
    const uniforms = this.ao.ssaoMaterial.uniforms;
    uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    uniforms.cameraNear.value = this.camera.near; uniforms.cameraFar.value = this.camera.far;
    this.ao.depthRenderMaterial.uniforms.cameraNear.value = this.camera.near;
    this.ao.depthRenderMaterial.uniforms.cameraFar.value = this.camera.far;
    this.composer.render();
  }
  get diagnostics() {
    return { samples: this.composer.renderTarget1.samples, ao: this.ao.enabled,
      projectionMatches: this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.equals(this.camera.projectionMatrix) &&
        this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.equals(this.camera.projectionMatrixInverse),
      near: this.ao.ssaoMaterial.uniforms.cameraNear.value };
  }
}
