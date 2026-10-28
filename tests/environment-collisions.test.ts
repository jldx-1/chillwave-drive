import { describe, expect, it } from 'vitest';
import { STEP, neutral } from '../src/drive/config';
import { EnvironmentCollisions, roadSignForChunk } from '../src/drive/environment-collisions';
import { jumpRamps } from '../src/drive/jump-ramps';
import { overpassesAt } from '../src/drive/road';
import { Traffic } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';
import { bridgeForChunk } from '../src/drive/city-infrastructure';

describe('airborne road interactions', () => {
  it('pitches up on the ramp, follows the flight arc, and reacts on landing', () => {
    const ramp=jumpRamps(0)[0],p=new Vehicle();p.x=ramp.x;p.s=ramp.s-8;p.speed=70;
    let rampPitch=0,upPitch=0,downPitch=0,landing=0;
    for(let i=0;i<180;i++) {
      p.step(STEP,neutral());
      if(!p.airborne&&p.jumpHeight>0)rampPitch=Math.max(rampPitch,p.pitch);
      if(p.airborne&&p.jumpVelocity>0)upPitch=Math.max(upPitch,p.pitch);
      if(p.airborne&&p.jumpVelocity<0)downPitch=Math.min(downPitch,p.pitch);
      landing=Math.max(landing,p.landingImpact);
    }
    expect(rampPitch).toBeGreaterThan(.02);expect(upPitch).toBeGreaterThan(.06);
    expect(downPitch).toBeLessThan(-.02);expect(landing).toBeGreaterThan(5);expect(p.jumpHeight).toBe(0);
  });
  it('preserves horizontal momentum without tire acceleration or steering while airborne', () => {
    const a=new Vehicle(),b=new Vehicle();
    for(const p of [a,b]){p.s=400;p.speed=45;p.jumpHeight=3;p.jumpVelocity=2;p.airborne=true;}
    a.step(STEP,{...neutral(),throttle:1,steer:1});b.step(STEP,neutral());
    expect(a.speed).toBeCloseTo(b.speed,8);expect(a.x).toBeCloseTo(b.x,8);
  });
  it('allows a high jump over the closed median but blocks a low crossing', () => {
    const traffic=new Traffic('MEDIAN-JUMP');traffic.agents=[];
    const high=new Vehicle();high.x=1.4;high.s=200;high.jumpHeight=2;high.jumpVelocity=2;high.airborne=true;high.setWorldVelocity(-10,25);
    for(let i=0;i<15;i++){high.step(STEP,neutral());traffic.step(STEP,high,i*STEP);}
    expect(high.x).toBeLessThan(-.5);expect(high.damage).toBe(0);
    const low=new Vehicle();low.x=1.4;low.s=200;low.setWorldVelocity(-10,25);
    low.step(STEP,neutral());expect(low.x).toBeGreaterThanOrEqual(1.25);
  });
  it('breaks a sign with a fast airborne impact once, while missing it below', () => {
    const sign=roadSignForChunk(1)!,environment=new EnvironmentCollisions(),p=new Vehicle();
    p.x=sign.x;p.s=sign.s+1;p.speed=60;p.airborne=true;p.jumpHeight=7;p.previous={x:p.x,s:sign.s-4,yaw:0,height:7};
    expect(environment.step(p).map(h=>h.kind)).toEqual(['sign']);expect(environment.brokenSigns.has(sign.id)).toBe(true);
    expect(environment.step(p)).toEqual([]);environment.reset();p.jumpHeight=1;p.previous.height=1;
    expect(environment.step(p)).toEqual([]);
  });
  it('can break an actual overhead sign from a boosted ramp launch', () => {
    const ramp=jumpRamps(1800).find(r=>r.s===1880)!,p=new Vehicle(),environment=new EnvironmentCollisions();
    expect(ramp).toBeDefined();p.x=ramp.x;p.s=ramp.s-12;p.speed=100;p.activatePowerUp('turbo');
    let sign=false;
    for(let i=0;i<150&&!sign;i++){p.step(STEP,{...neutral(),throttle:1});sign=environment.step(p).some(hit=>hit.kind==='sign');}
    expect(sign).toBe(true);
  });
  it('can reach an overpass from a real ramp launch at boost speed', () => {
    const ramp=jumpRamps(600).find(r=>r.s===660)!,p=new Vehicle(),environment=new EnvironmentCollisions();
    expect(ramp).toBeDefined();p.x=ramp.x;p.s=ramp.s-12;p.speed=100;p.activatePowerUp('turbo');
    let hit=false;
    for(let i=0;i<150&&!hit;i++) {p.step(STEP,{...neutral(),throttle:1});hit=environment.step(p).some(event=>event.kind==='overpass');}
    expect(hit).toBe(true);expect(p.exploded).toBe(true);
  });
  it('collides with elevated pedestrian bridges as well as road decks', () => {
    const bridge=bridgeForChunk(6)!,environment=new EnvironmentCollisions(),p=new Vehicle();
    p.x=6.5;p.s=bridge.s;p.speed=50;p.airborne=true;p.jumpHeight=bridge.floor-1;p.previous={x:p.x,s:bridge.s-5,yaw:0,height:p.jumpHeight};
    expect(environment.step(p).some(hit=>hit.kind==='overpass')).toBe(true);expect(p.exploded).toBe(true);
  });
  it('does not pass through an overpass when descending onto its deck', () => {
    const bridge=overpassesAt(780).find(b=>b.id===6)!,environment=new EnvironmentCollisions(),p=new Vehicle();
    p.x=0;p.s=bridge.s;p.speed=10;p.shield=4;p.airborne=true;p.jumpVelocity=-6;p.jumpHeight=bridge.underside+bridge.thickness-.1;
    p.previous={x:0,s:bridge.s-2,yaw:0,height:bridge.underside+bridge.thickness+.1};
    expect(environment.step(p).some(hit=>hit.kind==='overpass')).toBe(true);
    expect(p.jumpHeight).toBeGreaterThan(bridge.underside+bridge.thickness);expect(p.jumpVelocity).toBeGreaterThan(0);
  });
  it('strikes an overpass when the car rises into the deck, but clears it below', () => {
    const bridge=overpassesAt(780).find(b=>b.id===6)!,environment=new EnvironmentCollisions(),p=new Vehicle();
    p.x=0;p.s=bridge.s;p.speed=55;p.airborne=true;p.jumpHeight=7.2;p.previous={x:0,s:bridge.s-8,yaw:0,height:7};
    expect(environment.step(p).map(h=>h.kind)).toEqual(['overpass']);expect(p.exploded).toBe(true);
    const clear=new Vehicle();clear.x=0;clear.s=bridge.s;clear.speed=55;clear.airborne=true;clear.jumpHeight=2;clear.previous={x:0,s:bridge.s-8,yaw:0,height:2};
    expect(environment.step(clear)).toEqual([]);expect(clear.exploded).toBe(false);
  });
});
