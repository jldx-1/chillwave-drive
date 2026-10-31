import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ProceduralCity, fitProceduralBuilding, proceduralFamily } from '../src/drive/procedural-city';
import { cityChunk } from '../src/drive/world-layout';

describe('procedural cyberpunk city placement', () => {
  const source = new THREE.Box3(new THREE.Vector3(-13, -.4, -9), new THREE.Vector3(18, 62, 16));
  it('fits signs and cantilevers inside every reserved plot, including road detours', () => {
    const families = new Set<string>();
    for (let id = -6; id < 40; id++) for (const p of cityChunk('SUNSET', id).parcels) {
      families.add(proceduralFamily(p));
      const box = source.clone().applyMatrix4(fitProceduralBuilding(p, source, 0));
      expect(box.min.x).toBeGreaterThanOrEqual(p.x - p.width / 2 + .49);
      expect(box.max.x).toBeLessThanOrEqual(p.x + p.width / 2 - .49);
      expect(box.min.z).toBeGreaterThanOrEqual(-p.s - p.depth / 2 + .49);
      expect(box.max.z).toBeLessThanOrEqual(-p.s + p.depth / 2 - .49);
      expect(box.min.y).toBeCloseTo(0, 6); expect(box.max.y).toBeLessThanOrEqual(p.height + .001);
    }
    expect([...families].sort()).toEqual(['arcology', 'capsule', 'hive']);
  });
  it('rebases exactly one kilometre without changing scale or world placement', () => {
    const p = cityChunk('REBASE', 9).parcels[0];
    const a = fitProceduralBuilding(p, source, 0).elements;
    const b = fitProceduralBuilding(p, source, 1000).elements;
    for (let i = 0; i < 16; i++) expect(b[i] - a[i]).toBeCloseTo(i === 14 ? 1000 : 0, 8);
    expect(proceduralFamily(p)).toBe(proceduralFamily({ ...p }));
  });
});

it('reuses finite indexed template geometry when streaming and rebasing', () => {
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 20 }) : String(key).startsWith('create') ? () => gradient : () => {} });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  try {
    const city = new ProceduralCity();
    city.update([cityChunk('SUNSET', 0)], 0);
    const meshes = city.group.children as import('../src/drive/view-batch').ViewBatch[];
    const geometries = meshes.map(m => m.geometry);
    console.log('procedural template budget', city.diagnostics);
    expect(city.diagnostics.templates).toBe(6);
    expect(city.diagnostics.drawBatches).toBeLessThan(330);
    expect(city.diagnostics.templateVertices).toBeLessThan(330000);
    expect(city.diagnostics.activeBuildings).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.geometry.index).not.toBeNull();
      expect(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(mesh.geometry.attributes.normal.array).every(Number.isFinite)).toBe(true);
    }
    const cached = [cityChunk('SUNSET', 9)];
    city.update(cached, 0);
    const uploads = city.diagnostics.instanceUploads;
    city.update(cached, 1000);
    expect(city.group.position.z).toBe(1000);
    expect(city.diagnostics.instanceUploads).toBe(uploads);
    city.updateDetail(0,0);
    const stationary = city.diagnostics.instanceUploads;
    city.updateDetail(0,0);
    expect(city.diagnostics.instanceUploads).toBe(stationary);
    const chunk = cityChunk('LOD', 0);
    const parcel = {...chunk.parcels[0],id:'hysteresis',x:0,s:150,width:20,depth:20};
    city.configure('low'); city.update([{...chunk,parcels:[parcel]}],0,50);
    expect(city.diagnostics.detailBuildings).toBe(1);
    city.updateDetail(20,0); expect(city.diagnostics.detailBuildings).toBe(1);
    city.updateDetail(10,0); expect(city.diagnostics.detailBuildings).toBe(0);
    city.updateDetail(20,0); expect(city.diagnostics.detailBuildings).toBe(0);
    // Streaming must retain the existing detail state within the hysteresis band.
    city.update([{...chunk,parcels:[parcel]}],0,20);
    expect(city.diagnostics.detailBuildings).toBe(0);
    city.configure('high'); city.updateDetail(20,0);
    expect(city.diagnostics.detailBuildings).toBe(1);
    expect(meshes.filter(m=>m.userData.cityDetail).every(m=>!m.castShadow)).toBe(true);
    expect(meshes.map(m => m.geometry)).toEqual(geometries);
    city.animate(12, true);
    for (const geometry of geometries) geometry.dispose();
  } finally { vi.unstubAllGlobals(); }
}, 20000);
