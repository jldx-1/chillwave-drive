import * as THREE from 'three';
import type { Quality } from './config';

/** Fixed sun direction, a volume above the city roofs, and world-anchored shadow texels. */
export class StableSunShadow {
  readonly light = new THREE.DirectionalLight('#ffcfaa', 3);
  readonly target = new THREE.Object3D();
  private offset = new THREE.Vector3(-140, 260, -320);
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private world = new THREE.Vector3();
  constructor() {
    const basis = new THREE.Matrix4().lookAt(this.offset, new THREE.Vector3(), THREE.Object3D.DEFAULT_UP);
    this.right.setFromMatrixColumn(basis, 0); this.up.setFromMatrixColumn(basis, 1);
    Object.assign(this.light.shadow.camera, { left:-100, right:100, top:120, bottom:-120, near:1, far:900 });
    this.light.shadow.camera.updateProjectionMatrix();
    this.light.shadow.normalBias=.025; this.light.shadow.bias=-.00002;
    this.light.target=this.target;
    this.configure('high'); this.update(6.5,0,0);
  }
  configure(quality:Quality):void {
    this.light.castShadow=quality!=='low';
    const size=quality==='high'||quality==='ultra'?2048:1024;
    if(this.light.shadow.mapSize.x!==size){
      this.light.shadow.map?.dispose(); this.light.shadow.map=null;
      this.light.shadow.mapSize.setScalar(size); this.light.shadow.needsUpdate=true;
    }
  }
  update(x:number,s:number,origin:number):void {
    this.world.set(x,0,-s);
    const camera=this.light.shadow.camera, map=this.light.shadow.mapSize;
    for(const [axis,texel]of [[this.right,(camera.right-camera.left)/map.x],[this.up,(camera.top-camera.bottom)/map.y]] as const){
      const distance=this.world.dot(axis);
      this.world.addScaledVector(axis,Math.round(distance/texel)*texel-distance);
    }
    this.target.position.copy(this.world); this.target.position.z+=origin;
    this.light.position.copy(this.target.position).add(this.offset);
  }
}

/** Auxiliary normal/depth passes must never replace a color reflection with diagnostic buffers. */
export function colorPassReflection(reflector:THREE.Object3D):void {
  const render=reflector.onBeforeRender;
  reflector.onBeforeRender=function(...args){
    if(!args[1].overrideMaterial) render.apply(this,args);
  };
}

/** Reflection glazes and flame ribbons contribute color, not solid surfaces to the AO depth buffer. */
export function withoutColorEffects<T>(scene:THREE.Scene,render:()=>T):T {
  const hidden:THREE.Object3D[]=[];
  scene.traverse(object=>{if(object.visible&&object.userData.colorOnly){object.visible=false;hidden.push(object);}});
  try{return render();}finally{for(const object of hidden)object.visible=true;}
}
