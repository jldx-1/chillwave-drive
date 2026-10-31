import { describe,it,expect } from 'vitest';
import { Missiles,MISSILE_CAPACITY,missileContact,type MissileTarget } from '../src/drive/missiles';
import { MissileVisuals } from '../src/drive/missile-visuals';
import { Vehicle } from '../src/drive/vehicle';
import { PowerUpVisuals } from '../src/drive/powerup-visuals';
import { STEP } from '../src/drive/config';
const car=(id=1):MissileTarget=>({id,x:6.5,s:60,oldX:6.5,oldS:60,width:2,length:5,yaw:0,height:1.8});

describe('missile flight and rendering',()=>{
  it('sweeps fast projectiles into the first car, including rotated and moving targets',()=>{
    const missiles=new Missiles(),player=new Vehicle(),m=missiles.launch(player,2,1)!;
    m.oldS=0;m.s=120;
    expect(missileContact(m,car())).toBeGreaterThan(0);expect(missileContact(m,car())).toBeLessThan(1);
    expect(missileContact(m,{...car(),yaw:Math.PI/2})).toBeDefined();
    expect(missileContact(m,{...car(),oldX:0,x:13})).toBeDefined();
    expect(missileContact({...m,y:8,oldY:8},car())).toBeUndefined();
    m.s=0;m.yaw=0;const hits=missiles.step(1,[car(1),{...car(2),s:90,oldS:90}]);
    expect(hits[0]?.id).toBe(1);expect(missiles.active).toHaveLength(0);
  });
  it('leads a moving target, expires after lock loss, and caps active projectiles',()=>{
    const missiles=new Missiles(),player=new Vehicle(),target={...car(),x:12,oldX:12};
    missiles.launch(player,target.id,1);let hit=false;
    for(let i=0;i<150&&!hit;i++){target.oldS=target.s;target.s+=20*STEP;hit=missiles.step(STEP,[target]).length>0;}
    expect(hit).toBe(true);
    for(let i=0;i<MISSILE_CAPACITY+3;i++)missiles.launch(player,99,1);
    expect(missiles.active).toHaveLength(MISSILE_CAPACITY);
    for(let i=0;i<151;i++)missiles.step(STEP,[]);
    expect(missiles.active).toHaveLength(0);
  });
  it('interpolates rockets and rebases their reused trail buffers without changing flight',()=>{
    const missiles=new Missiles(),player=new Vehicle();player.s=999;player.yaw=.3;player.jumpHeight=2;
    const m=missiles.launch(player,1,1)!,visuals=new MissileVisuals();missiles.step(STEP,[]);
    visuals.update(missiles.active,0,.25,false);
    const rocket=visuals.group.children[0],old=rocket.position.clone();
    expect(rocket.position.x).toBeCloseTo(m.oldX+(m.x-m.oldX)*.25);
    expect(rocket.position.y).toBeGreaterThan(2);
    visuals.update(missiles.active,1000,.25,false);
    expect(rocket.position.z-old.z).toBeCloseTo(1000);
    expect(visuals.diagnostics.visible).toBe(1);visuals.update([],1000,1,false);expect(visuals.diagnostics.visible).toBe(0);
  });
});

describe('shield attachment',()=>{
  it('uses the same interpolated position, heading and jump height as the rendered car',()=>{
    const car=new Vehicle(),visuals=new PowerUpVisuals();car.shield=5;car.x=12;car.s=1100;car.yaw=.6;car.jumpHeight=4;
    const pose={x:10,s:1099,yaw:.4,height:3.7};visuals.update([],car,1000,false,pose);
    expect(visuals.shieldPose).toMatchObject({visible:true,x:10,z:-99,yaw:-.4,opacity:.16});
    expect(visuals.shieldPose.y).toBeCloseTo(4.6);
    car.shield=1;car.simulationTime=5;visuals.update([],car,1000,false,pose);const opacity=visuals.shieldPose.opacity;
    car.simulationTime+=.05;visuals.update([],car,1000,false,pose);expect(visuals.shieldPose.opacity).toBe(opacity);
    car.shield=.1;visuals.update([],car,1000,true,pose);expect(visuals.shieldPose.opacity).toBeLessThan(opacity);
    car.shield=0;visuals.update([],car,1000,false,pose);expect(visuals.shieldPose.visible).toBe(false);
  });
});
