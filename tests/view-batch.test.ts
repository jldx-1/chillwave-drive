import * as THREE from 'three';
import {describe,it,expect} from 'vitest';
import {ViewBatch} from '../src/drive/view-batch';
import {ViewCameras} from '../src/drive/view-cameras';

function camera(back=false) {
  const c=new THREE.PerspectiveCamera(60,1,.1,100);c.lookAt(0,0,back?10:-10);c.updateMatrixWorld();return c;
}
function submit(batch:ViewBatch,camera:THREE.PerspectiveCamera) {
  batch.updateMatrixWorld(true);
  batch.onBeforeRender({} as THREE.WebGLRenderer,new THREE.Scene(),camera,batch.geometry,batch.material,null!);
}
describe('camera-specific batched visibility',()=>{
  it('builds separate command lists for front, rear and shadow views without changing transforms',()=>{
    const batch=new ViewBatch(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial(),8);
    const positions=[-12,-20,15,250];
    positions.forEach(z=>batch.place(new THREE.Matrix4().makeTranslation(0,0,z)));
    const front=camera(),rear=camera(true);
    submit(batch,front);expect(batch.visibleFor(front)).toBe(2);
    batch.onBeforeShadow({} as THREE.WebGLRenderer,new THREE.Scene(),front,rear,batch.geometry,batch.material,null!);
    expect(batch.visibleFor(rear)).toBe(1);
    submit(batch,front);expect(batch.visibleFor(front)).toBe(2);
    const matrix=new THREE.Matrix4();batch.getMatrixAt(2,matrix);expect(matrix.elements[14]).toBe(15);
    batch.activeCount=0;batch.place(new THREE.Matrix4().makeTranslation(0,0,-30));
    submit(batch,front);expect(batch.visibleFor(front)).toBe(1);
    expect(batch.instanceCount).toBe(4); // Reuse the allocated slots instead of growing each frame.
    batch.dispose();batch.material.dispose();
  });
  it('preserves visibility after an origin shift and retains rear-camera objects for preloading',()=>{
    const views=new ViewCameras(),front=camera(),rear=camera(true);
    views.capture([front]);expect(views.contains(0,0,-20,1)).toBe(true);expect(views.contains(0,0,40,1)).toBe(false);
    expect(views.projectedDiameter(0,0,-10,1)).toBeGreaterThan(views.projectedDiameter(0,0,-50,1));
    views.capture([front,rear]);expect(views.contains(0,0,40,1)).toBe(true);
    views.rebase(1000);expect(views.contains(0,0,980,1)).toBe(true);expect(views.contains(0,0,1040,1)).toBe(true);
  });
});
