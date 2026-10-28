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

describe('directional pulse', () => {
  it('destroys the nearest target in the selected direction, recharges, and preserves traffic capacity', () => {
    const traffic=new Traffic('PULSE');traffic.reset();const player=new Vehicle();
    const [front,far,rear]=traffic.agents;
    Object.assign(front,{x:6.5,s:25});Object.assign(far,{x:6.5,s:55});Object.assign(rear,{x:6.5,s:-15});
    traffic.agents=[front,far,rear];
    expect(traffic.firePulse(player,1)).toEqual({status:'hit',target:front});
    expect(traffic.agents).not.toContain(front);expect(traffic.agents).toHaveLength(3);
    expect(traffic.firePulse(player,-1).status).toBe('recharging');
    for(let i=0;i<301;i++)player.step(STEP,neutral());
    expect(traffic.firePulse(player,-1)).toEqual({status:'hit',target:rear});
    expect(traffic.agents).not.toContain(rear);expect(traffic.agents).toContain(far);
  });
  it('does not consume a charge with no target in range', () => {
    const traffic=new Traffic('EMPTY'),player=new Vehicle();traffic.reset();traffic.agents=[];
    expect(traffic.firePulse(player,1).status).toBe('empty');expect(player.pulseCooldown).toBe(0);
  });
});
