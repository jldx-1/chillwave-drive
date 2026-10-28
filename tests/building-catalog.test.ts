import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { BUILDING_CATALOG,buildingAsset } from '../src/drive/building-catalog';
import { catalogFrontage } from '../src/drive/catalog-frontage';
import { CatalogSkyline } from '../src/drive/catalog-skyline';
import { catalogPlan,profileContour } from '../src/drive/catalog-architecture';
import { buildCatalogBuilding,catalogDetailVisible } from '../src/drive/catalog-buildings';
import { cityChunk,catalogAt,CITY_ROW_SPACING,type CityParcel } from '../src/drive/world-layout';
import { UrbanBatch } from '../src/drive/world-geometry';
import type { CityMaterials } from '../src/drive/world-materials';

function materials() {
  const cache=new Map<string,THREE.MeshStandardMaterial>();
  const get=(key:string)=>{if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial());return cache.get(key)!;};
  return {all:cache,proxy:new Proxy({}, {get:(_,key:string)=>key==='facades'?Array.from({length:4},(_,i)=>get(`facade${i}`)):key==='adRects'||key==='signRects'?Array.from({length:24},()=>[0,0,1,1]):get(key)})as CityMaterials};
}
function parcel(id:number):CityParcel {
  const a=buildingAsset(id);return {id:`catalog:${id}`,assetId:id,x:0,s:60,width:a.plotWidth,depth:a.plotDepth,height:a.height,side:-1,row:0,style:'curtain',seed:42,floors:a.floors,sign:0};
}
describe('100 authored architectural assets',()=>{
  it('preserves all catalog identities, metre dimensions and varied entrance/roof programs',()=>{
    expect(BUILDING_CATALOG.map(a=>a.id)).toEqual(Array.from({length:100},(_,i)=>i+1));
    expect(new Set(BUILDING_CATALOG.map(a=>a.name)).size).toBe(100);
    expect(buildingAsset(1)).toMatchObject({name:'Azure Bend Corporate Tower',width:44,depth:38,height:152});
    expect(buildingAsset(87)).toMatchObject({height:365,floors:83});
    expect(buildingAsset(100)).toMatchObject({width:85,depth:70,height:325});
    expect(new Set(BUILDING_CATALOG.map(a=>a.ground)).size).toBe(12);
    expect(new Set(BUILDING_CATALOG.map(a=>a.roof)).size).toBeGreaterThanOrEqual(10);
  });
  it('builds mixed-use lobbies, cafes, clinics and arcades with complete contiguous frontage',()=>{
    expect(catalogFrontage(1,44).map(b=>b.use)).toEqual(['retail','office','retail']);
    expect(catalogFrontage(58,41).map(b=>b.use)).toEqual(['restaurant','hotel','retail']);
    expect(catalogFrontage(75,49).map(b=>b.use)).toContain('service');
    expect(catalogFrontage(9,62)).toHaveLength(6);
    for(const a of BUILDING_CATALOG) {
      const bays=catalogFrontage(a.id,a.width);
      expect(bays.reduce((sum,b)=>sum+b.width,0)).toBeCloseTo(a.width,8);
      for(let i=1;i<bays.length;i++)expect(bays[i].center-bays[i].width/2).toBeCloseTo(bays[i-1].center+bays[i-1].width/2,8);
    }
  });
  it('contains 100 different structural arrangements independently of lighting and materials',()=>{
    const shapes=new Set<string>();
    for(const a of BUILDING_CATALOG) {
      const p=catalogPlan(a.id);
      shapes.add(JSON.stringify(p.volumes.map(v=>[v.profile,v.role,...[v.x/a.width,v.z/a.depth,v.width/a.width,v.depth/a.depth,v.base/a.height,v.height/a.height,v.topScale,v.angle].map(n=>Math.round(n*10000)/10000)])));
      expect(p.volumes.length).toBeGreaterThan(0);
      for(const v of p.volumes){expect(v.height).toBeGreaterThan(0);expect(v.base).toBeGreaterThanOrEqual(p.podium);}
    }
    expect(shapes.size).toBe(100);
    expect(catalogPlan(94).volumes[0].profile).toBe('crescent');
    expect(catalogPlan(95).volumes.filter(v=>v.role==='bridge')).toHaveLength(4);
    expect(catalogPlan(100).volumes.filter(v=>v.role==='bridge')).toHaveLength(6);
    expect(catalogPlan(85).volumes.filter(v=>v.role==='core').length).toBeGreaterThan(20);
  });
  it('generates finite, bounded real meshes for every asset and keeps additive LODs smaller than full detail',()=>{
    const m=materials();let nearVertices=0,farVertices=0;
    for(const a of BUILDING_CATALOG) {
      const b={silhouette:new UrbanBatch(),relief:new UrbanBatch(),street:new UrbanBatch()};
      buildCatalogBuilding(b,m.proxy,parcel(a.id),0);
      for(const [tier,batch]of Object.entries(b)) {
        const group=batch.build(),bounds=new THREE.Box3().setFromObject(group);
        let count=0;
        for(const mesh of group.children as THREE.Mesh[]) {
          const g=mesh.geometry;count+=g.attributes.position.count;
          expect(Array.from(g.attributes.position.array).every(Number.isFinite),`${a.id}: ${tier} positions`).toBe(true);
          expect(Array.from(g.attributes.normal.array).every(Number.isFinite),`${a.id}: ${tier} normals`).toBe(true);
          g.dispose();
        }
        expect(count,`${a.id}: ${tier} vertex budget`).toBeLessThan(80000);
        expect(bounds.min.x,`${a.id}: ${tier} road reserve`).toBeGreaterThanOrEqual(-a.plotWidth/2-.05);
        expect(bounds.max.x,`${a.id}: ${tier} side reserve`).toBeLessThanOrEqual(a.plotWidth/2+.05);
        expect(bounds.min.z,`${a.id}: ${tier} back reserve`).toBeGreaterThanOrEqual(-60-a.plotDepth/2-.05);
        expect(bounds.max.z,`${a.id}: ${tier} front reserve`).toBeLessThanOrEqual(-60+a.plotDepth/2+.05);
        if(tier==='silhouette')farVertices+=count;nearVertices+=count;
      }
    }
    expect(farVertices).toBeLessThan(nearVertices*.6);m.all.forEach(m=>m.dispose());
  });
  it('triangulates concave profiles as actual voids and keeps taper normals outward',()=>{
    const b=new UrbanBatch(),m=new THREE.MeshStandardMaterial();b.prism(m,0,0,0,58,35,200,profileContour('crescent'),.9);
    const g=(b.build().children[0]as THREE.Mesh).geometry,p=g.attributes.position,n=g.attributes.normal;
    const caps=[];
    for(let i=0;i<p.count;i+=3)if(n.getY(i)>.99) {
      const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      caps.push([x,z]);
      // The broad central hollow of the crescent remains unfilled, even at the far tier.
      expect(Math.abs(x)<10&&z<0).toBe(false);
    }
    expect(caps.length).toBeGreaterThan(10);g.dispose();m.dispose();
  });
});
describe('native-scale city placement and fixed distance detail',()=>{
  it('shuffles a complete catalog cycle and streams every building without resizing its footprint',()=>{
    const cycle=Array.from({length:100},(_,i)=>catalogAt('CATALOG',i).id);
    expect(new Set(cycle).size).toBe(100);expect(cycle).not.toEqual(BUILDING_CATALOG.map(a=>a.id));
    expect(catalogAt('CATALOG',-1).id).toBe(cycle[99]);
    const seen=new Set<number>();
    for(let id=0;id<100;id++)for(const p of cityChunk('CATALOG',id).parcels)if(p.assetId) {
      const a=buildingAsset(p.assetId);seen.add(a.id);
      expect(p.width).toBe(a.plotWidth);expect(p.depth).toBe(a.plotDepth);expect(p.height).toBe(a.height);
      expect(p.width).toBeLessThan(CITY_ROW_SPACING-10);
    }
    expect(seen.size).toBe(100);
  });
  it('instances all twenty signature far silhouettes at native scale with stable rebasing',()=>{
    const material=new THREE.MeshStandardMaterial(),sky=new CatalogSkyline(material);
    const meshes=sky.group.children as THREE.InstancedMesh[];
    expect(new Set(meshes.map(m=>m.name)).size).toBe(20);
    sky.update('DISTANT',0,0);expect(sky.count).toBe(30);
    const matrix=new THREE.Matrix4(),before=meshes.map(m=>{m.getMatrixAt(0,matrix);return matrix.clone();});
    sky.update('DISTANT',0,1000);
    meshes.forEach((m,i)=>{m.getMatrixAt(0,matrix);expect(matrix.elements[12]).toBeCloseTo(before[i].elements[12]);expect(matrix.elements[14]-before[i].elements[14]).toBeCloseTo(1000,3);expect(matrix.elements[0]).toBe(1);expect(m.count).toBeGreaterThan(0);expect(m.count).toBeLessThanOrEqual(2);});
    const geometries=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.map(m=>m.material as THREE.Material));
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  });
  it('uses stable distance thresholds with hysteresis, independent of measured FPS',()=>{
    // A visible point can be at most one chunk diagonal closer than the detail-group centre.
    // Both detail tiers must be present before any part of a native-scale plot exits the mist.
    for(const a of BUILDING_CATALOG) {
      const margin=Math.hypot(a.plotWidth,120);
      expect(catalogDetailVisible('near',680+margin/2,false)).toBe(true);
      expect(catalogDetailVisible('mid',680+margin/2,false)).toBe(true);
    }
    expect(catalogDetailVisible('near',180,false)).toBe(true);
    expect(catalogDetailVisible('near',840,true)).toBe(true);
    expect(catalogDetailVisible('near',840,false)).toBe(false);
    expect(catalogDetailVisible('near',900,true)).toBe(false);
    expect(catalogDetailVisible('mid',650,false)).toBe(true);
    expect(catalogDetailVisible('mid',1100,true)).toBe(false);
  });
});
