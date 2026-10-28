import * as THREE from 'three';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { describe, expect, it, vi } from 'vitest';
import { Presentation } from '../src/drive/post';

function presentation(maxSamples = 4) {
  const renderer = { capabilities: { maxSamples }, getPixelRatio: () => 1 } as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera(54, 1.6, .2, 2400);
  const post = new Presentation(renderer, new THREE.Scene(), camera);
  post.configure('high', 640, 400, 1);
  vi.spyOn(post.composer, 'render').mockImplementation(() => {});
  const ao = post.composer.passes.find(pass => pass instanceof SSAOPass)! as SSAOPass;
  const dispose = () => { post.composer.passes.forEach(pass => pass.dispose()); post.composer.dispose(); };
  return { post, camera, ao, dispose };
}

describe('presentation stability', () => {
  it('tracks live camera projection through acceleration and cockpit/chase transitions without a resize', () => {
    const { post, camera, ao, dispose } = presentation();
    for (const [fov, near] of [[59, .2], [65, .2], [71, .035], [61, .2]]) {
      camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); post.render();
      expect(ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.equals(camera.projectionMatrix)).toBe(true);
      expect(ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.equals(camera.projectionMatrixInverse)).toBe(true);
      expect(ao.ssaoMaterial.uniforms.cameraNear.value).toBe(near);
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
    expect(ao.normalRenderTarget.width).toBe(400); expect(ao.normalRenderTarget.height).toBe(250);
    expect(ao.ssaoMaterial.uniforms.resolution.value.toArray()).toEqual([400, 250]);
    post.configure('medium', 641, 401, 1.25); expect(ao.enabled).toBe(false);
    post.configure('ultra', 480, 270, 1); expect(ao.enabled).toBe(true);
    expect(ao.normalRenderTarget.width).toBe(240); expect(ao.normalRenderTarget.height).toBe(135);
    dispose();
  });
});
