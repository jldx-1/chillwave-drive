import { describe,it,expect } from 'vitest';
import { solveContact,type Body2D } from '../src/drive/collisions';
import { Traffic } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';
import { STEP } from '../src/drive/config';
import { roadsideObstacles } from '../src/drive/road';
import { buildingSpec } from '../src/drive/buildings';
const body=(id:number,overrides:Partial<Body2D>={}):Body2D=>({id,x:6.5,s:0,oldX:6.5,oldS:0,vx:0,vs:0,yaw:0,spin:0,mass:1500,width:1.95,length:4.6,...overrides});
describe('momentum and crash response',()=>{
  it('rear impacts slow the striker, accelerate the other car and conserve linear momentum',()=>{
    const a=body(0,{s:6,oldS:2,vs:40}),b=body(1,{s:9,oldS:9,vs:10,mass:2200});
    const momentum=a.vs*a.mass+b.vs*b.mass,energy=.5*a.mass*a.vs**2+.5*b.mass*b.vs**2;
    const c=solveContact(a,b)!;expect(c.speed).toBeGreaterThan(25);expect(a.vs).toBeLessThan(40);expect(b.vs).toBeGreaterThan(10);expect(a.vs*a.mass+b.vs*b.mass).toBeCloseTo(momentum,5);expect(.5*a.mass*a.vs**2+.5*b.mass*b.vs**2).toBeLessThan(energy);
  });
  it('side swipes transfer lateral momentum and rotate offset bodies',()=>{
    const a=body(0,{x:2,oldX:1,vx:12,s:0}),b=body(1,{x:3.5,oldX:3.5,s:1.1});const c=solveContact(a,b)!;
    expect(c.nx).toBeGreaterThan(.9);expect(a.vx).toBeLessThan(12);expect(b.vx).toBeGreaterThan(0);expect(Math.abs(a.spin)+Math.abs(b.spin)).toBeGreaterThan(.01);
  });
  it('off-center friction dissipates total linear and rotational energy',()=>{
    const a=body(0,{x:2,s:0,oldX:2,oldS:0,vx:8,vs:35,spin:.2}),b=body(1,{x:3.2,s:2,oldX:3.2,oldS:2,vx:0,vs:12,spin:0,mass:2400});
    const energy=(v:Body2D)=>.5*v.mass*(v.vx**2+v.vs**2)+.5*v.mass*(v.width**2+v.length**2)/12*v.spin**2;
    const before=energy(a)+energy(b);solveContact(a,b);expect(energy(a)+energy(b)).toBeLessThanOrEqual(before+.001);
  });
  it('continuous relative sweeps stop high speed tunneling in either direction',()=>{
    const a=body(0,{s:100,oldS:0,vs:100}),b=body(1,{s:50,oldS:50});expect(solveContact(a,b)).toBeDefined();expect(a.s).toBeLessThan(b.s);expect(b.vs).toBeGreaterThan(0);
    expect(solveContact(body(0,{x:12,s:100,oldS:0,vs:100}),body(1,{s:50,oldS:50}))).toBeUndefined();
  });
  it('separates resting overlap without inventing momentum',()=>{
    const a=body(0),b=body(1,{s:3});const before=b.s-a.s;solveContact(a,b);expect(b.s-a.s).toBeGreaterThan(before);expect(a.vs+b.vs).toBe(0);
  });
  it('integrates traffic-to-traffic collisions and fixed roadside obstacles',()=>{
    const t=new Traffic('COLLIDE'),p=new Vehicle();t.reset();const a=t.agents.find(a=>a.kind==='sedan')??t.agents[2],b=t.agents.find(v=>v!==a&&v.direction===a.direction)!;
    a.direction=b.direction=1;a.x=b.x=6.5;a.targetX=b.targetX=6.5;a.s=50;b.s=54;a.speed=40;b.speed=5;t.agents=[a,b];p.s=-30;p.previous={x:p.x,s:-30,yaw:0};
    const result=t.step(STEP,p,0);expect(result.contacts.length).toBeGreaterThan(0);expect(b.speed).toBeGreaterThan(5);expect(a.speed).toBeLessThan(40);
    const obstacle=roadsideObstacles(3075)[0];expect(obstacle).toBeDefined();t.agents=[];p.x=obstacle.x;p.s=obstacle.s-1;p.previous={x:p.x,s:obstacle.s-5,yaw:0};p.speed=30;
    expect(t.step(STEP,p,1).contacts.some(c=>c.material==='concrete')).toBe(true);expect(p.speed).toBeLessThan(20);expect(p.damage).toBeGreaterThan(0);
  });
  it('major damage reduces acceleration and creates alignment error',()=>{
    const a=new Vehicle(),b=new Vehicle();b.collide(60);for(let i=0;i<180;i++){a.step(STEP,{throttle:1,brake:0,steer:0,handbrake:false,rear:false});b.step(STEP,{throttle:1,brake:0,steer:0,handbrake:false,rear:false});}expect(b.speed).toBeLessThan(a.speed);expect(b.alignment).not.toBe(0);
  });
});
describe('modular architecture',()=>{
  it('is reproducible with multiple silhouettes and setbacks across streamed chunks',()=>{
    const specs=Array.from({length:100},(_,i)=>buildingSpec('CITY',i,1,1));expect(new Set(specs.map(s=>s.style)).size).toBe(5);expect(new Set(specs.map(s=>s.height)).size).toBeGreaterThan(90);expect(buildingSpec('CITY',5,1,1)).toEqual(buildingSpec('CITY',5,1,1));
  });
});
