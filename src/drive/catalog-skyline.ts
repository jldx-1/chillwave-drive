import * as THREE from 'three';
import { buildingAsset } from './building-catalog';
import { buildCatalogSilhouette } from './catalog-buildings';
import { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';
import { Random,hashSeed } from '../core/random';
import { sceneZ } from './road';

/** Twenty signature silhouettes share geometry across thirty stable distant landmark sites. */
export class CatalogSkyline {
  readonly group=new THREE.Group();
  private templates=new Map<number,THREE.InstancedMesh[]>();
  private transform=new THREE.Object3D();
  private counts=new Map<number,number>();
  constructor(material:THREE.Material) {
    const cyan=new THREE.MeshStandardMaterial({color:'#4cabc4',emissive:'#229ec4',emissiveIntensity:.8,metalness:.5,roughness:.35});
    const pink=new THREE.MeshStandardMaterial({color:'#c052b4',emissive:'#ba329c',emissiveIntensity:.8,roughness:.4});
    const proxy=new Proxy({}, {get:(_,key:string)=>key==='facades'?[material,material,material,material]:key==='cyan'||key==='neutralLight'?cyan:key==='pink'||key==='violet'?pink:material})as CityMaterials;
    for(let id=81;id<=100;id++) {
      const a=buildingAsset(id),batch=new UrbanBatch();
      buildCatalogSilhouette(batch,proxy,{id:`far:${id}`,assetId:id,x:0,s:0,width:a.plotWidth,depth:a.plotDepth,height:a.height,side:1,row:2,style:'curtain',seed:id,floors:a.floors,sign:0});
      const source=batch.build(),meshes:THREE.InstancedMesh[]=[];
      for(const mesh of source.children as THREE.Mesh[]) {
        const instances=new THREE.InstancedMesh(mesh.geometry,mesh.material,2);instances.count=0;instances.castShadow=false;
        instances.name=`catalog-far-${id}`;this.group.add(instances);meshes.push(instances);
      }
      this.templates.set(id,meshes);
    }
  }
  update(seed:string,block:number,origin:number):void {
    this.counts.clear();
    // Multiplication by seven walks all twenty identities, while the seeded offset varies districts.
    const offset=hashSeed(`${seed}:landmark-catalog`)%20;
    for(let district=block-4;district<=block+10;district++)for(const side of [-1,1]) {
      const index=district*2+(side<0?0:1),id=81+(((index*7+offset)%20)+20)%20;
      const r=new Random(hashSeed(`${seed}:landmark-site:${index}`)),count=this.counts.get(id)??0;
      this.transform.position.set(side*r.range(520,540),0,sceneZ(district*360+180,origin));
      this.transform.scale.set(1,1,1);this.transform.rotation.set(0,0,0);this.transform.updateMatrix();
      for(const mesh of this.templates.get(id)!)mesh.setMatrixAt(count,this.transform.matrix);
      this.counts.set(id,count+1);
    }
    for(const [id,meshes]of this.templates)for(const mesh of meshes) {
      mesh.count=this.counts.get(id)??0;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    }
  }
  get count():number{return [...this.counts.values()].reduce((a,b)=>a+b,0);}
}
