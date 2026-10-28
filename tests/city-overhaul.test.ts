import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { towerPlan } from '../src/drive/architecture';
import { cityChunk,type CityParcel } from '../src/drive/world-layout';
import { buildTower } from '../src/drive/city-buildings';
import { UrbanBatch } from '../src/drive/world-geometry';
import type { CityMaterials } from '../src/drive/world-materials';
import { floweringTree } from '../src/drive/vegetation';
import { bridgeForChunk,roadLamp } from '../src/drive/city-infrastructure';
import { rainSheltered } from '../src/drive/weather';
import { CityLighting } from '../src/drive/city-lighting';
import { aerialPose } from '../src/drive/aerial-traffic';

const parcel=cityChunk('ARCHITECTURE',0).parcels.find(p=>p.row===0)!;
const families=['rounded','stepped','curtain','residential','masonry'] as const;
function geometryMaterials() {
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const get=(key:string)=>{if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial());return materials.get(key)!;};
  const proxy=new Proxy({}, {get:(_,key:string)=>key==='facades'?[get('glass')]:key==='signRects'||key==='adRects'?Array.from({length:24},()=>[0,0,1,1]):get(key)}) as CityMaterials;
  return {proxy,dispose:()=>materials.forEach(m=>m.dispose())};
}
describe('city architecture and public space',()=>{
  it('has ten massing layouts with all major volumes inside their reserved parcel',()=>{
    const names=new Set<string>();
    for(const style of families)for(const seed of [200,201]) {
      const p:CityParcel={...parcel,height:130,style,seed},plan=towerPlan(p);names.add(plan.name);
      for(const part of plan.volumes){
        expect(Math.abs(part.x)+part.width/2).toBeLessThanOrEqual(p.width/2+.001);
        expect(Math.abs(part.z)+part.depth/2).toBeLessThanOrEqual(p.depth/2+.001);
        expect(part.base).toBeGreaterThanOrEqual(plan.podium);expect(part.base+part.height).toBeLessThanOrEqual(p.height+.001);
      }
    }
    expect(names.size).toBe(10);
  });
  it('builds finite structural geometry with shared materials for each of the ten forms',()=>{
    const m=geometryMaterials(),signatures=new Set<string>();
    for(const style of families)for(const seed of [200,201]) {
      const b=new UrbanBatch();buildTower(b,m.proxy,{...parcel,height:100,style,seed},0);
      const group=b.build();let vertices=0;const hash=createHash('sha256');
      group.traverse(o=>{if(o instanceof THREE.Mesh){vertices+=o.geometry.attributes.position.count;hash.update(Buffer.from(o.geometry.attributes.position.array.buffer));expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);o.geometry.dispose();}});
      expect(vertices).toBeGreaterThan(1500);expect(vertices).toBeLessThan(30000);expect(group.children.length).toBeLessThan(22);signatures.add(hash.digest('hex'));
    }
    expect(signatures.size).toBe(10);m.dispose();
  });
  it('keeps sloped barrier and tapered-crown faces outward so they render and light correctly',()=>{
    const material=new THREE.MeshStandardMaterial(),batch=new UrbanBatch();batch.tapered(material,0,0,0,4,6,8,.55);
    const mesh=batch.build().children[0] as THREE.Mesh,p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    for(let i=0;i<p.count;i++)expect(p.getX(i)*n.getX(i)+(p.getY(i)-4)*n.getY(i)+p.getZ(i)*n.getZ(i)).toBeGreaterThan(0);
    mesh.geometry.dispose();material.dispose();
  });
  it('avoids repeating neighboring tower families and uses the full configuration set',()=>{
    const names=new Set<string>();
    for(let id=0;id<20;id++) {
      const parcels=cityChunk('NEIGHBORS',id).parcels.filter(p=>families.includes(p.style as typeof families[number]));
      for(const p of parcels)names.add(towerPlan(p).name);
      for(const side of [-1,1])for(const row of [0,1,2]) {
        const line=parcels.filter(p=>p.side===side&&p.row===row).sort((a,b)=>a.s-b.s);
        for(let i=1;i<line.length;i++) expect(towerPlan(line[i]).name).not.toBe(towerPlan(line[i-1]).name);
      }
    }
    expect(names.size).toBe(10);
  });
  it('varies branched tree silhouettes reproducibly with gaps between foliage clusters',()=>{
    const a=floweringTree(41),b=floweringTree(42);
    expect(a).toEqual(floweringTree(41));expect(a).not.toEqual(b);
    expect(a.branches.length).toBeGreaterThan(15);expect(a.clusters.length).toBeGreaterThan(7);
    expect(new Set(a.clusters.map(c=>c.y)).size).toBeGreaterThan(5);
    expect(Math.max(...a.clusters.map(c=>c.x))-Math.min(...a.clusters.map(c=>c.x))).toBeGreaterThan(2);
  });
  it('places varied elevated crossings at safe clearances with matching rain shelter',()=>{
    expect([0,3,6].map(id=>bridgeForChunk(id)?.type)).toEqual(['enclosed','open','gantry']);
    expect(bridgeForChunk(0)?.s).toBe(100);
    for(let id=0;id<60;id+=3){const bridge=bridgeForChunk(id)!;expect(bridge.floor-.8).toBeGreaterThan(10);expect(bridge.left).toBeLessThan(-20);expect(bridge.right).toBeGreaterThan(20);expect(rainSheltered(0,bridge.s)).toBe(true);}
  });
});
describe('stable city illumination and aerial routes',()=>{
  it('anchors actual amber fixtures and pooled lights through a kilometre origin change',()=>{
    expect(roadLamp(12,-1)).toMatchObject({y:10.7,s:12});expect(roadLamp(12,-1).x).toBeCloseTo(-14.6,8);
    const lights=new CityLighting();for(let i=0;i<120;i++)lights.update('LIGHTS',1034.7,0,1/60,'high');
    const before=lights.diagnostics;expect(before.activeLights).toBeGreaterThanOrEqual(3);expect(before.physicalLights).toBe(6);
    lights.update('LIGHTS',1034.7,1000,0,'high');const after=lights.diagnostics;
    after.sources.forEach((source,i)=>{expect(source.key).toBe(before.sources[i].key);expect(source.position[2]-before.sources[i].position[2]).toBeCloseTo(1000,6);expect(source.intensity).toBeCloseTo(before.sources[i].intensity,8);});
  });
  it('moves craft continuously along separate world-space flight layers and honors reduced motion',()=>{
    for(const kind of ['hovercar','transport','drone'] as const){const a=aerialPose('AIR',0,kind,10),b=aerialPose('AIR',0,kind,10+1/120);expect(Math.abs(a.s-b.s)).toBeLessThan(.06);expect(Math.abs(a.x-b.x)).toBeLessThan(.02);expect(a.y).toBeGreaterThan(24);expect(aerialPose('AIR',0,kind,10,true)).toEqual(aerialPose('AIR',0,kind,100,true));}
  });
});
