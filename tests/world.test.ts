import * as THREE from 'three';
import { CityBackdrop } from '../src/drive/skyline';
import { UrbanBatch } from '../src/drive/world-geometry';
import { describe, expect, it } from 'vitest';
import { cityChunk, groundCovers, parcelRoadClearance, GROUND_HALF_WIDTH } from '../src/drive/world-layout';
import { road, overpassesAt } from '../src/drive/road';

describe('continuous deterministic metropolitan layout', () => {
  it('reproduces full city parcels and varies architectural families and street uses', () => {
    expect(cityChunk('CITY', 12)).toEqual(cityChunk('CITY', 12));
    expect(cityChunk('CITY', 12)).not.toEqual(cityChunk('OTHER', 12));
    const chunks = Array.from({ length: 90 }, (_, id) => cityChunk('CITY', id));
    expect(new Set(chunks.flatMap(c => c.parcels.map(p => p.style)))).toEqual(new Set(['curtain', 'stepped', 'masonry', 'residential', 'rounded', 'garage', 'warehouse', 'fuel']));
    expect(chunks.every(c => c.parcels.length >= 12)).toBe(true);
  });
  it('reserves the full ramp corridor and bridge cross streets before placing buildings', () => {
    for (let id = -4; id < 100; id++) {
      const c = cityChunk('CLEARANCE', id);
      for (const p of c.parcels) {
        expect(parcelRoadClearance(p)).toBeGreaterThanOrEqual(3.49);
        expect(p.height).toBeGreaterThan(0); expect(groundCovers(p.x - p.width / 2) && groundCovers(p.x + p.width / 2)).toBe(true);
        for (const bridge of c.overpasses) expect(Math.abs(p.s - bridge.s) - p.depth / 2).toBeGreaterThan(bridge.length / 2);
        for (const q of c.parcels) if (p !== q) expect(Math.abs(p.x - q.x) >= (p.width + q.width) / 2 || Math.abs(p.s - q.s) >= (p.depth + q.depth) / 2).toBe(true);
      }
    }
  });
  it('supports terrain under every reachable route and agrees on physical overpasses', () => {
    for (let s = 0; s < 12000; s += 7) for (const [a, b] of road.corridorAt(s)) expect(groundCovers(a) && groundCovers(b)).toBe(true);
    expect(GROUND_HALF_WIDTH).toBeGreaterThan(600);
    expect(cityChunk('BRIDGE', 6).overpasses).toEqual(overpassesAt(780).filter(p => p.id === 6));
    expect(cityChunk('BRIDGE', 6).parcels).toHaveLength(12);
  });
});

describe('urban surface generation', () => {
  it('builds upward-facing tangent strips with continuous world-distance UVs', () => {
    const batch = new UrbanBatch(), material = new THREE.MeshStandardMaterial();
    batch.ribbon(material, [{ x: 32, z: 0, tx: 0, tz: -1, s: 1200, width: 7.2 }, { x: 32, z: -4, tx: 0, tz: -1, s: 1204, width: 7.2 }], -.025);
    const mesh = batch.build().children[0] as THREE.Mesh;
    const g = mesh.geometry; expect(g.attributes.position.count).toBe(6);
    for (let i = 0; i < g.attributes.normal.count; i++) expect(g.attributes.normal.getY(i)).toBeGreaterThan(.99);
    expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true);
    expect(g.attributes.uv.getY(0)).toBe(150); expect(g.attributes.uv.getY(2)).toBe(150.5);
    g.dispose(); material.dispose();
  });
});

describe('stable distant city window', () => {
  it('preserves overlapping world positions when the window advances and the origin rebases', () => {
    const city = new CityBackdrop(), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
    const masses = city.group.children[1] as THREE.InstancedMesh;
    // A 360 m district contributes 18 rectangular masses plus six curved towers.
    city.update('SKY', 350, 0); masses.getMatrixAt(4 * 18, matrix); p.setFromMatrixPosition(matrix); const first = p.clone();
    city.update('SKY', 370, 0); masses.getMatrixAt(3 * 18, matrix); p.setFromMatrixPosition(matrix); expect(p.distanceTo(first)).toBeLessThan(.0001);
    city.update('SKY', 370, 1000); masses.getMatrixAt(3 * 18, matrix); p.setFromMatrixPosition(matrix); expect(p.x).toBeCloseTo(first.x); expect(p.z - first.z).toBeCloseTo(1000);
    expect(city.diagnostics.skylineBuildings).toBe(360); city.dispose();
  });
});

describe('pavement and marking integration',()=>{
  it('anchors curved and clipped ramp UVs to the same world positions as the highway across chunk seams',()=>{
    const material=new THREE.MeshStandardMaterial();
    for(const start of [840,960,1440,1560]){
      const batch=new UrbanBatch();
      const samples=Array.from({length:61},(_,i)=>{
        const s=start+i*2,p=road.sampleDetour(s)!;
        return {x:p.x,z:start-s,tx:p.tangentX,tz:-p.tangentS,s,width:p.width};
      });
      batch.ribbon(material,samples,0,16.5);
      const g=(batch.build().children[0]as THREE.Mesh).geometry;
      for(let i=0;i<g.attributes.position.count;i++){
        const x=g.attributes.position.getX(i),z=g.attributes.position.getZ(i);
        expect(x).toBeGreaterThanOrEqual(16.5);expect(g.attributes.position.getY(i)).toBe(0);
        expect(g.attributes.uv.getX(i)).toBeCloseTo(x/8,5);
        expect(g.attributes.uv.getY(i)).toBeCloseTo((start-z)/8,4);
        expect(g.attributes.normal.getY(i)).toBeGreaterThan(.99);
      }
      g.dispose();
    }
    material.dispose();
  });
  it('places road paint flat on the surface without raised sides or cylindrical shadows',()=>{
    const batch=new UrbanBatch(),material=new THREE.MeshStandardMaterial();
    batch.paint(material,new THREE.Vector3(12,0,0),new THREE.Vector3(13,0,-4),.12);
    const g=(batch.build().children[0]as THREE.Mesh).geometry;
    for(let i=0;i<g.attributes.position.count;i++){
      expect(g.attributes.position.getY(i)).toBeCloseTo(.004,8);
      expect(g.attributes.normal.getY(i)).toBeCloseTo(1,6);
    }
    g.dispose();material.dispose();
  });
});
