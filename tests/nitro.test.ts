import { describe, expect, it } from 'vitest';
import { Vehicle, NITRO_DURATION, NITRO_RECHARGE } from '../src/drive/vehicle';
import { STEP, neutral } from '../src/drive/config';
import { MPS_TO_MPH } from '../src/drive/units';
const held=()=>({...neutral(),nitro:true});

describe('held rechargeable nitro',()=>{
  it('drains only while held, stops immediately on release, and resumes a partial tank',()=>{
    const car=new Vehicle();car.x=-6.5;car.speed=30;
    expect(car.nitroFuel).toBe(NITRO_DURATION);expect(car.nitro).toBe(0);
    for(let i=0;i<60;i++)car.step(STEP,held());
    expect(car.nitroFuel).toBeCloseTo(2,8);expect(car.nitro).toBeGreaterThan(0);expect(car.speed).toBeGreaterThan(37);expect(car.boostPulse).toBeGreaterThan(0);
    car.step(STEP,neutral());
    expect(car.nitro).toBe(0);expect(car.boostPulse).toBe(0);expect(car.speedLimit*MPS_TO_MPH).toBeCloseTo(180,5);expect(car.nitroFuel).toBeGreaterThan(2);
    const remaining=car.nitroFuel;car.step(STEP,held());expect(car.nitroFuel).toBeCloseTo(remaining-STEP,8);expect(car.boostPulse).toBeGreaterThan(0);
  });
  it('fully drains after three held seconds and refills from empty in ten seconds without flickering',()=>{
    const car=new Vehicle();car.x=-6.5;car.speed=30;
    for(let i=0;i<NITRO_DURATION/STEP;i++)car.step(STEP,held());
    expect(car.nitroFuel).toBe(0);expect(car.nitro).toBe(0);expect(car.nitroReady).toBe(false);expect(car.nitroCooldown).toBe(NITRO_RECHARGE);expect(car.boostPulse).toBe(0);
    // Keeping Shift held on an empty tank must not spend every tiny amount as it refills.
    for(let i=0;i<120;i++){car.step(STEP,held());expect(car.nitro).toBe(0);expect(car.boostPulse).toBe(0);}
    expect(car.nitroFuel).toBeCloseTo(.6,8);
    for(let i=0;i<480;i++)car.step(STEP,neutral());
    expect(car.nitroFuel).toBe(NITRO_DURATION);expect(car.nitroCooldown).toBe(0);expect(car.nitroReady).toBe(true);
    car.step(STEP,held());expect(car.nitro).toBeGreaterThan(0);
    car.reset();expect(car.nitro).toBe(0);expect(car.nitroFuel).toBe(NITRO_DURATION);expect(car.nitroCooldown).toBe(0);
  });
  it('preserves braking and handbrake priority, rejects reverse, and stops on explosion',()=>{
    const car=new Vehicle();car.speed=-5;car.step(STEP,held());expect(car.nitro).toBe(0);expect(car.nitroFuel).toBe(NITRO_DURATION);
    car.speed=40;car.step(STEP,{...held(),brake:1});expect(car.nitro).toBe(0);expect(car.nitroFuel).toBe(NITRO_DURATION);expect(car.speed).toBeLessThan(40);expect(car.boostPulse).toBe(0);
    car.step(STEP,{...held(),handbrake:true});expect(car.nitroFuel).toBe(NITRO_DURATION);
    car.step(STEP,held());expect(car.nitro).toBeGreaterThan(0);
    car.explode();car.step(STEP,held());expect(car.nitro).toBe(0);expect(car.boostPulse).toBe(0);
  });
  it('shares the 230 mph ceiling with a turbo pickup instead of stacking',()=>{
    const car=new Vehicle();car.x=-6.5;car.speed=100;car.activatePowerUp('turbo');
    for(let i=0;i<120;i++)car.step(STEP,{...held(),throttle:1});
    expect(car.speed*MPS_TO_MPH).toBeCloseTo(230,3);expect(car.speedLimit*MPS_TO_MPH).toBeCloseTo(230,3);
  });
  it('keeps the flame active in a jump and releases it on the next physics step',()=>{
    const car=new Vehicle();car.speed=40;car.jumpHeight=2;car.jumpVelocity=2;car.airborne=true;car.step(STEP,held());expect(car.boostPulse).toBeGreaterThan(0);
    car.step(STEP,neutral());expect(car.nitro).toBe(0);expect(car.boostPulse).toBe(0);
  });
});
