import {it,expect} from 'vitest';
import {Vehicle} from '../src/drive/vehicle';
import {TUNE,STEP,neutral,type Controls} from '../src/drive/config';
const previous={...TUNE,plantedHandling:false,steerAuthority:1,steerResponse:32,steerReturn:42,steerSlew:4.8,cornerAssist:1.42};
function run(car:Vehicle,seconds:number,controls:Controls,wet=true){for(let i=0;i<Math.round(seconds/STEP);i++)car.step(STEP,controls,wet,1,x=>x);}

it.each([20,40,60])('steers left and right faster at %s m/s',speed=>{
  for(const direction of [-1,1]){
    const car=new Vehicle(),before=new Vehicle(previous);car.speed=before.speed=speed;
    run(car,.3,{...neutral(),steer:direction});run(before,.3,{...neutral(),steer:direction});
    expect(Math.abs(car.x-6.5)).toBeGreaterThan(Math.abs(before.x-6.5)*1.4);
    expect(car.lateral*direction).toBeGreaterThan(before.lateral*direction*1.4);
    expect(car.slipAngle).toBe(0);expect(car.driftAmount).toBe(0);
  }
});

it.each([25,60])('turns under either brake without drifting at %s m/s',speed=>{
  for(const wet of [true,false])for(const direction of [-1,1])for(const handbrake of [true,false]){
    const car=new Vehicle();car.speed=speed;
    run(car,.35,{...neutral(),steer:direction,brake:handbrake?0:1,handbrake},wet);
    expect((car.x-6.5)*direction).toBeGreaterThan(.35);expect(car.lateral*direction).toBeGreaterThan(2);
    expect(car.speed).toBeLessThan(speed);expect(car.slipAngle).toBe(0);expect(car.driftAmount).toBe(0);expect(car.slip).toBe(0);
  }
});

it.each([-1,1])('reverses steering while holding the brake toward %s',direction=>{
  const car=new Vehicle();car.speed=40;run(car,.2,{...neutral(),steer:direction,brake:1});
  car.step(STEP,{...neutral(),steer:-direction,brake:1});expect(car.steering*direction).toBeLessThan(0);
  run(car,.4,{...neutral(),steer:-direction,brake:1});expect(car.lateral*direction).toBeLessThan(0);expect(car.slipAngle).toBe(0);
});
