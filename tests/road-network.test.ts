import { describe, expect, it } from 'vitest';
import { LANES, POLICE_TUNE, STEP, TUNE, VEHICLE_DIMENSIONS, neutral } from '../src/drive/config';
import { RoadGraph, overpassesAt, road } from '../src/drive/road';
import { Traffic, type Agent } from '../src/drive/traffic';
import { Vehicle, steeringLimit } from '../src/drive/vehicle';

function agent(traffic: Traffic, kind: Agent['kind'], id: number, s: number, x = LANES[3]): Agent {
  const source = traffic.agents.find(a => a.kind === 'police')!;
  return { ...source, id, kind, ...VEHICLE_DIMENSIONS[kind], direction: 1, x, oldX: x, targetX: x,
    s, oldS: s, speed: 24, desired: 30, lane: 3, yaw: 0, active: false, cooldown: 100, route: 'main', routeId: undefined };
}
function advance(traffic: Traffic, player: Vehicle, frame: number): void {
  player.previous = { x: player.x, s: player.s, yaw: player.yaw };
  traffic.step(STEP, player, frame * STEP);
}

describe('connected highway exit and reentry topology', () => {
  it('validates both travel directions and reachable detours far beyond the initial chunks', () => {
    const graph = new RoadGraph();
    for (const id of [0, 1, 17, 330, 333333]) {
      expect(graph.validateNetwork(id)).toEqual([]);
      const network = graph.networkAt(id * graph.interval + 900);
      expect(network.edges.filter(e => e.kind !== 'highway').map(e => e.kind)).toEqual(['deceleration', 'exit', 'service', 'return', 'acceleration']);
      expect(network.lanes.filter(l => l.direction === -1)).toHaveLength(12);
      const fork = network.lanes.find(l => l.edge === `main:${id}:1:3:0`)!;
      expect(fork.successors).toHaveLength(2);
      expect(network).toEqual(graph.networkAt(id * graph.interval + 900));
    }
  });
  it('shares positions and tangents at every ramp boundary with a real deceleration and acceleration lane', () => {
    const graph = new RoadGraph();
    for (const s of [900, 1080, 1420, 1600]) {
      const a = graph.sampleDetour(s - .001)!, b = graph.sampleDetour(s + .001)!;
      expect(Math.abs(a.x - b.x)).toBeLessThan(.001);
      expect(Math.abs(a.tangentX - b.tangentX)).toBeLessThan(.001);
      expect(Math.abs(a.curvature - b.curvature)).toBeLessThan(.001);
    }
    expect(graph.sampleDetour(800)?.x).toBe(LANES[3]);
    expect(graph.sampleDetour(1700)?.x).toBe(LANES[3]);
    expect(graph.sampleDetour(850)?.phase).toBe('deceleration');
    expect(graph.sampleDetour(1650)?.phase).toBe('acceleration');
    expect(graph.entryWindow(650)?.exit).toBe(800);
    expect(graph.entryWindow(1100)).toBeUndefined();
    expect(graph.mergeWindow(1650)?.rejoin).toBe(1700);
    expect(graph.routeAt(1250)?.district).toBe('commercial');
    expect(graph.routeAt(graph.interval + 1250)?.district).toBe('industrial');
    for (let s = 800; s <= 1700; s += 5) {
      const sample = graph.sampleDetour(s)!;
      expect(graph.corridorAt(s).some(([a, b]) => sample.x - 3.6 >= a && sample.x + 3.6 <= b)).toBe(true);
      expect(Math.abs(sample.curvature) * sample.speedLimit ** 2).toBeLessThan(3);
    }
  });
  it('uses one authoritative overpass footprint for geometry and rain shelter', () => {
    const bridge = overpassesAt(780).find(b => b.id === 6)!;
    expect(bridge).toMatchObject({ s: 780, x: 0, length: 13, underside: 8.3, thickness: 1.4 });
    expect(bridge.underside + bridge.thickness / 2).toBe(9);
    expect(overpassesAt(780 + 1080).find(b => b.id === 15)?.s).toBe(1860);
  });
  it('drives a civilian through the whole connected secondary road and naturally merges back', () => {
    const traffic = new Traffic('DETOUR', 'low'), player = new Vehicle(); traffic.reset();
    const car = agent(traffic, 'sedan', 9, 630); traffic.agents = [car];
    player.s = 1200; player.x = LANES[0];
    let service = false, ramp = false, worstStep = 0;
    for (let frame = 0; frame < 65 / STEP && car.s < 1720; frame++) {
      const x = car.x, s = car.s;
      advance(traffic, player, frame);
      worstStep = Math.max(worstStep, Math.hypot(car.x - x, car.s - s));
      if (car.s > 1080 && car.s < 1420 && car.x > 30) service = true;
      if (car.s > 900 && car.s < 1080 && car.route === 'detour') ramp = true;
    }
    expect(ramp).toBe(true); expect(service).toBe(true);
    expect(car.s).toBeGreaterThan(1700); expect(car.x).toBeLessThan(15.5);
    expect(car.route).toBe('main'); expect(car.damage).toBe(0);
    expect(worstStep).toBeLessThan(31 * STEP);
  });
  it('yields in the acceleration lane until there is a real gap on the highway', () => {
    const traffic = new Traffic('MERGE', 'low'), player = new Vehicle(); traffic.reset();
    const car = agent(traffic, 'sedan', 9, 1580, road.branchCenter(1580)!);
    Object.assign(car, { route: 'detour', routeId: 0, speed: 22 });
    const highway = agent(traffic, 'sedan', 40, 1580); highway.speed = highway.desired = 22;
    traffic.agents = [car, highway]; player.s = 1400; player.x = LANES[0];
    let yielded = false, contacts = 0;
    for (let frame = 0; frame < 16 / STEP && car.s < 1720; frame++) {
      player.previous = { x: player.x, s: player.s, yaw: 0 };
      contacts += traffic.step(STEP, player, frame * STEP).contacts.length;
      if (car.state === 'avoiding' && car.braking && car.x > 16) yielded = true;
    }
    expect(yielded).toBe(true); expect(contacts).toBe(0);
    expect(car.s).toBeGreaterThan(1700); expect(car.x).toBeLessThan(15.5);
    expect(highway.s - car.s).toBeGreaterThan(car.length + 8);
  });
  it('does not cut sideways into a detour after missing the exit', () => {
    const traffic = new Traffic('MISSED', 'low'), player = new Vehicle(); traffic.reset();
    const car = agent(traffic, 'sedan', 9, 1100, LANES[0]); traffic.agents = [car]; player.s = 1200;
    for (let frame = 0; frame < 10 / STEP; frame++) advance(traffic, player, frame);
    expect(car.route).toBe('main'); expect(car.x).toBeCloseTo(LANES[0]);
  });
});

describe('police vehicle integration', () => {
  it('retains force-based interceptor mass, grip, momentum, steering and suspension through reset', () => {
    const police = new Vehicle(POLICE_TUNE, -Infinity), player = new Vehicle();
    police.s = -120; police.speed = 20;
    for (let i = 0; i < 20; i++) police.step(STEP, { ...neutral(), throttle: 1, steer: .3 });
    expect(police.s).toBeLessThan(-100); expect(police.s).toBeGreaterThan(-120);
    expect(police.steering).toBeGreaterThan(0); expect(police.roll).toBeGreaterThan(0); expect(police.pitch).toBeGreaterThan(0);
    expect(police.tuning.mass).toBe(1900); expect(player.tuning).toBe(TUNE);
    police.yaw = .3; police.setWorldVelocity(4, 30);
    expect(police.speed ** 2).toBeCloseTo(4 ** 2 + 30 ** 2);
    police.reset(); expect(police.tuning).toBe(POLICE_TUNE); expect(police.minimumS).toBe(-Infinity);
    expect(police.speed).toBe(0); expect(police.steering).toBe(0);
  });
  it('follows a reachable player detour using steering and rejoins without relocating', () => {
    const traffic = new Traffic('COP-LOOP', 'low'), player = new Vehicle(); traffic.reset();
    const cop = agent(traffic, 'police', 1, 780); cop.speed = 22; traffic.agents = [cop]; traffic.activate(cop);
    player.s = 890; player.x = road.branchCenter(player.s)!; player.speed = 22; player.setWorldVelocity(0, 22);
    let usedService = false, peakSteering = 0, contacts = 0;
    for (let frame = 0; frame < 50 / STEP && cop.s < 1720; frame++) {
      player.previous = { x: player.x, s: player.s, yaw: 0 };
      player.s += 22 * STEP; player.x = road.branchCenter(player.s) ?? LANES[3];
      const before = { x: cop.x, s: cop.s };
      contacts += traffic.step(STEP, player, frame * STEP).contacts.length;
      expect(Math.hypot(cop.x - before.x, cop.s - before.s)).toBeLessThan(45 * STEP);
      const [lo,hi]=road.policeBounds(cop.s,cop.yaw,POLICE_TUNE.footprint,cop.route);
      expect(cop.x).toBeGreaterThanOrEqual(lo-1e-8);expect(cop.x).toBeLessThanOrEqual(hi+1e-8);
      peakSteering = Math.max(peakSteering, Math.abs(cop.steering ?? 0));
      if (cop.s > 1080 && cop.s < 1420 && cop.x > 30) usedService = true;
    }
    expect(usedService).toBe(true); expect(cop.s).toBeGreaterThan(1700);
    expect(cop.x).toBeLessThan(15.5); expect(peakSteering).toBeGreaterThan(.01);
    expect(contacts).toBe(0); expect(cop.damage).toBe(0); expect(cop.active).toBe(true);
  });
});

describe('pursuit road containment', () => {
  it('keeps every rotated body vertex on the highway through high-speed steering and impact recovery', () => {
    const traffic=new Traffic('EDGE-CHASE','low'),player=new Vehicle();traffic.reset();
    const cop=agent(traffic,'police',1,1100,15.2);traffic.agents=[cop];traffic.activate(cop);cop.speed=78;
    player.s=1160;player.speed=75;
    for(let frame=0;frame<45/STEP;frame++){
      player.previous={x:player.x,s:player.s,yaw:0};player.s+=75*STEP;player.x=frame%360<180?1.3:14.5;
      if(frame%180===0){cop.lateral=frame%360===0?18:-18;cop.yaw=frame%360===0?.5:-.5;cop.spin=Math.sign(cop.yaw)*.8;}
      traffic.step(STEP,player,frame*STEP);
      const [lo,hi]=road.policeBounds(cop.s,cop.yaw,POLICE_TUNE.footprint,'main');
      expect(cop.route).toBe('main');expect(cop.x).toBeGreaterThanOrEqual(lo-1e-8);expect(cop.x).toBeLessThanOrEqual(hi+1e-8);
      for(const [x,z]of POLICE_TUNE.footprint){
        const worldX=cop.x+x*Math.cos(cop.yaw)+z*Math.sin(cop.yaw);
        expect(worldX).toBeGreaterThanOrEqual(.57-1e-8);expect(worldX).toBeLessThanOrEqual(16.38+1e-8);
      }
    }
    // Repeated forced spins trade forward speed for recovery; require sustained highway progress.
    expect(cop.s-1100).toBeGreaterThan(45*35);expect(cop.active).toBe(true);
  });
  it('constrains against the selected branch instead of choosing another disconnected road',()=>{
    const s=1250,hull=POLICE_TUNE.footprint;
    expect(road.constrainPolice(24,s,.4,hull,'main')).toBeLessThan(16);
    expect(road.constrainPolice(24,s,.4,hull,'detour')).toBeGreaterThan(30);
    for(const base of [0,road.interval,road.interval * 333])for(let ds=800;ds<=1700;ds+=3){
      const at=base+ds,sample=road.sampleDetour(at)!,yaw=Math.atan2(sample.tangentX,sample.tangentS);
      const [lo,hi]=road.policeBounds(at,yaw,hull,'detour');
      expect(lo).toBeLessThanOrEqual(hi);expect(sample.x).toBeGreaterThanOrEqual(lo);expect(sample.x).toBeLessThanOrEqual(hi);
    }
  });
});

describe('northbound side street variety', () => {
  it('connects three different streets to the highway without reversing direction', () => {
    const graph = new RoadGraph();
    const routes = [0, 1, 2].map(id => {
      const start = id * graph.interval + graph.exitAt;
      const samples = Array.from({length: 181}, (_, i) => graph.sampleDetour(start + i * 5)!);
      expect(samples.every(s => s.tangentS > .98 && Math.abs(s.curvature) * s.speedLimit ** 2 < 3)).toBe(true);
      expect(graph.validateNetwork(id)).toEqual([]);
      return { name: graph.routeAt(start + 450)!.name, center: samples[90].x };
    });
    expect(new Set(routes.map(r => r.name)).size).toBe(3);
    expect(new Set(routes.map(r => r.center)).size).toBe(3);
  });
  it('can drive each different route from exit to reentry', () => {
    const graph = new RoadGraph();
    for (let id=0; id<3; id++) {
      const start=id*graph.interval+graph.exitAt, player=new Vehicle();
      player.s=start-10; player.x=14; player.speed=22;
      let usedStreet=false;
      for(let i=0;i<65/STEP&&player.s<start+920;i++) {
        const target=graph.branchCenter(player.s+18)??14;
        const heading=Math.atan2(target-player.x,18);
        const steer=Math.max(-1,Math.min(1,Math.atan((heading-player.yaw)*3*2.7/Math.max(1,player.speed))/steeringLimit(player.speed)));
        player.step(STEP,{...neutral(),steer,throttle:player.speed<22?.27:0});
        if(player.s>start+280&&player.s<start+620&&graph.onDetour(player.x,player.s))usedStreet=true;
      }
      expect(usedStreet).toBe(true);expect(player.s).toBeGreaterThan(start+900);
      expect(player.x).toBeLessThan(16);expect(player.damage).toBeLessThan(5);
    }
  });
});
