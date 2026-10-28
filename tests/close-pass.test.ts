import { describe, expect, it } from 'vitest';
import { STEP, TUNE, VEHICLE_DIMENSIONS, neutral } from '../src/drive/config';
import { Traffic, type Agent } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';
import { sweptClearance, type Body2D } from '../src/drive/collisions';

function encounter(offset: number, kind: Agent['kind'] = 'sedan') {
  const traffic=new Traffic('CLOSE-PASS','low'), player=new Vehicle(); traffic.reset();
  const source=traffic.agents.find(a=>a.kind==='sedan') ?? traffic.agents[0];
  const x=player.x+offset;
  const car:Agent={...source,...VEHICLE_DIMENSIONS[kind],kind,model:undefined,id:100,direction:1,x,oldX:x,targetX:x,s:12,oldS:12,
    speed:20,desired:20,yaw:0,lateral:0,spin:0,damage:0,near:false,active:false,route:'main',routeId:undefined};
  traffic.agents=[car];player.speed=40;
  return {traffic,player,car};
}
function pass(offset:number,kind:Agent['kind']='sedan') {
  const state=encounter(offset,kind); let rewards=0,near=0,increment=0,damage=0;
  for(let frame=0;frame<3/STEP;frame++){
    state.player.step(STEP,{...neutral(),throttle:1});
    const before=state.player.speed, event=state.traffic.step(STEP,state.player,frame*STEP);
    if(event.boost){rewards++;increment=state.player.speed-before;}
    near+=Number(event.near);damage=state.player.damage;
  }
  return {...state,rewards,near,increment,damage};
}
describe('contact-free close passes',()=>{
  it.each([-2.3,2.3])('rewards a complete clean pass on side %s exactly once with a small boost',offset=>{
    const result=pass(offset);
    expect(result.rewards).toBe(1);expect(result.near).toBe(1);expect(result.traffic.nearMisses).toBe(1);
    expect(result.increment).toBeCloseTo(4,6);expect(result.damage).toBe(0);
    expect(result.player.s-result.car.s).toBeGreaterThan((TUNE.length+result.car.length)/2);
  });
  it('measures the wider truck body instead of assuming a fixed center gap',()=>{
    const result=pass(3,'truck');expect(result.rewards).toBe(1);expect(result.damage).toBe(0);
  });
  it.each([1.5,1.9,3.2])('does not reward contact, an unsafe hairline gap, or a distant pass at offset %s',offset=>{
    const result=pass(offset);expect(result.rewards).toBe(0);expect(result.traffic.nearMisses).toBe(0);
    if(offset===1.5)expect(result.damage).toBeGreaterThan(0);
  });
  it('waits until the rear bumper has cleared, rather than rewarding at the center crossing',()=>{
    const {traffic,player,car}=encounter(2.3);let crossed=false, rewarded=false;
    for(let frame=0;frame<2/STEP;frame++){
      player.step(STEP,{...neutral(),throttle:1});
      const event=traffic.step(STEP,player,frame*STEP);
      if(player.s>car.s && player.s-car.s<1){crossed=true;expect(event.near).toBe(false);}
      if(event.near){rewarded=true;expect(player.s-car.s).toBeGreaterThan(4.5);}
    }
    expect(crossed).toBe(true);expect(rewarded).toBe(true);
  });
  it('does not reward being overtaken or reversing past traffic',()=>{
    const {traffic,player,car}=encounter(2.3);player.speed=10;car.s=-12;car.speed=car.desired=40;
    for(let frame=0;frame<2/STEP;frame++){player.step(STEP,neutral());expect(traffic.step(STEP,player,frame*STEP).near).toBe(false);}
    expect(traffic.nearMisses).toBe(0);
  });
});
describe('boost control and clearance geometry',()=>{
  it('preserves momentum heading, limits stacking and obeys the speed cap',()=>{
    const player=new Vehicle();player.yaw=.08;player.setWorldVelocity(3,40);
    const ratio=player.lateral/player.velocityS, speed=player.speed;
    expect(player.boostClosePass()).toBe(true);expect(player.speed-speed).toBeCloseTo(4,8);
    expect(player.lateral/player.velocityS).toBeCloseTo(ratio,8);expect(player.boostClosePass()).toBe(false);
    player.reset();player.speed=TUNE.maxSpeed-1;expect(player.boostClosePass()).toBe(true);expect(player.speed).toBeCloseTo(TUNE.maxSpeed,8);
    player.reset();expect(player.boostClosePass()).toBe(false);
  });
  it.each(['brake','handbrake'] as const)('never adds speed against %s input',pedal=>{
    const player=new Vehicle();player.speed=40;player.step(STEP,{...neutral(),[pedal]:1});
    const speed=player.speed;expect(player.boostClosePass()).toBe(false);expect(player.speed).toBe(speed);
  });
  it('measures a swept pass between frames and rejects diagonal hull overlap',()=>{
    const body=(id:number,x:number,s:number):Body2D=>({id,x,s,oldX:x,oldS:s,width:2,length:4,yaw:0,vx:0,vs:0,spin:0,mass:1500});
    const a=body(0,0,0),b=body(1,2.4,10);b.oldS=-10;
    expect(sweptClearance(a,b)).toBeCloseTo(.4,8);
    b.x=b.oldX=1.9;expect(sweptClearance(a,b)).toBe(0);
    b.x=b.oldX=4;b.yaw=Math.PI/4;expect(sweptClearance(a,b)).toBeGreaterThan(0);
  });
});
