import { describe, expect, it } from 'vitest';
import { RAIN, RainField, WaterFilm, rainSheltered, sweptBladeClears, wiperSweep } from '../src/drive/weather';

describe('world rainfall', () => {
  it('retains world positions when the car changes lanes or crosses an origin rebase', () => {
    const field = new RainField(1); field.update(0, 6.5, 999.9, 0, false);
    const before = Array.from(field.positions);
    field.update(.02, 6.8, 1000.9, .1, false);
    expect(field.positions[0] + 6.8).toBeCloseTo(before[0] + 6.5 + RAIN.windX * .02, 4);
    expect(field.positions[2] - 1000.9).toBeCloseTo(before[2] - 999.9 + RAIN.windZ * .02, 4);
    expect(field.positions[1]).toBeLessThan(before[1]);
  });
  it('streaks follow apparent wind at speed, including reverse and lateral motion', () => {
    const parked = new RainField(1), moving = new RainField(1), reverse = new RainField(1);
    for (const rain of [parked, moving, reverse]) rain.update(0, 0, 0, 0, false);
    parked.update(.02, 0, 0, 0, false); moving.update(.02, .04, 1, .1, false); reverse.update(.02, 0, -.15, 0, false);
    const streakZ = (f: RainField) => f.positions[2] - f.positions[5];
    expect(streakZ(moving)).toBeGreaterThan(streakZ(parked) + .8);
    expect(streakZ(reverse)).toBeLessThan(0);
    expect(moving.positions[0] - moving.positions[3]).toBeLessThan(0);
  });
  it('keeps its pools finite over long drives, large teleports and reduced motion', () => {
    const rain = new RainField(180);
    for (let i = 0; i < 1000; i++) rain.update(1 / 60, Math.sin(i / 100) * 4, i, 0, false);
    rain.update(0, 5, 1e8, 0, true);
    expect(rain.positions.length).toBe(1080); expect(Array.from(rain.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(rain.opacity).every(v => v >= 0 && v <= .260001)).toBe(true);
    expect(rainSheltered(6.5, 180)).toBe(true); expect(rainSheltered(6.5, 200)).toBe(false); expect(rainSheltered(50, 180)).toBe(false);
  });
});
describe('windshield water and physical blades', () => {
  it('clears droplets across a continuous blade sweep, including between rendered positions', () => {
    const before = { a: { x: 0, y: 0 }, b: { x: .6, y: 0 } }, after = { a: { x: 0, y: 0 }, b: { x: 0, y: .6 } };
    expect(sweptBladeClears({ x: .2, y: .2 }, before, after)).toBe(true);
    expect(sweptBladeClears({ x: .5, y: .5 }, before, after)).toBe(false);
    expect(sweptBladeClears({ x: .3, y: .005 }, before, before)).toBe(true);
    expect(sweptBladeClears({ x: .3, y: .2 }, before, before)).toBe(false);
  });
  it('water runs down when stopped, moves upward in airflow and stops accumulating under shelter', () => {
    const parked = new WaterFilm(), fast = new WaterFilm();
    const drop = { x: .2, y: .4, radius: .0035, age: 1, life: 20 };
    parked.drops = [{ ...drop }]; fast.drops = [{ ...drop }];
    parked.update(.5, 0, [], true, false); fast.update(.5, 50, [], true, false);
    expect(parked.drops[0].y).toBeLessThan(.4); expect(fast.drops[0].y).toBeGreaterThan(.4);
    expect(parked.drops).toHaveLength(1); expect(fast.drops).toHaveLength(1);
    fast.update(1, 50, [], false, false); expect(fast.drops.length).toBeGreaterThan(1);
    for (let i = 0; i < 1000; i++) fast.update(.1, 40, [], false, false);
    expect(fast.drops.length).toBeLessThanOrEqual(340);
  });
  it('parks wipers between strokes, freezes reduced motion, and never wipes untouched regions', () => {
    expect(wiperSweep(1.4, 0, false)).toBeCloseTo(0); expect(wiperSweep(.55, 0, false)).toBeCloseTo(-1.05);
    expect(wiperSweep(.55, 0, true)).toBe(0);
    const water = new WaterFilm(); water.drops = [{ x: .3, y: .1, radius: .002, age: 1, life: 10 }, { x: -.5, y: .6, radius: .002, age: 1, life: 10 }];
    const blade = { a: { x: 0, y: .1 }, b: { x: .6, y: .1 } };
    water.update(0, 0, [blade], true, false); expect(water.drops).toHaveLength(1); expect(water.drops[0].x).toBe(-.5);
    const snapshot = JSON.stringify(water.drops); water.update(10, 60, [blade], false, true); expect(JSON.stringify(water.drops)).toBe(snapshot);
  });
});
