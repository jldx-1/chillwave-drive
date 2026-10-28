import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {describe,it,expect} from 'vitest';
import {CYBER_MODEL_IDS,CYBER_VEHICLES} from '../src/drive/cyber-vehicles';
import {cyberPrefab} from '../src/drive/cyber-prefabs';
import {rigFleetCar,disposeFleetRig} from '../src/drive/fleet-asset';
import {rigCanonicalPlayer} from '../src/drive/car-asset';

describe('reference-sheet models',()=>{
  it('leaves actual empty wheel wells rather than covering the tires with solid body slabs',()=>{
    for(const id of CYBER_MODEL_IDS){
      const source=cyberPrefab(id),spec=CYBER_VEHICLES[id],paint:THREE.Mesh[]=[];
      source.traverse(o=>{if(o instanceof THREE.Mesh&&(o.material as THREE.Material).userData.vehicleRole==='paint')paint.push(o);});
      source.updateMatrixWorld(true);
      for(const z of spec.axles)for(const side of [-1,1]){
        const ray=new THREE.Raycaster(new THREE.Vector3(side*(spec.width/2+.3),spec.wheelRadius+.08,z),new THREE.Vector3(-side,0,0),0,.25);
        expect(ray.intersectObjects(paint,false),`${id}: arch at ${z}`).toHaveLength(0);
      }
    }
  });
  it('delivers loadable GLBs for all fifteen identities and all three LODs, with working rigs',async()=>{
    const directory=new URL('../public/models/cyber/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'));
    expect(manifest.models).toHaveLength(46);
    for(const entry of manifest.models){
      const bytes=readFileSync(new URL(entry.file,directory));
      expect(createHash('sha256').update(bytes).digest('hex'),entry.file).toBe(entry.sha256);
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      // GLTFExporter wraps the prefab under its scene node.
      const source=gltf.scene.children[0] as THREE.Group;
      if(entry.lod==='player'){
        const player=rigCanonicalPlayer(source,'#00a8d6');expect(player.wheels).toHaveLength(4);expect(player.wipers).toHaveLength(2);expect(player.windows.length).toBeGreaterThan(0);player.unique.forEach(m=>m.dispose());
      }else{
        const rig=rigFleetCar(source,entry.id,'#00a8d6');expect(rig.wheels).toHaveLength(CYBER_VEHICLES[entry.id as keyof typeof CYBER_VEHICLES].axles.length*2);expect(rig.lamps.head.length).toBeGreaterThan(0);expect(rig.lamps.brake.length).toBeGreaterThan(0);if(entry.id==='titan')expect(rig.trailer).toBeDefined();disposeFleetRig(rig);
      }
      const bounds=new THREE.Box3().setFromObject(source);for(let axis=0;axis<3;axis++){expect(bounds.min.getComponent(axis),entry.file).toBeCloseTo(entry.bounds.min[axis],4);expect(bounds.max.getComponent(axis),entry.file).toBeCloseTo(entry.bounds.max[axis],4);}
    }
  });
});
