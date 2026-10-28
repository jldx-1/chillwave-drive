import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { qualityPixelRatio } from '../src/drive/performance';
import { CrashEffects, EXPLOSION_DURATION } from '../src/drive/crashes';
import { Records } from '../src/drive/storage';
import { DriveCamera } from '../src/drive/camera';
import { Vehicle } from '../src/drive/vehicle';

describe('user-selected graphics resolution', () => {
  it('uses fixed preset pixel caps on high-density screens', () => {
    expect(['low', 'medium', 'high', 'ultra'].map(quality => qualityPixelRatio(quality as 'low' | 'medium' | 'high' | 'ultra', 3))).toEqual([1, 1, 1.25, 1.5]);
  });
  it('respects the screen density without upscaling low-density displays', () => {
    for (const ratio of [.75, 1, 1.1]) expect(qualityPixelRatio('ultra', ratio)).toBe(ratio);
  });
});

describe('crash effect preparation and lifetime', () => {
  it('warms every effect without leaving an explosion visible, even if a warmup draw fails', () => {
    const scene = new THREE.Scene(), crash = new CrashEffects(scene);
    expect(crash.diagnostics.smoke).toBe(false);
    expect(() => crash.warmup(() => {
      expect(scene.children.some(object => object instanceof THREE.Group && object.visible)).toBe(true);
      expect(crash.points.geometry.drawRange.count).toBe(512);
      throw new Error('draw failed');
    })).toThrow('draw failed');
    expect(scene.children.filter(object => object instanceof THREE.Group).every(object => !object.visible)).toBe(true);
    expect(crash.points.geometry.drawRange.count).toBe(0);
  });
  it('reuses GPU geometry through repeated explosions and clears smoke at the real duration', () => {
    const scene = new THREE.Scene(), crash = new CrashEffects(scene);
    const resources = new Set<THREE.BufferGeometry>();
    scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) resources.add(object.geometry); });
    const count = scene.children.length;
    for (let i=0;i<20;i++) {
      crash.explode(6.5, 1040); crash.update(.25,1000,false);
      expect(crash.diagnostics.smoke).toBe(true); expect(crash.diagnostics.particles).toBeLessThanOrEqual(512);
      crash.update(EXPLOSION_DURATION-.25,1000,false);
      expect(crash.diagnostics.smoke).toBe(false); expect(crash.diagnostics.particles).toBe(0);
      expect(scene.children.length).toBe(count);
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) expect(resources.has(object.geometry)).toBe(true); });
      crash.reset();
    }
  });
});

it('starts phones with lighter graphics and traffic while preserving saved user choices', () => {
  const empty = { getItem: () => null, setItem: () => {} };
  expect(new Records(empty,true).settings).toMatchObject({quality:'low',density:'low'});
  expect(new Records(empty,false).settings.quality).toBe('medium');
  const saved = { ...empty, getItem: (key:string) => key.includes('settings') ? JSON.stringify({ quality:'high',density:'high' }) : null };
  expect(new Records(saved,true).settings).toMatchObject({quality:'high',density:'high'});
});

it('frames the car farther away on portrait phones so adjacent lanes remain visible', () => {
  const vehicle = new Vehicle(), camera = new DriveCamera(); camera.resize(390,844);
  camera.update(1/120,vehicle,vehicle.pose(1),0,'chase',false,true);
  expect(camera.camera.position.z).toBeGreaterThan(12);
  camera.resize(844,390); camera.reset(); camera.update(1/120,vehicle,vehicle.pose(1),0,'chase',false,true);
  expect(camera.camera.position.z).toBeCloseTo(7.5);
});
