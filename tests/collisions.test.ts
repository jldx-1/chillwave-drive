import { describe,it,expect } from 'vitest';
import { solveContact,isSevereVehicleImpact,type Body2D } from '../src/drive/collisions';
import { Traffic } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';
import { STEP } from '../src/drive/config';
import { buildingSpec } from '../src/drive/buildings';
const body=(id:number,overrides:Partial<Body2D>={}):Body2D=>({id,x:6.5,s:0,oldX:6.5,oldS:0,vx:0,vs:0,yaw:0,spin:0,mass:1500,width:1.95,length:4.6,...overrides});
describe('momentum and crash response',()=>{
  it('rear impacts slow the striker, accelerate the other car and conserve linear momentum',()=>{
    const a=body(0,{s:6,oldS:2,vs:40}),b=body(1,{s:9,oldS:9,vs:10,mass:2200});
    const momentum=a.vs*a.mass+b.vs*b.mass,energy=.5*a.mass*a.vs**2+.5*b.mass*b.vs**2;
    const c=solveContact(a,b)!;expect(c.speed).toBeGreaterThan(25);expect(a.vs).toBeLessThan(40);expect(b.vs).toBeGreaterThan(10);expect(a.vs*a.mass+b.vs*b.mass).toBeCloseTo(momentum,5);expect(.5*a.mass*a.vs**2+.5*b.mass*b.vs**2).toBeLessThan(energy);
  });
  it('countersteering recovers collision spin without a lasting steering fault',()=>{
    const car=new Vehicle();car.collide(100);car.setWorldVelocity(8,30);car.spin=.65;
    for(let i=0;i<45;i++)car.step(STEP,{throttle:1,brake:0,steer:-1,handbrake:false,rear:false});
    expect(car.damage).toBe(100);expect(Math.abs(car.spin)).toBeLessThan(.002);expect(car.steering).toBeLessThan(0);expect(car.s).toBeGreaterThan(15);
    for(let i=0;i<25;i++)car.step(STEP,{throttle:1,brake:0,steer:1,handbrake:false,rear:false});
    expect(car.steering).toBeGreaterThan(0);expect(Number.isFinite(car.speed+car.yaw+car.x)).toBe(true);
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
  it('integrates traffic-to-traffic collisions',()=>{
    const t=new Traffic('COLLIDE'),p=new Vehicle();t.reset();const a=t.agents.find(a=>a.kind==='sedan')??t.agents[2],b=t.agents.find(v=>v!==a&&v.direction===a.direction)!;
    a.direction=b.direction=1;a.x=b.x=6.5;a.targetX=b.targetX=6.5;a.s=50;b.s=54;a.speed=40;b.speed=5;t.agents=[a,b];p.s=-30;p.previous={x:p.x,s:-30,yaw:0};
    const result=t.step(STEP,p,0);expect(result.contacts.length).toBeGreaterThan(0);expect(b.speed).toBeGreaterThan(5);expect(a.speed).toBeLessThan(40);
  });
  it('full damage preserves acceleration, braking and steering in either direction',()=>{
    for(const steer of [-1,1]){
      const fresh=new Vehicle(),damaged=new Vehicle();damaged.collide(100);
      for(let i=0;i<120;i++){const input={throttle:1,brake:0,steer:0,handbrake:false,rear:false};fresh.step(STEP,input);damaged.step(STEP,input);}
      const drive={throttle:1,brake:0,steer,handbrake:false,rear:false};
      for(let i=0;i<20;i++){fresh.step(STEP,drive);damaged.step(STEP,drive);}
      expect(damaged.damage).toBe(100);expect(damaged.speed).toBeCloseTo(fresh.speed,9);expect(damaged.x).toBeCloseTo(fresh.x,9);expect(damaged.steering*steer).toBeGreaterThan(0);
      const speed=damaged.speed;for(let i=0;i<30;i++)damaged.step(STEP,{...drive,throttle:0,brake:1,steer:0});
      expect(damaged.speed).toBeLessThan(speed);
    }
  });
});
describe('modular architecture',()=>{
  it('is reproducible with multiple silhouettes and setbacks across streamed chunks',()=>{
    const specs=Array.from({length:100},(_,i)=>buildingSpec('CITY',i,1,1));expect(new Set(specs.map(s=>s.style)).size).toBe(5);expect(new Set(specs.map(s=>s.height)).size).toBeGreaterThan(90);expect(buildingSpec('CITY',5,1,1)).toEqual(buildingSpec('CITY',5,1,1));
  });
});

describe('oriented collision accuracy',()=>{
  it('allows separated diagonal cars through overlapping world boxes without false impacts',()=>{
    const yaw=Math.PI/4,c=Math.cos(yaw),s=Math.sin(yaw);
    const a=body(0,{x:0,s:0,oldX:0,oldS:0,yaw});
    const b=body(1,{x:2.05*c,s:-2.05*s,oldX:2.05*c,oldS:-2.05*s,yaw});
    expect(solveContact(a,b)).toBeUndefined();
  });
  it('allows a fast diagonal pass alongside another car without hitting its enlarged world box',()=>{
    const yaw=Math.PI/4,c=Math.cos(yaw),s=Math.sin(yaw);
    const a=body(0,{oldX:0,oldS:0,x:20*s,s:20*c,yaw,vx:100*s,vs:100*c});
    const b=body(1,{x:10*s+2.1*c,s:10*c-2.1*s,oldX:10*s+2.1*c,oldS:10*c-2.1*s,yaw});
    expect(solveContact(a,b)).toBeUndefined();
  });
  it('still catches fast diagonal impacts along actual vehicle edges',()=>{
    const yaw=Math.PI/4,c=Math.cos(yaw),s=Math.sin(yaw);
    const a=body(0,{oldX:0,oldS:0,x:20*s,s:20*c,yaw,vx:100*s,vs:100*c});
    const b=body(1,{x:10*s,s:10*c,oldX:10*s,oldS:10*c,yaw});
    const hit=solveContact(a,b)!;expect(hit).toBeDefined();expect(hit.speed).toBeGreaterThan(95);expect(a.vs).toBeLessThan(100*c);expect(b.vs).toBeGreaterThan(0);
  });
  it('ignores empty bumper corners but catches the actual bumper face',()=>{
    const hull:readonly(readonly[number,number])[]=[[-1,-2],[-.6,-2.3],[.6,-2.3],[1,-2],[1,2],[.6,2.3],[-.6,2.3],[-1,2]];
    const a=body(0,{x:0,oldX:0,hull,width:2}),corner=body(1,{x:.94,s:2.23,oldX:.94,oldS:2.23,width:.1,length:.1});
    expect(solveContact(a,corner)).toBeUndefined();
    expect(solveContact(body(0,{x:0,oldX:0,hull,width:2,oldS:-.2,vs:15}),body(1,{x:0,oldX:0,s:2.3,oldS:2.3,width:.1,length:.1}))).toBeDefined();
  });
  it('does not brake or damage cars that are already separating',()=>{
    const a=body(0,{s:0,oldS:0,vs:-10}),b=body(1,{s:6,oldS:4.5,vs:10});
    expect(solveContact(a,b)).toBeUndefined();expect(a.vs).toBe(-10);expect(b.vs).toBe(10);
  });
});

describe('high-energy vehicle crashes', () => {
  it('recognizes a high-impulse heavy impact even at moderate closing speed', () => {
    const c={a:1,b:2,x:0,s:0,nx:0,ns:1,speed:20,impulse:65000,material:'metal' as const};
    expect(isSevereVehicleImpact(c)).toBe(true);
    expect(isSevereVehicleImpact({...c,impulse:5000})).toBe(false);
    expect(isSevereVehicleImpact({...c,material:'concrete'})).toBe(false);
  });
  it('destroys traffic cars in a hard car-to-car collision while preserving traffic capacity', () => {
    const t=new Traffic('CRASH'),p=new Vehicle();t.reset();const [a,b]=t.agents;
    Object.assign(a,{x:6.5,targetX:6.5,s:50,speed:60,desired:60,direction:1,yaw:0});
    Object.assign(b,{x:6.5,targetX:6.5,s:54,speed:0,desired:0,direction:1,yaw:0});
    t.agents=[a,b];p.s=-30;p.previous={x:p.x,s:-30,yaw:0};
    const event=t.step(STEP,p,0);
    expect(event.explosions.map(e=>e.id).sort()).toEqual([a.id,b.id].sort());
    expect(t.agents).toHaveLength(2);expect(t.agents).not.toContain(a);expect(t.agents).not.toContain(b);
  });
});

it('keeps swept traffic collisions at high speed when a car crosses the entire vehicle in one step', () => {
  const traffic=new Traffic('SWEEP','low'),player=new Vehicle();traffic.reset();const agent=traffic.agents.find(a=>a.direction===1)!;
  Object.assign(agent,{x:6.5,targetX:6.5,s:50,speed:0,desired:0,direction:1,yaw:0});traffic.agents=[agent];
  player.previous={x:6.5,s:0,yaw:0};player.x=6.5;player.s=100;player.speed=60;
  const hit=traffic.step(STEP,player,0);
  expect(hit.contacts.some(contact=>contact.a===-1&&contact.b===agent.id)).toBe(true);
  expect(player.exploded).toBe(true);
});
