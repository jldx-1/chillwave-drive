import {startDrive} from './helpers';
import {test,expect,type Page} from '@playwright/test';
interface RadioHarness {players:number;plays:number;pauses:number;volume:number;blocked:boolean;failure:boolean;fail?:()=>void}
declare global {interface Window {radioHarness:RadioHarness;audioQA:{panners:PannerNode[];oscillators:OscillatorNode[]}}}
const thumbnail='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
async function radioSetup(page:Page,blocked=false,failure=false){
  await page.setViewportSize({width:960,height:600});await page.clock.install();await page.clock.pauseAt(new Date());
  await page.route('https://i.ytimg.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from(thumbnail,'base64')}));
  await page.route('https://www.youtube.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="background:#152338;color:white">YouTube provider test fixture</body></html>'}));
  await page.addInitScript(({blocked,failure})=>{
    const q:RadioHarness=window.radioHarness={players:0,plays:0,pauses:0,volume:0,blocked,failure};
    window.YT={Player:class {
      events: {onReady:(e:{target:any})=>void;onStateChange:(e:{data:number})=>void;onError:(e:{data:number})=>void;onAutoplayBlocked:()=>void};
      constructor(private frame:HTMLIFrameElement,options:{events:any}){q.players++;this.events=options.events;q.fail=()=>this.events.onError({data:101});queueMicrotask(()=>{if(q.failure)this.events.onError({data:101});else this.events.onReady({target:this});});}
      playVideo(){q.plays++;if(q.blocked){q.blocked=false;this.events.onAutoplayBlocked();}else this.events.onStateChange({data:1});}
      pauseVideo(){q.pauses++;this.events.onStateChange({data:2});}
      setVolume(v:number){q.volume=v;}getIframe(){return this.frame;}destroy(){this.frame.remove();}
    }};
    const Native=window.AudioContext;window.audioQA={panners:[],oscillators:[]};
    window.AudioContext=class extends Native {createPanner(){const p=super.createPanner();window.audioQA.panners.push(p);return p;}createOscillator(){const o=super.createOscillator();window.audioQA.oscillators.push(o);return o;}};
    localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:true,musicVolume:.36,effectsVolume:.4}));
  },{blocked,failure});
}
async function observeAudio(page:Page){await radioSetup(page);}

test('YouTube mini-player plays the requested video, stays active through pause, and has independent persistent volume',async({page})=>{
  await radioSetup(page);const audioFiles:string[]=[];page.on('request',r=>{if(r.url().endsWith('.wav'))audioFiles.push(r.url());});
  await page.goto('/?qa&seed=MUSIC');await expect(page.getByAltText('YouTube music video thumbnail')).toBeVisible();
  expect(await page.evaluate(()=>window.radioHarness.players)).toBe(0);
  await startDrive(page);const card=page.getByRole('complementary',{name:'YouTube radio'});
  await expect(card).toHaveAttribute('data-playback','playing');
  const frame=card.locator('iframe');await expect(frame).toBeHidden();
  const banner=await card.boundingBox();expect(banner!.height).toBeLessThanOrEqual(58);expect(banner!.width).toBeLessThanOrEqual(300);
  await card.getByRole('button',{name:'Show YouTube video'}).click();await expect(frame).toBeVisible();expect(await frame.getAttribute('src')).toContain('/embed/wOMwO5T3yT4?');
  const size=await frame.boundingBox();expect(size!.width).toBeGreaterThanOrEqual(200);expect(size!.height).toBeGreaterThanOrEqual(200);
  await card.locator('.radio-close').click();await expect(frame).toBeHidden();await expect(card).toHaveAttribute('data-playback','playing');
  await page.getByRole('button',{name:'Pause drive'}).click();await expect(card).toHaveAttribute('data-playback','playing');
  await page.getByRole('button',{name:'AUDIO & GRAPHICS',exact:true}).click();await expect(page.getByLabel('Music style')).toHaveCount(0);
  for(const [label,value]of [['Music volume','.25'],['Sound effects volume','.1']])await page.getByLabel(label,{exact:true}).evaluate((e:HTMLInputElement,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  expect(await page.evaluate(()=>window.radioHarness.volume)).toBe(25);
  await page.getByRole('button',{name:'ALL SET'}).click();await page.getByRole('button',{name:'RESUME DRIVE'}).click();
  expect(await page.evaluate(()=>window.radioHarness.players)).toBe(1);await expect(card).toHaveAttribute('data-playback','playing');
  await page.getByRole('button',{name:'Pause YouTube music'}).click();await expect(card).toHaveAttribute('data-playback','paused');
  await page.getByRole('button',{name:'Play YouTube music'}).click();await expect(card).toHaveAttribute('data-playback','playing');
  await page.getByRole('button',{name:'Pause drive'}).click();await page.getByRole('button',{name:'AUDIO & GRAPHICS',exact:true}).click();
  await page.getByLabel('YouTube video link').fill('https://youtu.be/M7lc1UVf-VE?si=example');await page.getByLabel('YouTube video link').press('Tab');
  await expect(card.locator('iframe')).toHaveAttribute('src',/embed\/M7lc1UVf-VE\?/);await expect(card).toHaveAttribute('data-playback','playing');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('chillwave-drive:settings:v1')!));
  expect(saved.musicVideoUrl).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');expect(saved.musicVolume).toBe(.25);expect(saved.effectsVolume).toBe(.1);expect(saved.musicStyle).toBeUndefined();expect(audioFiles).toHaveLength(0);
});
test('blocked autoplay offers a user action and unavailable videos retain a retry and YouTube link',async({page})=>{
  await radioSetup(page,true);await page.goto('/?qa&seed=MUSIC');await startDrive(page);
  await expect(page.locator('.radio-status')).toHaveText('TAP PLAY IN VIDEO');await page.getByRole('button',{name:'Play YouTube music'}).click();
  await expect(page.locator('.radio-card')).toHaveAttribute('data-playback','playing');
  await page.evaluate(()=>{window.radioHarness.failure=true;window.radioHarness.fail?.();});
  await expect(page.locator('.radio-card')).toHaveAttribute('data-playback','error');
  await expect(page.getByRole('button',{name:'Retry YouTube music'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open music on YouTube'})).toHaveAttribute('href','https://www.youtube.com/watch?v=wOMwO5T3yT4');
  expect((await page.evaluate(()=>window.__drive.inspect())).state).toBe('playing');
  await page.evaluate(()=>window.radioHarness.failure=false);await page.getByRole('button',{name:'Retry YouTube music'}).click();
  await expect(page.locator('.radio-card')).toHaveAttribute('data-playback','playing');

});

test('an active YouTube player leaves phone pedals and steering reachable in both orientations',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await radioSetup(page);await page.setViewportSize({width:390,height:844});
  await page.goto('/?qa&seed=PHONE');await startDrive(page,true);await expect(page.locator('.radio-card')).toHaveAttribute('data-playback','playing');
  for(const viewport of [{width:390,height:844},{width:667,height:375}]){
    await page.setViewportSize(viewport);await page.clock.runFor(17);
    const banner=await page.locator('.radio-card').boundingBox();expect(banner!.height).toBeLessThanOrEqual(58);expect(banner!.x+banner!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator('.radio-card iframe')).toBeHidden();
    const controls=await page.locator('.touch-controls button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,reachable:hit?.closest('button')===button};}));
    expect(controls).toHaveLength(9);expect(controls.every(c=>c.reachable&&c.width>=44&&c.height>=44)).toBe(true);
    await page.screenshot({path:`test-results/radio-phone-${viewport.width}.png`});
  }
  await context.close();
});

test('patrols are silent and an alerted unit gets a real position-bound siren',async({page})=>{
  await observeAudio(page);await page.goto('/?qa&seed=CAPTURE');await startDrive(page);
  expect(await page.evaluate(()=>window.audioQA.panners.length)).toBe(6);
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(12));await page.keyboard.up('w');await page.clock.runFor(17);
  await expect.poll(()=>page.evaluate(()=>window.audioQA.panners.length)).toBeGreaterThan(6);
  expect(await page.evaluate(()=>window.audioQA.oscillators.slice(11).some(o=>o.type==='triangle'))).toBe(true);
  const spatial=await page.evaluate(()=>{const state=window.__drive.inspect(),unit=state.agents.find(a=>a.kind==='police'&&a.active)!;return {panners:window.audioQA.panners.slice(6).map(p=>({x:p.positionX.value,z:p.positionZ.value})),unit,origin:state.origin};});
  expect(spatial.panners.some(p=>Math.abs(p.x-spatial.unit.x)<.5&&Math.abs(p.z+(spatial.unit.s-spatial.origin))<2)).toBe(true);
});
