import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { withoutColorEffects } from './stable-lighting';
import type { Quality } from './config';
export class Presentation {
  readonly composer: EffectComposer;
  private renderPass: RenderPass;
  private ao: SSAOPass;
  private bloom: UnrealBloomPass;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera); this.composer.addPass(this.renderPass);
    this.ao = new SSAOPass(scene, camera, 320, 200); this.ao.kernelRadius = 10; this.ao.minDistance = .001; this.ao.maxDistance = .05; this.composer.addPass(this.ao);
    const renderAO=this.ao.render.bind(this.ao);
    this.ao.render=(...args)=>withoutColorEffects(scene,()=>renderAO(...args));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 400), .18, .5, 1.15); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  configure(quality: Quality, width: number, height: number, ratio: number): void {
    this.composer.setPixelRatio(ratio); this.composer.setSize(width, height);
    this.ao.enabled = quality === 'ultra' || quality === 'high'; this.ao.setSize(Math.max(1, width * ratio / 2), Math.max(1, height * ratio / 2));
    this.bloom.enabled = quality !== 'low';
  }
  render(): void { this.composer.render(); }
}
