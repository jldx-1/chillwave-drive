import { CYBER_VEHICLES } from '../src/drive/cyber-vehicles';
import { describe, expect, it } from 'vitest';
import { LANES, STEP, TUNE } from '../src/drive/config';
import { Traffic, type Agent } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';

function pursuit(speed = 22, gap = 120): { traffic: Traffic; player: Vehicle; cop: Agent } {
  const traffic = new Traffic('PURSUIT', 'low'), player = new Vehicle();
  traffic.reset();
  const cop = traffic.agents.find(a => a.kind === 'police')!;
  Object.assign(cop, { x: LANES[1], oldX: LANES[1], targetX: LANES[1], lane: 1, s: -gap, oldS: -gap, speed });
  traffic.agents = [cop]; traffic.activate(cop);
  player.x = LANES[1]; player.speed = TUNE.maxSpeed;
  player.setWorldVelocity(0, player.speed);
  return { traffic, player, cop };
}

function movePlayer(player: Vehicle, speed: number): void {
  player.previous = { x: player.x, s: player.s, yaw: 0 };
  player.setWorldVelocity(0, speed);
  player.s += speed * STEP;
}

describe('police pursuit pace and traffic navigation', () => {
  it('catches and rear-quarters a player at maximum highway speed without relocating', () => {
    const { traffic, player, cop } = pursuit();
    let fastest = 0, contacts = 0, farthest = 0, attacks=0, rearHits=0,firstContact=Infinity;
    for (let frame = 0; frame < 70 / STEP; frame++) {
      const before = cop.s;
      movePlayer(player, TUNE.maxSpeed);
      const event=traffic.step(STEP,player,frame*STEP);
      contacts+=event.contacts.length;if(event.contacts.length&&firstContact===Infinity)firstContact=frame*STEP;
      rearHits+=event.contacts.filter(contact=>contact.s<player.s-1&&contact.impulse>100).length;
      expect(cop.s - before).toBeGreaterThanOrEqual(0);
      expect(cop.s - before).toBeLessThanOrEqual(CYBER_VEHICLES[cop.model!].speed * STEP + 1e-7);
      attacks+=Number(cop.state==='ramming');
      fastest = Math.max(fastest, cop.speed);
      farthest = Math.max(farthest, player.s - cop.s);
    }
    console.log('interceptor catch',JSON.stringify({firstContact,fastest}));
    expect(firstContact).toBeLessThan(24);expect(fastest).toBeGreaterThan(TUNE.maxSpeed+20);
    expect(player.s - cop.s).toBeLessThan(31);
    expect(attacks).toBeGreaterThan(60);expect(rearHits).toBeGreaterThan(0);
    expect(player.s - cop.s).toBeLessThan(farthest / 5);
    expect(contacts).toBeGreaterThan(0);expect(player.damage).toBeGreaterThan(0);
    expect(cop.active).toBe(true);
  });

  it('presses a braking player with real impacts and contains it for the timed arrest', () => {
    const { traffic, player, cop } = pursuit(TUNE.maxSpeed, 28);
    let bumperClearance = Infinity, contacts = 0;
    for (let frame = 0; frame < 24 / STEP; frame++) {
      const speed = Math.max(0, TUNE.maxSpeed - frame * STEP * 6.5);
      movePlayer(player, speed);
      contacts += traffic.step(STEP, player, frame * STEP).contacts.length;
      bumperClearance = Math.min(bumperClearance, player.s - cop.s - (cop.length + TUNE.length) / 2);
    }
    expect(contacts).toBeGreaterThan(0);
    expect(bumperClearance).toBeLessThan(1);
    expect(cop.speed).toBeLessThan(.1);
    expect(player.s-cop.s).toBeGreaterThan(0);expect(player.s-cop.s).toBeLessThan(14);
    expect(traffic.capture).toBe(5);
  });

  it('holds the chosen free lane until it has overtaken slower traffic', () => {
    const { traffic, player, cop } = pursuit(50, 200);
    player.x = cop.x = cop.oldX = cop.targetX = LANES[0]; cop.lane = 0;
    const blocker: Agent = { ...cop, id: 900, kind: 'sedan', active: false, s: cop.s + 55, oldS: cop.s + 55, speed: 22, desired: 22, cooldown: 100 };
    traffic.agents.push(blocker);
    let passed = false, contacts = 0, heldFrames = 0;
    for (let frame = 0; frame < 12 / STEP; frame++) {
      movePlayer(player, 55);
      contacts += traffic.step(STEP, player, frame * STEP).contacts.length;
      const clearance=(cop.length+blocker.length)/2+10;
      if (cop.s - blocker.s < clearance) {
        expect(cop.targetX).toBe(LANES[1]);
        heldFrames++;
      } else passed = true;
    }
    expect(heldFrames).toBeGreaterThan(120);
    expect(passed).toBe(true);
    expect(cop.s).toBeGreaterThan(blocker.s + 50);
    expect(contacts).toBe(0);
  });

  it('uses model-specific civilian acceleration and steady cruising speed', () => {
    const traffic = new Traffic('CIVILIANS', 'low'), player = new Vehicle(); traffic.reset();
    const car = traffic.agents.find(a => a.kind !== 'police' && a.direction === 1)!;
    Object.assign(car, { x: LANES[1], targetX: LANES[1], lane: 1, s: 100, oldS: 100, speed: 20, desired: 30, cooldown: 100 });
    traffic.agents = [car];
    for (let frame = 0; frame < 60; frame++) traffic.step(STEP, player, frame * STEP);
    expect(car.speed).toBeCloseTo(20+(car.model?CYBER_VEHICLES[car.model].acceleration:3),6);
    for (let frame = 60; frame < 360; frame++) traffic.step(STEP, player, frame * STEP);
    expect(car.speed).toBeCloseTo(30, 6);
    expect(traffic.activePolice).toHaveLength(0);
    expect(car.x).toBe(LANES[1]);
  });
});
