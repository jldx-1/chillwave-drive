import {describe,it,expect} from 'vitest';
import {cyberSirenTone} from '../src/drive/cyber-siren';
describe('cyber police scanner sound',()=>{
  it('keeps both harmonics and metallic modulation in a restrained audible range',()=>{
    for(const urgent of [false,true])for(let id=0;id<8;id++)for(let frame=0;frame<600;frame++){
      const tone=cyberSirenTone(frame/60,id,urgent);
      expect(tone.carrier).toBeGreaterThanOrEqual(360);expect(tone.carrier).toBeLessThanOrEqual(890);
      expect(tone.harmony/tone.carrier).toBeGreaterThan(1.48);expect(tone.harmony/tone.carrier).toBeLessThan(1.52);
      expect(tone.level).toBeGreaterThan(0);expect(tone.level).toBeLessThanOrEqual(.085);
      expect(tone.depth).toBeLessThanOrEqual(23);
    }
  });
  it('sweeps smoothly, separates different units and increases urgency without silence',()=>{
    let variation=0,previous=cyberSirenTone(0,0,false);
    for(let frame=1;frame<300;frame++){
      const next=cyberSirenTone(frame/60,0,false);const delta=Math.abs(next.carrier-previous.carrier);
      expect(delta).toBeLessThan(26);variation+=delta;previous=next;
    }
    expect(variation).toBeGreaterThan(1500);
    expect(cyberSirenTone(.2,0,false).carrier).not.toBe(cyberSirenTone(.2,1,false).carrier);
    expect(cyberSirenTone(.2,0,true).carrier).toBeGreaterThan(cyberSirenTone(.2,0,false).carrier);
  });
});
