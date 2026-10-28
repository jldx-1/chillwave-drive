import * as THREE from 'three';
import type { Contact } from './collisions';
interface Fragment { x:number; y:number; s:number; vx:number; vy:number; vs:number; life:number; max:number; spark:boolean }
export const EXPLOSION_DURATION = 4;
export class CrashEffects {
  private slots: Fragment[] = Array.from({ length: 512 }, () => ({ x:0,y:0,s:0,vx:0,vy:0,vs:0,life:0,max:1,spark:false }));
  private cursor = 0; private active = 0;
  private geometry = new THREE.BufferGeometry();
  private positions = new Float32Array(512*3); private colors = new Float32Array(512*3);
  readonly points: THREE.Points;
  private blast = new THREE.Group();
  private fire = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, .8, .035), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  private flames: THREE.Mesh[] = [];
  private smoke = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#252c34', transparent: true, depthWrite: false }));
  private debris: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
  private blastAge = 10; private blastX = 0; private blastS = 0;
  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.points=new THREE.Points(this.geometry,new THREE.PointsMaterial({size:.09,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));this.points.frustumCulled=false;scene.add(this.points);
    const geometry = new THREE.BoxGeometry(.35, .16, .6), material = new THREE.MeshStandardMaterial({ color: '#008baa', metalness: .7, roughness: .5 });
    for (let i = 0; i < 14; i++) { const mesh = new THREE.Mesh(geometry, material); this.debris.push(mesh); this.blast.add(mesh); }
    this.fire.renderOrder = 2; this.smoke.renderOrder = 1;
    for (let i = 0; i < 6; i++) { const flame = new THREE.Mesh(this.fire.geometry, this.fire.material); flame.renderOrder = 2; this.flames.push(flame); this.blast.add(flame); }
    this.blast.add(this.fire, this.smoke); this.blast.visible = false; scene.add(this.blast);
  }
  /** Draw these shared materials/buffers during loading, without showing an explosion on screen. */
  warmup(draw: () => void): void {
    const count = this.geometry.drawRange.count, visible = this.blast.visible;
    this.blast.visible = true; this.geometry.setDrawRange(0, 512);
    try { draw(); } finally { this.blast.visible = visible; this.geometry.setDrawRange(0, count); }
  }
  explode(x: number, s: number): void {
    this.blastX = x; this.blastS = s; this.blastAge = 0;
    this.emit({ a: -1, b: 0, x, s, nx: 0, ns: 0, speed: 40, impulse: 0, material: 'metal' });
  }
  emit(c:Contact):void {
    const count=Math.min(60,Math.ceil(c.speed*2));
    for(let i=0;i<count;i++){
      const p=this.slots[this.cursor]; this.cursor=(this.cursor+1)%512;
      if(p.life<=0)this.active++;
      const spark=i%3!==0;
      p.x=c.x;p.y=spark?.35:.05;p.s=c.s;p.vx=(Math.random()-.5)*4+c.nx*2;p.vy=Math.random()*2;p.vs=(Math.random()-.5)*4+c.ns*2;
      p.life=p.max=spark?.55:1.1;p.spark=spark;
    }
  }
  update(dt:number,origin:number,reduced:boolean):void {
    this.blastAge += dt;
    const age = this.blastAge;
    this.blast.visible = age < EXPLOSION_DURATION;
    if (this.blast.visible) {
    this.blast.position.set(this.blastX, 0, -(this.blastS - origin));
    this.fire.visible = age < 1.2;
    this.fire.position.y = .9 + age * .7; this.fire.scale.setScalar(reduced ? 1.7 : 1 + age * 4);
    this.fire.material.opacity = Math.max(0, 1 - age / 1.2) * (reduced ? .6 : .9);
    this.flames.forEach((flame, i) => {
      const angle = i * 2.4, size = this.fire.scale.x;
      flame.visible = this.fire.visible;
      flame.position.set(Math.sin(angle) * size * .7, this.fire.position.y + Math.cos(angle * 2) * size * .55, Math.cos(angle) * size * .6);
      flame.scale.setScalar(size * (.55 + i % 3 * .1));
    });
    this.smoke.position.y = 1 + age * 1.1; this.smoke.scale.set(1.4 + age, 1 + age * .8, 1.4 + age);
    this.smoke.material.opacity = Math.max(0, .6 * (1 - age / EXPLOSION_DURATION));
    this.debris.forEach((mesh, i) => {
      const angle = i * 2.4, radius = Math.min(age, 1.6) * (2 + i % 4) * (reduced ? .35 : 1);
      mesh.position.set(Math.sin(angle) * radius, Math.max(.12, .6 + (3 + i % 3) * age - 4.9 * age * age), Math.cos(angle) * radius);
      mesh.rotation.set(age * (i % 3 + 1), angle + age, age * 2);
    });
    }
    if (!this.active) return;
    let i=0;
    for(const p of this.slots){
      if(p.life<=0)continue;
      p.life-=dt;if(p.life<=0){this.active--;continue;}
      p.x+=p.vx*dt;p.s+=p.vs*dt;p.vy-=9.81*dt;p.y+=p.vy*dt;
      if(p.y<.02){p.y=.02;p.vy*=-.18;p.vx*=.8;p.vs*=.8;}
      const index=i++*3,a=p.life/p.max;
      this.positions[index]=p.x;this.positions[index+1]=p.y;this.positions[index+2]=-(p.s-origin);
      this.colors[index]=p.spark?a:a*.5;this.colors[index+1]=p.spark?a*.53:a*.64;this.colors[index+2]=p.spark?a*.12:a*.74;
    }
    this.geometry.setDrawRange(0,reduced?0:i);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
  get diagnostics() { return { age:this.blastAge, smoke:this.blast.visible, particles:this.active }; }
  reset():void{for(const p of this.slots)p.life=0;this.active=0;this.cursor=0;this.geometry.setDrawRange(0,0);this.blastAge=10;this.blast.visible=false;}
}
