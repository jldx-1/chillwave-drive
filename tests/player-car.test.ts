import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { rigPlayerCar, type PlayerCarRig } from '../src/drive/car-asset';

let source: THREE.Group, rig: PlayerCarRig;
beforeAll(async () => {
  const blob = readFileSync(new URL('../public/models/porsche-911-gt3/model.glb', import.meta.url));
  const buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength) as ArrayBuffer;
  source = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')).scene;
  rig = rigPlayerCar(source, '#00a8d6');
});
describe('bundled GT3 integration', () => {
  it('decodes and bakes the compressed model at driving scale without corrupting quantized vertices', () => {
    const box = new THREE.Box3().setFromObject(rig.group), size = box.getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(4.6, 4);
    expect(size.x).toBeGreaterThan(1.9); expect(size.x).toBeLessThan(2.1);
    expect(size.y).toBeGreaterThan(1.2); expect(size.y).toBeLessThan(1.4);
    expect(box.min.y).toBeCloseTo(.012 * rig.scale, 4);
    rig.group.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const position = o.geometry.getAttribute('position');
      expect(position.array).toBeInstanceOf(Float32Array);
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
    });
    expect(rig.paint.length).toBeGreaterThan(0);
    expect(rig.paint.every(m => m.color.getHexString() === '00a8d6' && m.clearcoat === 1)).toBe(true);
  });
  it('keeps four rotating wheel assemblies, stationary calipers, steering, wipers and separate front/rear lamps', () => {
    expect(rig.wheels).toHaveLength(4); expect(rig.spins).toHaveLength(4);
    expect(rig.wheels.map(w => w.position.z < 0)).toEqual([true, false, true, false]);
    for (let i = 0; i < 4; i++) {
      expect(rig.spins[i].children.some(o => /Tyre/.test(o.name))).toBe(true);
      expect(rig.wheels[i].children.some(o => /Caliper/.test(o.name))).toBe(true);
      expect(rig.spins[i].children.every(o => !/Caliper/.test(o.name))).toBe(true);
    }
    expect(rig.steering.children.length).toBeGreaterThan(3);
    expect(rig.wipers).toHaveLength(2); expect(rig.wipers.every(w => w.children.length === 3)).toBe(true);
    expect(rig.lamps.length).toBeGreaterThan(0); expect(rig.headlamps.length).toBeGreaterThan(0);
    expect(rig.lamps.every(m => !rig.headlamps.includes(m))).toBe(true);
    expect(rig.sideMirrors).toHaveLength(2);
    for (const g of [rig.mirror, ...rig.sideMirrors]) expect(g.getAttribute('uv').count).toBe(g.getAttribute('position').count);
  });
  it('leaves the cached source reusable and places the eye above the left-hand steering wheel', () => {
    const first = new THREE.Box3().setFromObject(source);
    const next = rigPlayerCar(source, '#ff6688');
    expect(new THREE.Box3().setFromObject(source).equals(first)).toBe(true);
    expect(next.paint.every(m => m.color.getHexString() === 'ff6688')).toBe(true);
    expect(rig.paint.every(m => m.color.getHexString() === '00a8d6')).toBe(true);
    expect(rig.eye.x).toBeCloseTo(rig.steering.position.x, 1);
    expect(rig.eye.y).toBeGreaterThan(rig.steering.position.y + .2);
    expect(rig.eye.z).toBeGreaterThan(rig.steering.position.z);
    next.owned.forEach(g => g.dispose()); next.unique.forEach(m => m.dispose());
  });
});
