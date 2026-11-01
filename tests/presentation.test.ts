import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { describe, expect, it, vi } from 'vitest';
import { Presentation } from '../src/drive/post';

function presentation(maxSamples = 4) {
  const renderer = { capabilities: { maxSamples }, getPixelRatio: () => 1 } as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(54, 1.6, .2, 2400);
  const post = new Presentation(renderer, new THREE.Scene(), camera);
  post.configure('high', 640, 400, 1);
  vi.spyOn(post.composer, 'render').mockImplementation(() => {});
  const ao = post.composer.passes.find(pass => pass instanceof GTAOPass)! as GTAOPass;
  const dispose = () => { post.composer.passes.forEach(pass => pass.dispose()); post.composer.dispose(); };
  return { post, camera, ao, dispose };
}

describe('presentation stability', () => {
  it('uses the current composer depth buffer without rendering city geometry a second time',()=>{
    const {post,ao,dispose}=presentation(),render=vi.fn();
    const renderer={getClearColor:(color:THREE.Color)=>color.set(0),getClearAlpha:()=>1,setRenderTarget:vi.fn(),setClearColor:vi.fn(),setClearAlpha:vi.fn(),clear:vi.fn(),render,autoClear:true} as unknown as THREE.WebGLRenderer;
    for(const [read,write] of [[post.composer.renderTarget1,post.composer.renderTarget2],[post.composer.renderTarget2,post.composer.renderTarget1]]) {
      expect(read.depthTexture).toBeInstanceOf(THREE.DepthTexture);
      ao.render(renderer,write,read,0,false);
      expect(ao.gtaoMaterial.uniforms.tDepth.value).toBe(read.depthTexture);
      expect(ao.pdMaterial.uniforms.tDepth.value).toBe(read.depthTexture);
      expect(ao.blendMaterial.uniforms.tScene.value).toBe(read.texture);
    }
    expect(render.mock.calls.length).toBeGreaterThan(0);
    expect(render.mock.calls.every(([object])=>!(object instanceof THREE.Scene))).toBe(true);
    dispose();
  });
  it('tracks live camera projection through acceleration and cockpit/chase transitions without a resize', () => {
    const { post, camera, ao, dispose } = presentation();
    for (const [fov, near] of [[59, .2], [65, .2], [71, .035], [61, .2]]) {
      camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); post.render();
      expect(ao.gtaoMaterial.uniforms.cameraProjectionMatrix.value.equals(camera.projectionMatrix)).toBe(true);
      expect(ao.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.equals(camera.projectionMatrixInverse)).toBe(true);
      expect(ao.gtaoMaterial.uniforms.cameraNear.value).toBe(near);
      expect(ao.depthRenderMaterial.uniforms.cameraNear.value).toBe(near);
    }
    dispose();
  });
  it('antialiases both offscreen color buffers within the device sample limit', () => {
    for (const maximum of [0, 2, 4, 8]) {
      const { post, dispose } = presentation(maximum);
      expect(post.composer.renderTarget1.samples).toBe(Math.min(4, maximum));
      expect(post.composer.renderTarget2.samples).toBe(Math.min(4, maximum));
      expect(post.composer.renderTarget1.texture.type).toBe(THREE.HalfFloatType);
      dispose();
    }
  });
  it('uses whole AO texels at fractional display scale and after a quality change', () => {
    const { post, ao, dispose } = presentation();
    post.configure('high', 641, 401, 1.25);
    expect(ao.gtaoRenderTarget.width).toBe(400); expect(ao.gtaoRenderTarget.height).toBe(250);
    expect(ao.gtaoMaterial.uniforms.resolution.value.toArray()).toEqual([400, 250]);
    post.configure('medium', 641, 401, 1.25); expect(ao.enabled).toBe(false);
    post.configure('ultra', 480, 270, 1); expect(ao.enabled).toBe(true);
    expect(ao.gtaoRenderTarget.width).toBe(240); expect(ao.gtaoRenderTarget.height).toBe(135);
    dispose();
  });
});
