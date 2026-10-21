import { describe, expect, it } from 'vitest';
import { DriveScore } from '../src/drive/score';
import { Records } from '../src/drive/storage';
import { Traffic } from '../src/drive/traffic';
import { Vehicle } from '../src/drive/vehicle';
import { STEP } from '../src/drive/config';

describe('driving score and clean multiplier',()=>{
  it('grows clean driving in half-step tiers up to triple points',()=>{
    const score=new DriveScore();score.advance(250);expect(score.value).toBe(250);expect(score.multiplier).toBe(1.5);
    score.advance(500);expect(score.value).toBe(625);expect(score.multiplier).toBe(2);
    score.advance(1000);expect(score.value).toBe(1750);expect(score.multiplier).toBe(3);
    score.advance(1250);expect(score.value).toBe(2500);expect(score.multiplier).toBe(3);
  });
  it('scores tier boundaries identically with small or large simulation steps',()=>{
    const a=new DriveScore(),b=new DriveScore();a.advance(1400);
    for(let i=1;i<=14000;i++)b.advance(i/10);
    expect(a.points).toBeCloseTo(b.points,6);
  });
  it('deducts points immediately on impact and resets the clean bonus',()=>{
    const score=new DriveScore();score.advance(800);const before=score.value;
    expect(score.multiplier).toBe(2.5);const loss=score.collide(10);
    expect(loss).toBe(220);expect(score.value).toBe(before-220);expect(score.multiplier).toBe(1);expect(score.hits).toBe(1);
    score.advance(900);expect(score.value).toBe(before-220+100);
    score.collide(80);score.collide(80);expect(score.value).toBe(0);
  });
  it('does not earn points from reversing, replaying old road, idling or invalid distance',()=>{
    const score=new DriveScore();score.advance(100);score.advance(50);score.advance(100);score.advance(NaN);score.advance(Infinity);
    expect(score.value).toBe(100);expect(score.cleanDistance).toBe(100);
    score.reset();expect(score.value).toBe(0);expect(score.multiplier).toBe(1);expect(score.hits).toBe(0);
  });
  it('breaks a streak during persistent contact without charging a new impact penalty each frame',()=>{
    const score=new DriveScore();score.advance(500);score.collide(5);const hits=score.hits;
    for(let i=1;i<=300;i++){score.advance(500+i);score.breakStreak();}
    expect(score.multiplier).toBe(1);expect(score.hits).toBe(hits);
  });
  it('saves score records alongside existing distance records and migrates old saves',()=>{
    const data=new Map([['chillwave-drive:record:v1',JSON.stringify({best:2300,runs:4})]]);
    const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const record=new Records(storage);expect(record.bestScore).toBe(0);expect(record.best).toBe(2300);
    record.finish({distance:1000,time:50,topSpeed:140,nearMisses:1,level:1,detours:0,score:1750});
    const saved=new Records(storage);expect(saved.bestScore).toBe(1750);expect(saved.best).toBe(2300);expect(saved.runs).toBe(5);
  });
  it('reports a slow vehicle touch once per continuous contact episode',()=>{
    const traffic=new Traffic('SCORE-TOUCH','low'),player=new Vehicle();traffic.reset();
    const car=traffic.agents.find(a=>a.kind!=='police'&&a.direction===1)!;traffic.agents=[car];
    let charges=0,touches=0;
    for(let frame=0;frame<60;frame++){
      // Hold the same low-energy body contact; this verifies episode debouncing, independent of damage.
      player.x=car.x;player.s=car.s-1;player.previous={x:player.x,s:player.s,yaw:0};player.speed=car.speed=0;car.desired=0;
      const event=traffic.step(STEP,player,frame*STEP);charges+=event.scoreHits.length;touches+=Number(event.touching);
    }
    expect(touches).toBeGreaterThan(20);expect(charges).toBe(1);
  });
});
