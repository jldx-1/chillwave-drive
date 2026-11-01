import * as THREE from 'three';
import {CITY_MIST_END} from './atmosphere';
interface Source {id:number;mesh:THREE.Mesh<THREE.BufferGeometry,THREE.Material>}
interface Slot {geometry:number;instance:number;owner:number;source:THREE.BufferGeometry;visible:boolean;active:boolean}
interface Batch {mesh:THREE.BatchedMesh;reserve:number;slots:Map<number,Slot>}
/** Lossless multi-draw of unique streetscape chunks. Reserved ring slots avoid rebuilding combined buffers. */
export class InfrastructureBatches {
  readonly group=new THREE.Group();
  private batches=new Map<string,Batch>();
  private transform=new THREE.Matrix4();
  private sourceCount=0;
  sync(chunks:Map<number,THREE.Group>,origin:number):void {
    const sources=new Map<string,Source[]>();this.sourceCount=0;
    for(const [id,group] of chunks)for(const object of group.children) {
      if(!(object instanceof THREE.Mesh)||Array.isArray(object.material)||object.userData.owned||object.name==='breakable-sign')continue;
      const mesh=object as THREE.Mesh<THREE.BufferGeometry,THREE.Material>;
      const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;
      if(!sources.has(key))sources.set(key,[]);sources.get(key)!.push({id,mesh});mesh.visible=false;this.sourceCount++;
    }
    for(const batch of this.batches.values())for(const slot of batch.slots.values()){batch.mesh.setVisibleAt(slot.instance,false);slot.visible=false;slot.active=false;}
    for(const [key,entries] of sources) {
      const maximum=Math.max(...entries.map(entry=>entry.mesh.geometry.attributes.position.count));
      let batch=this.batches.get(key);
      if(!batch||batch.reserve<maximum) {
        if(batch){this.group.remove(batch.mesh);batch.mesh.dispose();}
        const reserve=2**Math.ceil(Math.log2(Math.max(64,maximum*1.25))),source=entries[0].mesh;
        const mesh=new THREE.BatchedMesh(16,reserve*16,0,source.material);
        mesh.frustumCulled=false;mesh.perObjectFrustumCulled=true;mesh.sortObjects=true;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
        batch={mesh,reserve,slots:new Map()};this.batches.set(key,batch);this.group.add(mesh);
      }
      for(const {id,mesh} of entries) {
        const index=((id%16)+16)%16;let slot=batch.slots.get(index);
        if(!slot) {
          const geometry=batch.mesh.addGeometry(mesh.geometry,batch.reserve,0),instance=batch.mesh.addInstance(geometry);
          slot={geometry,instance,owner:id,source:mesh.geometry,visible:false,active:true};batch.slots.set(index,slot);
        }else if(slot.owner!==id||slot.source!==mesh.geometry)batch.mesh.setGeometryAt(slot.geometry,mesh.geometry);
        slot.owner=id;slot.source=mesh.geometry;slot.active=true;
        this.transform.copy(mesh.matrix);this.transform.elements[14]+=origin-id*120;
        batch.mesh.setMatrixAt(slot.instance,this.transform);
        batch.mesh.setVisibleAt(slot.instance,true);slot.visible=true;
      }
    }
  }
  updateVisibility(s:number):void {
    for(const batch of this.batches.values())for(const slot of batch.slots.values()) {
      const visible=slot.active&&Math.abs(slot.owner*120+60-s)-60<=CITY_MIST_END+24;
      if(slot.visible!==visible){slot.visible=visible;batch.mesh.setVisibleAt(slot.instance,visible);}
    }
  }
  reset():void {for(const batch of this.batches.values())batch.mesh.dispose();this.batches.clear();this.group.clear();}
  get diagnostics(){return {batches:this.batches.size,sourceMeshes:this.sourceCount};}
}
