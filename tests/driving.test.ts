import { describe, it, expect } from 'vitest';
import { Vehicle, sweptHit, steeringLimit } from '../src/drive/vehicle';
import { LANES, STEP, neutral } from '../src/drive/config';
import { RoadGraph, originFor, sceneZ } from '../src/drive/road';
import { Traffic } from '../src/drive/traffic';
import { Records } from '../src/drive/storage';
const run = (car: Vehicle, seconds: number, controls = neutral(), wet = true) => { for (let i = 0; i < Math.round(seconds / STEP); i++) car.step(STEP, controls, wet); };
describe('driving dynamics', () => {
  it('accelerates by force, shifts gears and brakes with finite stopping distance', () => {
    const v = new Vehicle(); v.x=2.9; run(v, 10, { ...neutral(), throttle: 1 });
    expect(v.pitch).toBeGreaterThan(0); expect(v.speed).toBeGreaterThan(35); expect(v.gear).toBeGreaterThan(2); expect(v.rpm).toBeGreaterThan(850);
    const before = v.s, velocity = v.speed; run(v, .5, { ...neutral(), brake: 1 });
    expect(v.speed).toBeGreaterThan(0); expect(v.speed).toBeLessThan(velocity); expect(v.s - before).toBeGreaterThan(10);
    run(v, 7, { ...neutral(), brake: 1 }); expect(v.speed).toBe(0);
  });
  it('steering rotates heading with inertia and high speed reduces wheel angle', () => {
    const slow = new Vehicle(), fast = new Vehicle(); slow.speed = 8; fast.speed = 50;
    run(slow, .25, { ...neutral(), steer: 1 }); run(fast, .25, { ...neutral(), steer: 1 });
    expect(slow.steering).toBeGreaterThan(fast.steering); expect(slow.yaw).toBeGreaterThan(0);
    expect(slow.x).toBeGreaterThan(6.5); const oldYaw = slow.yaw;
    run(slow, .1); expect(slow.yaw).toBeGreaterThan(oldYaw); expect(slow.steering).toBeGreaterThan(0);
  });
  it('wet grip and handbraking increase slip; road bounds prevent escaping', () => {
    const wet = new Vehicle(), dry = new Vehicle(); wet.speed = dry.speed = 60;
    run(wet, .4, { ...neutral(), steer: 1 }, true); run(dry, .4, { ...neutral(), steer: 1 }, false);
    expect(wet.slip).toBeGreaterThan(dry.slip);
    run(wet, 2, { ...neutral(), throttle: 1, steer: 1, handbrake: true });
    expect(wet.slip).toBeGreaterThan(.2); expect(wet.x).toBeLessThanOrEqual(15.45);
  });
  it('centers the wheels while preserving the chosen heading after steering is released', () => {
    for(const direction of [-1,1]){
      const car=new Vehicle();car.x=8.35;car.speed=20;
      run(car,.2,{...neutral(),steer:direction});run(car,.4);
      const heading=car.yaw,x=car.x;expect(heading*direction).toBeGreaterThan(.04);
      run(car,1);expect(Math.abs(car.yaw-heading)).toBeLessThan(.004);
      expect((car.x-x)*direction).toBeGreaterThan(.7);expect(Math.abs(car.steering)).toBeLessThan(.001);expect(car.damage).toBe(0);
    }
  });
  it.each([12, 30, 60])('responds promptly in either direction at %s m/s while accelerating', speed => {
    for (const direction of [-1, 1]) {
      const car = new Vehicle(); car.x = 8.35; car.speed = speed;
      run(car, .5, { ...neutral(), throttle: 1, steer: direction });
      expect((car.x - 8.35) * direction).toBeGreaterThan(.5);
      expect(car.lateral * direction).toBeGreaterThan(2.7);
      expect(Math.abs(car.slipAngle)).toBeLessThan(.1); expect(car.driftAmount).toBe(0); expect(car.damage).toBe(0);
    }
  });
  it.each([-1, 1])('can promptly reverse an existing sideways movement toward %s', direction => {
    const car = new Vehicle(); car.x = 8.35; car.yaw = Math.atan2(direction * 2, 40);
    car.setWorldVelocity(direction * 2, 40);
    run(car, .5, { ...neutral(), throttle: 1, steer: -direction });
    expect(car.steering * direction).toBeLessThan(0);
    expect(car.lateral * direction).toBeLessThan(-.3); expect(car.damage).toBe(0);
  });
  it('keeps the sensitivity slider effective for initial keyboard response', () => {
    const low = new Vehicle(), high = new Vehicle(); low.speed = high.speed = 35;
    for (let i = 0; i < 6; i++) {
      low.step(STEP, { ...neutral(), steer: 1 }, true, .5);
      high.step(STEP, { ...neutral(), steer: 1 }, true, 1.5);
    }
    expect(high.x - 6.5).toBeGreaterThan((low.x - 6.5) * 1.25);
  });
  it('uses longer wet stopping distances, holds the brake at rest and requires a new press for reverse', () => {
    const wet = new Vehicle(), dry = new Vehicle(); wet.speed = dry.speed = 30;
    const brake = { ...neutral(), brake: 1 };
    run(wet, 8, brake, true); run(dry, 8, brake, false);
    expect(wet.s).toBeGreaterThan(dry.s * 1.2); expect(wet.speed).toBe(0); expect(dry.speed).toBe(0);
    run(wet, 3, brake); expect(wet.speed).toBe(0);
    const rolling = new Vehicle(); rolling.speed = .1; run(rolling, 1, brake); expect(rolling.speed).toBe(0);
    run(wet, .1); run(wet, 1, brake); expect(wet.speed).toBeLessThan(-1);
    run(wet, 2, { ...neutral(), throttle: 1 }); expect(wet.speed).toBeGreaterThan(0);
  });
  it('gives braking priority when both pedals are pressed, including at rest and in reverse', () => {
    const both = { ...neutral(), throttle: 1, brake: 1 };
    const parked = new Vehicle(); run(parked, 2, both); expect(parked.speed).toBe(0);
    const forward = new Vehicle(); forward.speed = 15; run(forward, 4, both); expect(forward.speed).toBe(0);
    const reverse = new Vehicle(); reverse.speed = -7; run(reverse, 2, both); expect(reverse.speed).toBe(0);
  });
  it('retains collision velocity magnitude instead of amplifying speed at a yaw angle', () => {
    const car = new Vehicle(); car.yaw = .9; car.setWorldVelocity(12, 20);
    expect(car.speed ** 2).toBeCloseTo(12 ** 2 + 20 ** 2, 8);
    expect(car.lateral).toBe(12); expect(car.velocityS).toBeCloseTo(20, 8);
    car.reset(); expect(car.velocityS).toBe(0); expect(car.yawRate).toBe(0);
  });
  it('sweeps fast relative motion instead of missing impacts between frames', () => {
    const box = { x: 6.5, s: 50, width: 2, length: 4.6 };
    expect(sweptHit({ x: 6.5, s: 0, yaw: 0 }, { x: 6.5, s: 100, yaw: 0 }, box, box)).toBe(true);
    expect(sweptHit({ x: 12, s: 0, yaw: 0 }, { x: 12, s: 100, yaw: 0 }, box, box)).toBe(false);
    const car = new Vehicle(); car.speed = 50; expect(car.collide(40)).toBe(true); expect(car.damage).toBe(50); expect(car.speed).toBe(50);
    expect(car.collide(40)).toBe(false);
  });
  it('interpolates poses, resets completely and does not tie dynamics to render cadence', () => {
    const a = new Vehicle(), b = new Vehicle(); const throttle = { ...neutral(), throttle: 1 };
    run(a, 6, throttle); for (let frame = 0; frame < 90; frame++) for (let i = 0; i < 4; i++) b.step(STEP, throttle);
    expect(a.s).toBeCloseTo(b.s, 8); expect(a.pose(.5).s).toBeLessThan(a.s); a.reset(); expect(a.s).toBe(0); expect(a.damage).toBe(0);
  });
});
describe('road graph and precision', () => {
  it('connects each service loop to the highway at explicit endpoints', () => {
    const graph = new RoadGraph();
    for (let i = 0; i < 100; i++) {
      const exit = i * graph.interval + graph.exitAt; expect(graph.branchCenter(exit)).toBeCloseTo(LANES[3]);
      expect(graph.branchCenter(exit + 900)).toBeCloseTo(LANES[3]); expect(graph.branchCenter(exit + 450)).toBeGreaterThan(26);
      expect(graph.routeAt(exit + 450)?.rejoin).toBe(exit + 900);
      expect(graph.validateNetwork(i)).toEqual([]);
      let previous = LANES[3];
      for (let d = 0; d <= 900; d++) { const center = graph.branchCenter(exit + d)!; expect(Math.abs(center - previous)).toBeLessThan(.2); expect(graph.constrain(center, exit + d)).toBe(center); previous = center; }
    }
  });
  it('drives the complete detour with the same steering dynamics and rejoins', () => {
    const graph = new RoadGraph(), p = new Vehicle(); p.s = 790; p.x = 14; p.speed = 22;
    let usedLoop = false;
    for (let i = 0; i < 60 * 65 && p.s < 1720; i++) {
      const target = graph.branchCenter(p.s + 18) ?? 14;
      const heading = Math.atan2(target - p.x, 18);
      const maxSteer = steeringLimit(p.speed);
      const steer = Math.max(-1, Math.min(1, Math.atan((heading - p.yaw) * 3 * 2.7 / Math.max(1, p.speed)) / maxSteer));
      p.step(STEP, { ...neutral(), steer, throttle: p.speed < 22 ? .27 : 0 });
      if (p.s > 1100 && p.s < 1400 && p.x > 23) usedLoop = true;
    }
    expect(usedLoop).toBe(true); expect(p.s).toBeGreaterThan(1700); expect(p.x).toBeLessThan(16); expect(p.damage).toBeLessThan(5);
  });
  it('preserves relative positions and distance across arbitrarily distant origin shifts', () => {
    for (const s of [999.9, 1000.1, 1234567.8, 1000000000.1]) {
      const origin = originFor(s); expect(Math.abs(sceneZ(s, origin))).toBeLessThan(1000);
      expect(sceneZ(s + 200, origin) - sceneZ(s, origin)).toBeCloseTo(-200);
      expect(origin - sceneZ(s, origin)).toBeCloseTo(s);
    }
  });
});
describe('traffic and pursuit', () => {
  it('spawns safely spaced traffic and quiet police patrols ahead', () => {
    const t = new Traffic('SAFE'); t.reset();
    for (const a of t.agents) {
      if (a.kind === 'police') {expect(a.s).toBeGreaterThan(50);expect(a.active).toBe(false);} else expect(a.s).toBeGreaterThanOrEqual(130);
      expect(Math.sign(a.x)).toBe(a.direction);
      if (a.kind !== 'police') for (const b of t.agents) if (a !== b && a.lane === b.lane && a.direction === b.direction) expect(Math.abs(a.s - b.s)).toBeGreaterThanOrEqual(34);
    }
  });
  it('moves oncoming traffic toward the player and keeps a bounded population after recycling', () => {
    const p = new Vehicle(), t = new Traffic('STREAM', 'dense'); t.reset(); const count = t.agents.length;
    const oncoming = t.agents.find(a => a.direction === -1)!; const before = oncoming.s;
    t.step(STEP, p, STEP); expect(oncoming.s).toBeLessThan(before);
    for (let i = 0; i < 9000; i++) { p.s = i * 2; p.distance = p.s; p.speed = 40; p.previous = { x: p.x, s: p.s, yaw: 0 }; t.step(STEP, p, i * STEP); }
    expect(t.agents.length).toBeLessThanOrEqual(count + 3); expect(t.agents.every(a => Number.isFinite(a.x + a.s + a.speed))).toBe(true);
  });
  it('reproduces traffic and uses a sustained capture timer rather than instant touch failure', () => {
    const a = new Traffic('SEED'), b = new Traffic('SEED'); a.reset(); b.reset(); expect(a.agents).toEqual(b.agents);
    const p = new Vehicle(); const cop = a.agents.find(v => v.kind === 'police')!; a.agents = [cop];
    a.activate(cop); cop.s = -7; cop.speed = 0; cop.x = p.x; cop.targetX = p.x;
    a.step(STEP, p, 0); expect(a.capture).toBeCloseTo(STEP); expect(a.capture).toBeLessThan(5);
    for (let i = 0; i < 310; i++) a.step(STEP, p, i * STEP);
    expect(a.capture).toBe(5); expect(cop.state).toBe('following');
    p.speed = 15; a.step(1, p, 7); expect(a.capture).toBeLessThan(5);
  });
  it('overtaking a patrol activates it without adding or relocating police', () => {
    const t=new Traffic('PASS'),p=new Vehicle();t.reset();const cop=t.agents.find(a=>a.kind==='police')!;t.agents=[cop];
    const beforeId=cop.id,beforeS=cop.s;p.x=6.5;p.previous={x:p.x,s:beforeS-1,yaw:0};p.s=beforeS+1;p.speed=30;
    const result=t.step(STEP,p,1);expect(result.joined).toBe(1);expect(cop.active).toBe(true);expect(t.level).toBe(1);expect(t.agents).toHaveLength(1);expect(cop.id).toBe(beforeId);expect(Math.abs(cop.s-beforeS)).toBeLessThan(1);
    p.s+=2500;p.previous={x:p.x,s:p.s,yaw:0};t.step(STEP,p,2);expect(t.agents.some(a=>a.id===beforeId&&a.active)).toBe(true);
  });
  it('does not alert patrols when the player is behind, or recycles an active unit',()=>{
    const t=new Traffic('QUIET'),p=new Vehicle();t.reset();for(let i=0;i<60;i++){p.previous={x:p.x,s:p.s,yaw:0};t.step(STEP,p,i*STEP);}expect(t.activePolice).toHaveLength(0);expect(t.level).toBe(0);expect(t.capture).toBe(0);
  });
  it('encountered additional patrols join an existing pursuit and avoid occupied lanes',()=>{
    const t=new Traffic('JOIN'),p=new Vehicle();t.reset();const cops=t.agents.filter(a=>a.kind==='police');expect(cops.length).toBeGreaterThan(1);t.activate(cops[0]);
    const other=cops[1];p.previous={x:p.x,s:other.s-2,yaw:0};p.s=other.s+2;p.speed=30;t.step(STEP,p,2);expect(t.activePolice).toHaveLength(2);expect(t.joins).toBe(2);
    const a=t.agents.find(a=>a.kind!=='police'&&a.direction===1)!;t.agents.push({...a,id:9999,s:a.s+5});expect(t.laneSafe(a,a.lane)).toBe(false);
  });
});
describe('drive records', () => {
  it('persists camera/audio controls and records, validates corrupt preferences, and tolerates storage failure', () => {
    const map = new Map<string, string>(); const storage = { getItem: (k: string) => map.get(k) || null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const a = new Records(storage); a.settings.view = 'cockpit'; a.settings.musicVolume = .2; a.save();
    a.finish({ distance: 1234, time: 60, topSpeed: 150, nearMisses: 2, level: 2, detours: 0 });
    const b = new Records(storage); expect(b.settings.view).toBe('cockpit'); expect(b.settings.musicVolume).toBe(.2); expect(b.best).toBe(1234);
    const broken = new Records({ getItem: () => '{broken', setItem: () => { throw Error('blocked'); } }); expect(broken.available).toBe(false); expect(() => broken.save()).not.toThrow();
  });
});
