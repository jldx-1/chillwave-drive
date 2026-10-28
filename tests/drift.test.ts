import { describe, expect, it } from 'vitest';
import { STEP, neutral } from '../src/drive/config';
import { Vehicle } from '../src/drive/vehicle';
import { Traffic } from '../src/drive/traffic';
import { DriveCamera } from '../src/drive/camera';
import { Vector3 } from 'three';
const run = (car: Vehicle, seconds: number, controls = neutral(), wet = true) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) car.step(STEP, controls, wet);
};
const moving = (speed = 23) => { const car = new Vehicle(); car.x = 8.35; car.speed = speed; return car; };

describe('brake drifting', () => {
  it.each([-1, 1])('breaks rear grip toward steering %s while momentum continues down the road', direction => {
    const car = moving(), before = car.speed;
    run(car, .7, { ...neutral(), steer: direction, brake: 1 });
    expect(car.slipAngle * direction).toBeGreaterThan(.3);
    expect(car.yaw * direction).toBeGreaterThan(.35);
    expect(car.driftAmount).toBeGreaterThan(.8); expect(car.slip).toBeGreaterThan(.6);
    expect(car.speed).toBeGreaterThan(14); expect(car.speed).toBeLessThan(before);
    expect(car.velocityS / car.speed).toBeGreaterThan(.98);
    expect(Math.abs(car.x - 8.35)).toBeLessThan(1); expect(car.damage).toBe(0);
  });
  it.each([-1, 1])('allows countersteering to catch a drift toward %s and regain grip progressively', direction => {
    const car = moving(); run(car, .7, { ...neutral(), steer: direction, brake: 1 });
    const initial = Math.abs(car.slipAngle);
    run(car, .1, { ...neutral(), steer: -direction, throttle: .4 });
    expect(Math.abs(car.slipAngle)).toBeGreaterThan(.1); // Recovery is not an instantaneous snap.
    run(car, .35, { ...neutral(), steer: -direction, throttle: .4 });
    expect(Math.abs(car.slipAngle)).toBeLessThan(initial * .2);
    run(car, 1.4, { ...neutral(), throttle: .4 });
    expect(Math.abs(car.slipAngle)).toBeLessThan(.04); expect(car.driftAmount).toBeLessThan(.05);
    expect(car.x).toBeGreaterThan(1.25); expect(car.x).toBeLessThan(15.45); expect(car.damage).toBe(0);
  });
  it('keeps straight braking, ordinary steering, low-speed turns and reversing planted', () => {
    const cases = [
      { speed: 23, controls: { ...neutral(), brake: 1 } },
      { speed: 23, controls: { ...neutral(), steer: 1 } },
      { speed: 5, controls: { ...neutral(), steer: 1, brake: 1 } },
      { speed: -7, controls: { ...neutral(), steer: 1, brake: 1 } },
    ];
    for (const { speed, controls } of cases) {
      const car = moving(speed); run(car, .5, controls);
      expect(car.driftAmount).toBe(0); expect(Math.abs(car.slipAngle)).toBeLessThan(.1);
    }
  });
  it('can drift on dry roads, breaks away more readily on wet roads and supports the handbrake', () => {
    const wet = moving(), dry = moving(), handbrake = moving();
    run(wet, .7, { ...neutral(), steer: 1, brake: 1 }, true);
    run(dry, .7, { ...neutral(), steer: 1, brake: 1 }, false);
    run(handbrake, .7, { ...neutral(), steer: 1, handbrake: true });
    expect(dry.slipAngle).toBeGreaterThan(.15); expect(wet.slipAngle).toBeGreaterThan(dry.slipAngle);
    expect(handbrake.slipAngle).toBeGreaterThan(.25);
  });
  it('shows the car angle from chase view while keeping the cockpit aligned with the driver', () => {
    const car = moving(); run(car, .7, { ...neutral(), steer: 1, brake: 1 });
    const camera = new DriveCamera();
    const heading = () => { const direction = camera.camera.getWorldDirection(new Vector3()); return Math.atan2(direction.x, -direction.z); };
    camera.update(.1, car, car.pose(1), 0, 'chase', false, false);
    expect(Math.abs(heading())).toBeLessThan(.2); expect(Math.abs(car.yaw - heading())).toBeGreaterThan(.2);
    camera.update(.1, car, car.pose(1), 0, 'cockpit', false, false);
    expect(Math.abs(car.yaw - heading())).toBeLessThan(.03);
  });
  it('retains its slide through contact-system velocity updates and resets all drift state', () => {
    const car = moving(), traffic = new Traffic('DRIFT'); traffic.agents = [];
    for (let i = 0; i < 42; i++) {
      car.step(STEP, { ...neutral(), steer: 1, brake: 1 }); traffic.step(STEP, car, i * STEP);
    }
    expect(car.slipAngle).toBeGreaterThan(.3);
    const energy = car.speed ** 2;
    car.setWorldVelocity(car.lateral, car.velocityS); expect(car.speed ** 2).toBeCloseTo(energy, 7);
    car.reset(); expect(car.driftAmount).toBe(0); expect(car.slipAngle).toBe(0); expect(car.yawRate).toBe(0);
  });
});

describe('handbrake direction reversal',()=>{
  it.each([-1,1])('registers an opposite command immediately during a handbrake slide toward %s',direction=>{
    const car=moving(25);run(car,.7,{...neutral(),steer:direction,handbrake:true});
    const before={yaw:car.yaw,lateral:car.lateral};expect(car.slipAngle*direction).toBeGreaterThan(.25);
    car.step(STEP,{...neutral(),steer:-direction,handbrake:true});
    expect(car.steering*direction).toBeLessThan(0);
    run(car,.3,{...neutral(),steer:-direction,handbrake:true});
    expect(car.yawRate*direction).toBeLessThan(0);
    expect(car.lateral*direction).toBeLessThan(0);
    expect((car.yaw-before.yaw)*direction).toBeLessThan(0);expect(car.damage).toBe(0);
  });
  it('retains its new driving direction after the handbrake and steering are released',()=>{
    const car=moving(25);run(car,.5,{...neutral(),steer:1,handbrake:true});
    run(car,.35,{...neutral(),steer:-1,handbrake:true});
    // Isolate steering release from the separate barrier-impact yaw response.
    const coast=(seconds:number)=>{for(let i=0;i<seconds/STEP;i++)car.step(STEP,neutral(),true,1,x=>x);};
    coast(.8);const heading=car.yaw;coast(.5);
    expect(Math.abs(car.yaw-heading)).toBeLessThan(.003);expect(car.damage).toBe(0);
  });
});

describe('handbrake control and recovery', () => {
  it.each([25, 45, 65])('keeps steering reversals controlled at %s m/s and responds after releasing drift', speed => {
    for (const direction of [-1, 1]) {
      const car=moving(speed);
      const steer=(seconds:number, direction:number, handbrake:boolean) => {
        let peak=0;
        for(let i=0;i<Math.round(seconds/STEP);i++) {
          car.step(STEP,{...neutral(),throttle:.5,steer:direction,handbrake},true,1,x=>x);
          peak=Math.max(peak,Math.abs(car.yawRate));
        }
        return peak;
      };
      steer(.7,direction,true);
      expect(car.speed).toBeLessThan(speed);
      const peak=steer(.3,-direction,true);
      expect(peak).toBeLessThan(1.4);
      expect(car.yawRate*direction).toBeLessThan(0);
      steer(.5,-direction,false);
      expect(Math.abs(car.slipAngle)).toBeLessThan(.08);
      expect(car.driftAmount).toBeLessThan(.06);
      const heading=car.yaw;
      steer(.5,direction,false);
      expect((car.yaw-heading)*direction).toBeGreaterThan(.04);
      expect(car.damage).toBe(0);
    }
  });
  it('settles the slide after releasing the handbrake with no steering', () => {
    const car=moving(45);run(car,.7,{...neutral(),steer:1,handbrake:true});
    expect(car.slipAngle).toBeGreaterThan(.25);
    run(car,.6,neutral());
    expect(Math.abs(car.slipAngle)).toBeLessThan(.08);
    expect(car.driftAmount).toBeLessThan(.04);
  });
});
