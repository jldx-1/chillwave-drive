import * as THREE from 'three';
import {it,expect} from 'vitest';
import {InfrastructureBatches} from '../src/drive/infrastructure-batches';

it('reuses ring slots, preserves world transforms and excludes retired chunks and moving signs',()=>{
  const material=new THREE.MeshStandardMaterial(),batches=new InfrastructureBatches();
  const chunk=()=>{const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(),material);mesh.position.set(2,3,4);mesh.updateMatrix();group.add(mesh);return group;};
  const first=chunk(),sign=new THREE.Mesh(new THREE.BoxGeometry(),material);sign.name='breakable-sign';first.add(sign);
  batches.sync(new Map([[1,first]]),0);batches.updateVisibility(120);
  const mesh=batches.group.children[0] as THREE.BatchedMesh,transform=new THREE.Matrix4();mesh.getMatrixAt(0,transform);
  expect(transform.elements.slice(12,15)).toEqual([2,3,-116]);expect(mesh.getVisibleAt(0)).toBe(true);
  expect(first.children[0].visible).toBe(false);expect(sign.visible).toBe(true);
  const next=chunk();batches.sync(new Map([[17,next]]),1920);batches.updateVisibility(2040);
  expect(batches.group.children[0]).toBe(mesh);expect(mesh.instanceCount).toBe(1);mesh.getMatrixAt(0,transform);expect(transform.elements[14]).toBe(-116);
  batches.sync(new Map(),1920);batches.updateVisibility(2040);expect(mesh.getVisibleAt(0)).toBe(false);
  batches.reset();expect(batches.group.children).toHaveLength(0);
  for(const group of [first,next])group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});material.dispose();
});
