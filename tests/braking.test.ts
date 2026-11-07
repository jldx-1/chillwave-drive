import {it,expect} from 'vitest';
import {Vehicle} from '../src/drive/vehicle';
import {TUNE,STEP,neutral} from '../src/drive/config';
import {MPS_TO_MPH} from '../src/drive/units';

const previousTune={...TUNE,brakeForce:17800,brakeGripMultiplier:1};
function stop(speed:number,wet:boolean,previous=false) {
  const car=new Vehicle(previous?previousTune:TUNE);car.speed=speed;
  let time=0;
  while(car.speed>0&&time<15){car.step(STEP,{...neutral(),brake:1},wet);time+=STEP;}
  expect(car.speed).toBe(0);return {time,distance:car.s};
}

it.each([60,120])('cuts full-brake stopping distance and time by at least 30%% from %s mph',mph=>{
  for(const wet of [true,false]) {
    const before=stop(mph/MPS_TO_MPH,wet,true),after=stop(mph/MPS_TO_MPH,wet);
    console.log('braking comparison',{mph,wet,before,after});
    expect(after.time).toBeLessThan(before.time*.7);
    expect(after.distance).toBeLessThan(before.distance*.7);
  }
});

it('applies stronger braking immediately and releases it on the next simulation step',()=>{
  const car=new Vehicle();car.speed=30;
  car.step(STEP,{...neutral(),brake:1});expect(car.acceleration).toBeLessThan(-11);
  car.step(STEP,neutral());expect(car.acceleration).toBeGreaterThan(-1);
  car.step(STEP,{...neutral(),throttle:1,brake:1});expect(car.acceleration).toBeLessThan(-11);
});
