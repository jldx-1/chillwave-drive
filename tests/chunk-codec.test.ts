import * as THREE from 'three';
import {it,expect} from 'vitest';
import {buildCityChunk} from '../src/drive/city-chunk';
import {cityChunk} from '../src/drive/world-layout';
import type {CityMaterials} from '../src/drive/world-materials';
import {describeChunkMaterials,buildChunkMaterialPlaceholders,packChunk,unpackChunk,chunkTransfers,type PackedChunk} from '../src/drive/chunk-codec';

it('reconstructs worker streets, bridges, passages and animated median gates without changing geometry',()=>{
  const fields:Record<string,unknown>={leaves:Array.from({length:3},()=>new THREE.MeshStandardMaterial()),signRects:Array.from({length:32},()=>[0,0,1,1]),adRects:[]};
  const materials=new Proxy(fields,{get:(object,key:string)=>object[key]??(object[key]=new THREE.MeshStandardMaterial())}) as unknown as CityMaterials;
  const asphalt=new THREE.MeshStandardMaterial(),ids=[0,6,10,15];
  const original=ids.map(id=>buildCityChunk(cityChunk('WORKER',id),materials,asphalt));
  const registry=describeChunkMaterials(materials,asphalt),worker=buildChunkMaterialPlaceholders(registry.schema);
  const equal=(a:PackedChunk,b:PackedChunk)=>{
    expect({...a,geometry:undefined,children:undefined}).toEqual({...b,geometry:undefined,children:undefined});
    if(a.geometry&&b.geometry)for(const name of Object.keys(a.geometry.attributes)) {
      const x=a.geometry.attributes[name],y=b.geometry.attributes[name];
      expect(x.itemSize).toBe(y.itemSize);expect(x.normalized).toBe(y.normalized);
      expect(Buffer.from(x.array.buffer).equals(Buffer.from(y.array.buffer))).toBe(true);
    }
    expect(a.children.length).toBe(b.children.length);a.children.forEach((child,i)=>equal(child,b.children[i]));
  };
  ids.forEach((id,i)=>{
    const generated=buildCityChunk(cityChunk('WORKER',id),worker.materials,worker.asphalt);
    const packed=packChunk(generated,worker.byMaterial),main=packChunk(original[i],registry.byMaterial);
    equal(main,packed);expect(chunkTransfers(packed).length).toBeGreaterThan(20);
    const hydrated=unpackChunk(packed,registry.byKey);equal(main,packChunk(hydrated,registry.byMaterial));
    for(const group of [original[i],generated,hydrated])group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
  });
});
