import { describe, expect, it } from 'vitest';
import { medianBarriers, medianGate, medianIsOpen } from '../src/drive/median';
import { PowerUps } from '../src/drive/powerups';
import { Vehicle } from '../src/drive/vehicle';
import { Traffic } from '../src/drive/traffic';
import { STEP, neutral } from '../src/drive/config';
import { road } from '../src/drive/road';
import { DriveCamera } from '../src/drive/camera';
import { MPS_TO_MPH } from '../src/drive/units';

function crash(shield = false, direction: 1 | -1 = -1, offset = 0, speed = 40, kind?: 'sedan' | 'truck') {
  const traffic = new Traffic('ARCADE'); traffic.reset();
  const agent = traffic.agents.find(a => kind ? a.kind === kind : a.kind !== 'police')!;
  const laneX = direction === -1 ? -6.5 : 6.5;
  Object.assign(agent, { x: laneX + offset, targetX: laneX + offset, s: 5.5, speed: 20, desired: 20, direction, yaw: direction === -1 ? Math.PI : 0 });
  traffic.agents = [agent];
  const player = new Vehicle(); player.x = laneX; player.speed = speed;
  if (shield) player.activatePowerUp('shield');
  player.step(STEP, { ...neutral(), throttle: 1 });
  // A long swept approach exercises the continuous collision path, not just overlap.
  player.s = 4;
  const event = traffic.step(STEP, player, STEP);
  return { player, agent, event, traffic };
}

describe('median crossovers', () => {
  it('opens, warns, closes, and repeats at spaced highway locations', () => {
    expect(medianIsOpen(280, 4)).toBe(true);
    expect(medianGate(280, 15).warning).toBe(true);
    expect(medianIsOpen(280, 18)).toBe(false);
    expect(medianIsOpen(280, 28)).toBe(true);
    expect(medianIsOpen(210, 4)).toBe(false);
    expect(medianIsOpen(880, 4)).toBe(true);
    expect(medianBarriers(280, 4).some(b => Math.abs(b.s - 280) < b.length / 2)).toBe(false);
    expect(medianBarriers(280, 18).some(b => Math.abs(b.s - 280) < b.length / 2)).toBe(true);
  });
  it('allows travel on either carriageway and blocks crossing a closed median', () => {
    expect(road.constrainPlayer(-2, 280, 2, 4)).toBe(-2);
    expect(road.constrainPlayer(-2, 280, 2, 18)).toBe(1.25);
    expect(road.constrainPlayer(2, 280, -2, 18)).toBe(-1.25);
    expect(road.constrainPlayer(-8, 500, -8, 18)).toBe(-8);
  });
  it('holds an occupied crossover open until the car clears it, without opening a closed gate on approach', () => {
    const player = new Vehicle(); player.x = 0; player.s = 280; player.simulationTime = 15.8;
    for (let i = 0; i < 200; i++) player.step(STEP, neutral());
    expect(player.medianHeld).toBe(0); expect(player.x).toBe(0);
    expect(medianIsOpen(280, player.simulationTime, player.medianHeld)).toBe(true);
    player.x = -4; player.step(STEP, neutral());
    expect(player.medianHeld).toBeUndefined(); expect(medianIsOpen(280, player.simulationTime)).toBe(false);
    player.x = 2.5; player.step(STEP, neutral()); expect(player.medianHeld).toBeUndefined();
  });
  it('stops a car driving into the end of the concrete median after a crossover', () => {
    const traffic = new Traffic('MEDIAN'); traffic.agents = [];
    const player = new Vehicle(); player.x = 0; player.s = 323; player.previous = { x: 0, s: 320, yaw: 0 }; player.speed = 40; player.simulationTime = 4;
    const event = traffic.step(STEP, player, 4);
    expect(event.contacts.some(c => c.material === 'concrete')).toBe(true);
    expect(player.exploded).toBe(false); expect(player.s).toBeLessThan(323);
  });
  it('keeps the chase camera on the oncoming carriageway after crossing', () => {
    const player = new Vehicle(), camera = new DriveCamera(); player.x = -6.5; player.s = 400;
    camera.update(STEP, player, { x: player.x, s: player.s, yaw: 0 }, 0, 'chase', false, true);
    expect(camera.camera.position.x).toBeLessThan(-1.25);
  });
  it('drives through an open crossover into the oncoming lanes with ordinary steering', () => {
    const player = new Vehicle(), traffic = new Traffic('CROSSING'); traffic.agents = [];
    player.x = 2.9; player.s = 245; player.speed = 35; player.simulationTime = 4;
    for (let i = 0; i < 100; i++) {
      player.step(STEP, { ...neutral(), steer: -1 }); traffic.step(STEP, player, player.simulationTime);
    }
    expect(player.x).toBeLessThan(-2.9); expect(player.damage).toBe(0); expect(player.exploded).toBe(false);
  });
});

describe('explosive frontal impacts and shields', () => {
  it('explodes on an unprotected hard frontal impact and stops the wreck', () => {
    const { player, event } = crash();
    expect(event.contacts.length).toBeGreaterThan(0); expect(player.exploded).toBe(true);
    expect(player.damage).toBe(100); expect(player.speed).toBe(0);
    const s = player.s; player.step(STEP, { ...neutral(), throttle: 1 }); expect(player.s).toBe(s);
    player.reset(); expect(player.exploded).toBe(false); expect(player.damage).toBe(0);
  });
  it('uses the shield to shove cars out of the lane while preserving player momentum', () => {
    const { player, agent, event } = crash(true);
    expect(event.contacts.length).toBeGreaterThan(0); expect(event.scoreHits.length).toBe(1);
    expect(player.speed).toBeGreaterThanOrEqual(40); expect(Math.abs(agent.lateral)).toBeGreaterThan(5);
    expect(player.damage).toBe(0); expect(player.exploded).toBe(false);
  });
  it('physically clears sedans and heavy trucks from the shielded car’s lane over subsequent steps', () => {
    for (const kind of ['sedan','truck'] as const) {
      const { player, agent, traffic } = crash(true,1,0,50,kind);
      const lane = agent.x;
      for(let i=0;i<45;i++) { player.step(STEP,{...neutral(),throttle:1});traffic.step(STEP,player,(i+2)*STEP); }
      expect(Math.abs(agent.x-lane)).toBeGreaterThan(1.5);
      expect(player.speed).toBeGreaterThan(49); expect(player.damage).toBe(0); expect(player.exploded).toBe(false);
    }
  });
  it('keeps glancing passes and low closing-speed bumps survivable', () => {
    expect(crash(false, -1, 2.5).player.exploded).toBe(false);
    expect(crash(false, 1, 0, 25).player.exploded).toBe(false);
  });
  it('explodes when struck from behind at high closing speed', () => {
    const traffic = new Traffic('REAR'); traffic.reset(); const agent = traffic.agents.find(a => a.kind !== 'police')!;
    Object.assign(agent, { x: 6.5, targetX: 6.5, s: -8, speed: 60, desired: 60, direction: 1, yaw: 0 }); traffic.agents = [agent];
    const player = new Vehicle(); player.speed = 5; let impact = false;
    for (let i = 0; i < 20; i++) { player.step(STEP, neutral()); impact = traffic.step(STEP, player, i * STEP).contacts.length > 0 || impact; }
    expect(impact).toBe(true); expect(player.damage).toBeGreaterThan(0); expect(player.exploded).toBe(true);
  });
  it('protects against barriers too, then restores damage when the shield expires', () => {
    const player = new Vehicle(); player.activatePowerUp('shield'); expect(player.collide(30)).toBe(false);
    for (let i = 0; i < 481; i++) player.step(STEP, neutral());
    expect(player.shield).toBe(0); expect(player.collide(30)).toBe(true); expect(player.damage).toBeGreaterThan(0);
  });
});

describe('collectible powers', () => {
  it('limits ordinary and turbo driving to 180 and 230 mph', () => {
    const player=new Vehicle();player.x=-6.5;
    for(let i=0;i<3600;i++)player.step(STEP,{...neutral(),throttle:1});
    expect(player.speed*MPS_TO_MPH).toBeCloseTo(180, 3);
    player.activatePowerUp('turbo');
    for(let i=0;i<300;i++)player.step(STEP,{...neutral(),throttle:1});
    expect(player.speed*MPS_TO_MPH).toBeCloseTo(230, 3);
  });
  it('collects across a swept step once and refreshes rather than stacking timers', () => {
    const pickups = new PowerUps(), player = new Vehicle(); player.previous = { x: 6.5, s: 85, yaw: 0 }; player.s = 95;
    expect(pickups.collect(player)).toEqual(['shield']); expect(player.shield).toBe(8);
    expect(pickups.collect(player)).toEqual([]); player.shield = 2; player.activatePowerUp('shield'); expect(player.shield).toBe(8);
    player.x = 10.1; player.previous = { x: 10.1, s: 565, yaw: 0 }; player.s = 575;
    expect(pickups.collect(player)).toEqual(['turbo']); expect(player.turbo).toBe(6); expect(player.shield).toBe(8);
    pickups.reset(); expect(pickups.nearby(0).some(p => p.id === 0)).toBe(true);
  });
  it('turbo accelerates above the normal cap, brakes normally, and expires smoothly', () => {
    const turbo = new Vehicle(), plain = new Vehicle(); turbo.x = plain.x = -6.5; turbo.speed = plain.speed = 77; turbo.activatePowerUp('turbo');
    for (let i = 0; i < 180; i++) { turbo.step(STEP, { ...neutral(), throttle: 1 }); plain.step(STEP, { ...neutral(), throttle: 1 }); }
    expect(turbo.speed).toBeGreaterThan(95); expect(plain.speed).toBeLessThanOrEqual(180/MPS_TO_MPH); expect(turbo.boostPulse).toBeGreaterThan(0);
    const before = turbo.speed; for (let i = 0; i < 30; i++) turbo.step(STEP, { ...neutral(), throttle: 1, brake: 1 });
    expect(turbo.speed).toBeLessThan(before - 2); expect(turbo.boostPulse).toBe(0);
    turbo.turbo = STEP / 2; const expirySpeed = turbo.speed; turbo.step(STEP, neutral());
    expect(turbo.turbo).toBe(0); expect(turbo.speed).toBeGreaterThan(expirySpeed - 1);
    for (let i = 0; i < 300; i++) turbo.step(STEP, neutral()); expect(turbo.speed).toBeLessThanOrEqual(180/MPS_TO_MPH);
    turbo.reset(); expect(turbo.turbo).toBe(0); expect(turbo.shield).toBe(0);
  });
  it('keeps the collectible window bounded over a long drive and prevents farming old pickups', () => {
    const pickups = new PowerUps(), player = new Vehicle();
    for (let s = 0; s <= 100000; s += 100) { player.previous = { x: 6.5, s: s - 100, yaw: 0 }; player.s = s; pickups.collect(player); expect(pickups.nearby(s).length).toBeLessThan(8); }
    expect(pickups.nearby(0)).toEqual([]);
  });
});
