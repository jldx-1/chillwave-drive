import * as THREE from 'three';

/** Conservative previous-frame view set for preloading detailed traffic rigs. GPU culling uses each live camera. */
export class ViewCameras {
  private frusta: THREE.Frustum[] = [];
  private matrix = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private views: {position:THREE.Vector3;scale:number}[]=[];
  capture(cameras: THREE.Camera[], heights: number[] = []): void {
    this.frusta.length = cameras.length; this.views.length=cameras.length;
    cameras.forEach((camera,i) => {
      camera.updateMatrixWorld();
      const view=this.views[i]??={position:new THREE.Vector3(),scale:0};
      view.position.setFromMatrixPosition(camera.matrixWorld);view.scale=(heights[i]??540)*.5*camera.projectionMatrix.elements[5];
      this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      (this.frusta[i] ??= new THREE.Frustum()).setFromProjectionMatrix(this.matrix);
    });
  }
  rebase(deltaZ: number): void {
    if(!deltaZ)return;
    for(const view of this.views)view.position.z+=deltaZ;
    for(const frustum of this.frusta)for(const plane of frustum.planes)plane.constant-=plane.normal.z*deltaZ;
  }
  projectedDiameter(x:number,y:number,z:number,radius:number):number {
    if(!this.views.length)return Infinity;
    this.sphere.center.set(x,y,z);this.sphere.radius=radius;
    let pixels=0;
    for(let i=0;i<this.views.length;i++)if(this.frusta[i].intersectsSphere(this.sphere)) {
      const view=this.views[i];
      pixels=Math.max(pixels,2*radius*view.scale/Math.max(radius,view.position.distanceTo(this.sphere.center)));
    }
    return pixels;
  }
  contains(x:number,y:number,z:number,radius:number):boolean {
    if(!this.frusta.length) return true;
    this.sphere.center.set(x,y,z); this.sphere.radius=radius+14;
    return this.frusta.some(frustum=>frustum.intersectsSphere(this.sphere));
  }
}
