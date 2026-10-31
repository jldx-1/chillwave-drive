import type { Vehicle } from './vehicle';

export const MISSILE_CAPACITY=4;
export interface MissileTarget { id:number;x:number;s:number;oldX:number;oldS:number;width:number;length:number;yaw:number;height?:number }
export interface Missile {
  id:number;target:number;x:number;s:number;y:number;oldX:number;oldS:number;oldY:number;yaw:number;speed:number;age:number;
  trail:{x:number;s:number;y:number}[];
}
export interface MissileHit { id:number;x:number;s:number;missile:number }
/** Fixed-step projectiles in logical world coordinates, independent of rendering and origin shifts. */
export class Missiles {
  readonly active:Missile[]=[];
  private serial=0;
  reset():void {this.active.length=0;this.serial=0;}
  launch(player:Vehicle,target:number,direction:1|-1):Missile|undefined {
    if(this.active.length>=MISSILE_CAPACITY)return;
    const yaw=player.yaw+(direction===1?0:Math.PI),reach=player.tuning.length/2+.8;
    const x=player.x+Math.sin(yaw)*reach,s=player.s+Math.cos(yaw)*reach,y=player.jumpHeight+.8;
    const missile:Missile={id:this.serial++,target,x,s,y,oldX:x,oldS:s,oldY:y,yaw,speed:Math.max(90,Math.abs(player.speed)+65),age:0,trail:[]};
    this.active.push(missile);return missile;
  }
  step(dt:number,targets:readonly MissileTarget[]):MissileHit[] {
    const hits:MissileHit[]=[],destroyed=new Set<number>();
    for(let i=this.active.length-1;i>=0;i--) {
      const m=this.active[i];m.oldX=m.x;m.oldS=m.s;m.oldY=m.y;m.age+=dt;
      const target=targets.find(t=>t.id===m.target&&!destroyed.has(t.id));
      if(target&&m.age>.07) {
        const lead=Math.min(.45,Math.hypot(target.x-m.x,target.s-m.s)/m.speed);
        const heading=Math.atan2(target.x+(target.x-target.oldX)/dt*lead-m.x,target.s+(target.s-target.oldS)/dt*lead-m.s);
        const error=Math.atan2(Math.sin(heading-m.yaw),Math.cos(heading-m.yaw));
        m.yaw+=Math.max(-3.8*dt,Math.min(3.8*dt,error));
        const height=Math.min(1.5,(target.height??1.5)*.5);
        m.y+=Math.max(-6*dt,Math.min(6*dt,height-m.y));
      }
      m.x+=Math.sin(m.yaw)*m.speed*dt;m.s+=Math.cos(m.yaw)*m.speed*dt;
      let first:MissileTarget|undefined,fraction=Infinity;
      for(const car of targets) {
        if(destroyed.has(car.id))continue;
        const at=missileContact(m,car);
        if(at!==undefined&&at<fraction){fraction=at;first=car;}
      }
      if(first) {
        destroyed.add(first.id);hits.push({id:first.id,x:m.oldX+(m.x-m.oldX)*fraction,s:m.oldS+(m.s-m.oldS)*fraction,missile:m.id});
        this.active.splice(i,1);continue;
      }
      if(m.age>=2.5){this.active.splice(i,1);continue;}
      m.trail.unshift({x:m.x,s:m.s,y:m.y});if(m.trail.length>24)m.trail.pop();
    }
    return hits;
  }
}
/** Sweep against the moving car in its own frame, including altitude, so fast shots cannot tunnel. */
export function missileContact(m:Missile,t:MissileTarget):number|undefined {
  const c=Math.cos(t.yaw),s=Math.sin(t.yaw);
  const ax=m.oldX-t.oldX,az=m.oldS-t.oldS,bx=m.x-t.x,bz=m.s-t.s;
  const from=[ax*c-az*s,m.oldY,ax*s+az*c],to=[bx*c-bz*s,m.y,bx*s+bz*c];
  const lo=[-t.width/2-.16,-.16,-t.length/2-.16],hi=[t.width/2+.16,(t.height??1.5)+.16,t.length/2+.16];
  let enter=0,exit=1;
  for(let axis=0;axis<3;axis++) {
    const delta=to[axis]-from[axis];
    if(Math.abs(delta)<1e-9){if(from[axis]<lo[axis]||from[axis]>hi[axis])return;continue;}
    const a=(lo[axis]-from[axis])/delta,b=(hi[axis]-from[axis])/delta;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return;
  }
  return enter;
}
