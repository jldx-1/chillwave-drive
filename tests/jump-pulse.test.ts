import { describe, expect, it } from 'vitest';
import { STEP, neutral } from '../src/drive/config';
import { jumpRamps, RAMP_SPACING } from '../src/drive/jump-ramps';
import { PowerUps, POWERUP_SPACING } from '../src/drive/powerups';
import { Traffic } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';

describe('jump ramps', () => {
  it('launches from the first ramp, clears a car, and lands again', () => {
    const ramp=jumpRamps(0)[0], player=new Vehicle(), traffic=new Traffic('JUMP');
    traffic.reset(); const car=traffic.agents.find(a=>a.kind!=='police'&&a.direction===1)!;
    Object.assign(car,{x:ramp.x,targetX:ramp.x,s:ramp.s+32,speed:18,desired:18,direction:1,yaw:0});traffic.agents=[car];
    player.x=ramp.x;player.s=ramp.s-12;player.speed=60;
    let peak=0, sawAir=false, contacts=0;
    for(let i=0;i<190;i++){
      player.step(STEP,{...neutral(),throttle:1});
      const event=traffic.step(STEP,player,player.simulationTime);
      contacts+=event.contacts.length;peak=Math.max(peak,player.jumpHeight);sawAir ||= player.airborne;
    }
    expect(sawAir).toBe(true);expect(peak).toBeGreaterThan(3);expect(contacts).toBe(0);
    expect(player.s).toBeGreaterThan(car.s);expect(player.airborne).toBe(false);expect(player.jumpHeight).toBe(0);
  });
  it('does not launch at low speed and keeps a bounded, spaced ramp stream', () => {
    const ramp=jumpRamps(0)[0], player=new Vehicle();player.x=ramp.x;player.s=ramp.s-1;player.speed=8;
    for(let i=0;i<20;i++)player.step(STEP,neutral());
    expect(player.airborne).toBe(false);
    expect(jumpRamps(0)[0].s).toBe(200);expect(RAMP_SPACING).toBeGreaterThan(POWERUP_SPACING);
    const pickups=new PowerUps().nearby(0);expect(pickups[1].s-pickups[0].s).toBe(480);
  });
});

describe('guided missiles', () => {
  it('launches from the car and destroys traffic only after flight and impact', () => {
    const traffic=new Traffic('MISSILES');traffic.reset();const player=new Vehicle();
    const [front,far,rear]=traffic.agents;
    Object.assign(front,{x:6.5,oldX:6.5,s:35,oldS:35,speed:0,desired:0,direction:1,yaw:0,lane:1,targetX:6.5,kind:'sedan'});
    Object.assign(far,{x:6.5,s:95,oldS:95,speed:0,desired:0,direction:1,yaw:0,lane:1,targetX:6.5});
    Object.assign(rear,{x:6.5,s:-35,oldS:-35,speed:0,desired:0,direction:1,yaw:0,lane:1,targetX:6.5});
    traffic.agents=[front,far,rear];
    expect(traffic.fireMissile(player,1)).toEqual({status:'fired',target:front});
    expect(traffic.agents).toContain(front);expect(traffic.missiles.active).toHaveLength(1);
    expect(traffic.missiles.active[0].s).toBeGreaterThan(player.s+player.tuning.length/2);
    expect(traffic.fireMissile(player,-1).status).toBe('recharging');
    let explosions=0;
    for(let i=0;i<150;i++){
      player.step(STEP,neutral());
      explosions+=traffic.step(STEP,player,player.simulationTime).explosions.filter(b=>b.missile).length;
    }
    expect(explosions).toBe(1);expect(traffic.agents).not.toContain(front);
    expect(traffic.agents).toHaveLength(3);expect(traffic.agents).toContain(far);expect(traffic.missiles.active).toHaveLength(0);
    for(let i=0;i<160;i++)player.step(STEP,neutral());
    expect(traffic.fireMissile(player,-1).status).toBe('fired');
    for(let i=0;i<150;i++){player.step(STEP,neutral());traffic.step(STEP,player,player.simulationTime);}
    expect(traffic.agents).not.toContain(rear);expect(traffic.agents).toHaveLength(3);
  });
  it('does not consume a charge with no target in range and clears projectiles on reset', () => {
    const traffic=new Traffic('EMPTY'),player=new Vehicle();traffic.reset();traffic.agents=[];
    expect(traffic.fireMissile(player,1).status).toBe('empty');expect(player.pulseCooldown).toBe(0);
    traffic.missiles.launch(player,123,1);traffic.reset();expect(traffic.missiles.active).toHaveLength(0);
  });
});
