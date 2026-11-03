import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CITY_MIST_START } from './atmosphere';
import type { Quality } from './config';
export class Presentation {
  readonly composer: EffectComposer;
  private renderPass: RenderPass;
  private ao: GTAOPass;
  private bloom: UnrealBloomPass;
  private sampleLimit: number;
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    // Canvas antialiasing does not apply to the composer's offscreen scene buffers.
    this.sampleLimit = Math.min(4, renderer.capabilities.maxSamples);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.sampleLimit });
    target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera); this.composer.addPass(this.renderPass);
    // Reuse resolved scene depth instead of drawing the entire city again for a normal/depth buffer.
    this.ao = new GTAOPass(scene,camera,320,200);
    this.ao.updateGtaoMaterial({radius:2,thickness:1.5,samples:16});
    this.ao.updatePdMaterial({radius:4,depthPhi:2,normalPhi:3});
    // A two-pixel baseline stabilizes depth-derived normals with the cockpit's .035m near plane.
    // Keep the discontinuity-aware side selection, so silhouettes remain sharp.
    for(const material of [this.ao.gtaoMaterial,this.ao.pdMaterial]) {
      for(const [from,to] of [['ivec2(2, 0)','ivec2(4, 0)'],['ivec2(0, 2)','ivec2(0, 4)'],['ivec2(1, 0)','ivec2(2, 0)'],['ivec2(0, 1)','ivec2(0, 2)'],['vec2(1.0 / size.x, 0.0)','vec2(2.0 / size.x, 0.0)'],['vec2(0.0, 1.0 / size.y)','vec2(0.0, 2.0 / size.y)']])
        material.fragmentShader=material.fragmentShader.replaceAll(from,to);
    }
    this.ao.gtaoMaterial.fragmentShader=this.ao.gtaoMaterial.fragmentShader.replace(
      'ao = pow(ao, scale);',
      `ao = pow(ao, scale);ao=mix(1.,ao,1.-smoothstep(160.,${CITY_MIST_START.toFixed(1)},length(viewPos)));`);
    const renderAO=this.ao.render.bind(this.ao);
    // Post AO should shade ambient surfaces without pulsing self-lit rooms and neon.
    // Use the linear HDR color to protect bright light sources during the composite.
    this.ao.blendMaterial.uniforms.tScene={value:null};
    this.ao.blendMaterial.fragmentShader='uniform sampler2D tScene;\n'+this.ao.blendMaterial.fragmentShader;
    this.ao.blendMaterial.fragmentShader=this.ao.blendMaterial.fragmentShader.replace(
      'gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);',
      `vec3 sceneLight=texture2D(tScene,vUv).rgb;
       float lightProtection=smoothstep(.02,.12,max(sceneLight.r,max(sceneLight.g,sceneLight.b)));
       gl_FragColor=vec4(mix(vec3(1.),texel.rgb,intensity*(1.-lightProtection)),texel.a);`);
    this.ao.render=(renderer,write,read,delta,mask)=>{
      this.ao.setGBuffer(read.depthTexture!);
      this.ao.blendMaterial.uniforms.tScene.value=read.texture;
      renderAO(renderer,write,read,delta,mask);
    };
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 400), .48, .55, .95); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  configure(quality: Quality, width: number, height: number, ratio: number): void {
    const samples = Math.min(quality === 'high' || quality === 'ultra' ? 4 : 2, this.sampleLimit);
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) if (target.samples !== samples) { target.dispose(); target.samples = samples; }
    this.composer.setPixelRatio(ratio); this.composer.setSize(width, height);
    this.ao.enabled = quality === 'ultra' || quality === 'high'; this.ao.setSize(Math.max(1, Math.floor(width * ratio / 2)), Math.max(1, Math.floor(height * ratio / 2)));
    this.bloom.enabled = quality !== 'low' && quality !== 'potato';
  }
  render(): void {
    // Keep diagnostics and all AO projections current even when this preset bypasses AO.
    const uniforms = this.ao.gtaoMaterial.uniforms;
    uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
    uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
    uniforms.cameraNear.value = this.camera.near; uniforms.cameraFar.value = this.camera.far;
    this.ao.depthRenderMaterial.uniforms.cameraNear.value = this.camera.near;
    this.ao.depthRenderMaterial.uniforms.cameraFar.value = this.camera.far;
    this.composer.render();
  }
  get diagnostics() {
    return { samples: this.composer.renderTarget1.samples, ao: this.ao.enabled,
      projectionMatches: this.ao.gtaoMaterial.uniforms.cameraProjectionMatrix.value.equals(this.camera.projectionMatrix) &&
        this.ao.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.equals(this.camera.projectionMatrixInverse),
      near: this.ao.gtaoMaterial.uniforms.cameraNear.value };
  }
}
