import * as THREE from 'three';
import { MISSILE_CAPACITY,type Missile } from './missiles';
import { sceneZ } from './road';

/** A fixed pool shares all rocket geometry/materials; trails reuse dynamic position buffers. */
export class MissileVisuals {
  readonly group=new THREE.Group();
  private slots:{rocket:THREE.Group;flame:THREE.Mesh;trail:THREE.Line;smoke:THREE.Points}[]=[];
  private forward=new THREE.Vector3(0,0,-1);
  private direction=new THREE.Vector3();
  constructor() {
    this.group.name='player-missiles';
    const skin=new THREE.MeshStandardMaterial({color:'#bac9d5',metalness:.8,roughness:.27});
    const nose=new THREE.MeshStandardMaterial({color:'#d64651',metalness:.4,roughness:.3});
    const fire=new THREE.MeshBasicMaterial({color:'#ffb45c',toneMapped:false});
    const bodyGeo=new THREE.CylinderGeometry(.12,.15,1.15,8);bodyGeo.rotateX(Math.PI/2);
    const noseGeo=new THREE.ConeGeometry(.12,.38,8);noseGeo.rotateX(-Math.PI/2);
    const finGeo=new THREE.BoxGeometry(.65,.045,.4);
    const flameGeo=new THREE.ConeGeometry(.16,1.5,8);flameGeo.rotateX(Math.PI/2);
    const smokeMaterial=new THREE.PointsMaterial({color:'#a4b3c1',size:.45,transparent:true,opacity:.2,depthWrite:false});
    const trailMaterial=new THREE.LineBasicMaterial({color:'#ffc885',transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
    for(let i=0;i<MISSILE_CAPACITY;i++) {
      const rocket=new THREE.Group(),body=new THREE.Mesh(bodyGeo,skin),tip=new THREE.Mesh(noseGeo,nose);
      tip.position.z=-.765;rocket.add(body,tip);
      for(let j=0;j<2;j++){const fin=new THREE.Mesh(finGeo,skin);fin.position.z=.4;fin.rotation.z=j*Math.PI/2;rocket.add(fin);}
      const flame=new THREE.Mesh(flameGeo,fire);flame.position.z=1.25;rocket.add(flame);
      const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(25*3),3).setUsage(THREE.DynamicDrawUsage));
      const trail=new THREE.Line(trailGeo,trailMaterial),smoke=new THREE.Points(trailGeo,smokeMaterial);
      trail.frustumCulled=smoke.frustumCulled=false;rocket.visible=trail.visible=smoke.visible=false;
      rocket.userData.colorOnly=trail.userData.colorOnly=smoke.userData.colorOnly=true;
      this.group.add(rocket,trail,smoke);this.slots.push({rocket,flame,trail,smoke});
    }
  }
  update(missiles:readonly Missile[],origin:number,alpha:number,reduced:boolean):void {
    this.slots.forEach((slot,i)=>{
      const m=missiles[i];slot.rocket.visible=slot.trail.visible=!!m;slot.smoke.visible=!!m&&!reduced;
      if(!m)return;
      const x=THREE.MathUtils.lerp(m.oldX,m.x,alpha),s=THREE.MathUtils.lerp(m.oldS,m.s,alpha),y=THREE.MathUtils.lerp(m.oldY,m.y,alpha);
      slot.rocket.position.set(x,y,sceneZ(s,origin));
      this.direction.set(Math.sin(m.yaw),Math.max(-.2,Math.min(.2,(m.y-m.oldY)/Math.max(.01,Math.hypot(m.x-m.oldX,m.s-m.oldS)))),-Math.cos(m.yaw)).normalize();
      slot.rocket.quaternion.setFromUnitVectors(this.forward,this.direction);
      slot.flame.scale.setScalar(reduced?1:1+Math.sin(m.age*46)*.1);
      const position=slot.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      position.setXYZ(0,x,y,sceneZ(s,origin));
      m.trail.forEach((p,j)=>{if(j>0)position.setXYZ(j,p.x,p.y,sceneZ(p.s,origin));});
      position.needsUpdate=true;slot.trail.geometry.setDrawRange(0,Math.max(1,m.trail.length));
    });
  }
  get diagnostics(){return {visible:this.slots.filter(s=>s.rocket.visible).length,capacity:MISSILE_CAPACITY};}
}
