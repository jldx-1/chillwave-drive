import { startDrive, waitForDrive } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { patchLuminance } from '../helpers/png-luminance';
interface Snapshot { radio:{videoId:string;state:string;ready:boolean;requested:boolean;volume:number}; atmosphere:{height:number;density:number;fullyHiddenAt:number;origin:number;sunsetVisible:boolean;sunsetInView:boolean;sunsetDepthTest:boolean;streamBehind:number;streamAhead:number}; catalog:{available:number;activeAssets:number[];nearGroups:number;midGroups:number}; controls:{nitro:boolean;throttle:number;brake:number;steer:number;handbrake:boolean}; aerialTraffic:{count:number;visible:number;poses:{kind:string;x:number;y:number;s:number}[]};cityLighting:{physicalLights:number;activeLights:number}; resolution:number; graphics:{quality:string;mobile:boolean;effectsReady:boolean;programs:number;explosion:{age:number;smoke:boolean;particles:number};samples:number;ao:boolean;projectionMatches:boolean;near:number;mirrorFrames:number}; state: string; x: number; s: number; speed: number; lateral:number; steering:number; slipAngle:number; drift:number; slip:number; yaw:number; view: string; damage: number; exploded:boolean; shield:number; turbo:number; nitro:number; nitroFuel:number; nitroReady:boolean; nitroCooldown:number; jumpHeight:number; airborne:boolean; pulseCooldown:number; elapsed: number; capture: number; joins: number; level:number; nearMisses:number; cameraY:number; cameraFov:number; bodyTilt:{pitch:number;roll:number}; boost:{visible:boolean;strength:number;plumes:number}; roadReflection:{visible:boolean;anchorZ:number;depthBias:boolean;mipmaps:boolean}; yawRate:number; score:number; multiplier:number; scoreHits:number; fleetReady:boolean; trafficModels:{kind:string;ready:boolean;failed:boolean;lod:number}[]; modelReady:boolean; weather:{drops:number;blades:number}; hdrReady:boolean; textures:number; geometries:number; chunks: number; origin: number; agents: { id:number; s: number; x: number; kind: string; direction: number; active:boolean; yaw:number }[] }
declare global { interface Window { __drive: { previewFleet(id:import('../../src/drive/cyber-vehicles').CyberModel,angle:number,lod?:0|1|2):Promise<{id:string;name:string;wheels:number;lamps:Record<string,number>;lod:number}>;previewCity(distance:number,rear:boolean,windowDistance?:number,probe?:{occluder?:number;sun?:boolean}):Snapshot & {sunsetScreen:number[]}; inspect(): Snapshot; advance(seconds:number):void; setCityNeon(enabled:boolean):void; streamAt(distance:number):{chunks:number;geometries:number;textures:number} } } }
const inspect = (page: Page) => page.evaluate(() => window.__drive.inspect());
async function setup(page: Page) {
  await page.addInitScript(() => { if (!localStorage.getItem('chillwave-drive:settings:v1')) localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: false })); });
}
test('branding, garage, controls and persistent settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
  await page.setViewportSize({width:800,height:500});await page.clock.install();await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=SUNSET'); await expect(page).toHaveTitle(/Chillwave Drive/);
  await page.getByRole('button', { name: 'GARAGE', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('AFTERGLOW');
  await page.getByRole('button', { name: 'BACK TO THE CITY' }).click();
  await page.getByRole('button', { name: 'CONTROLS', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('Brake / reverse');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await page.getByLabel('Graphics quality').selectOption('medium'); await page.getByLabel('Traffic density').selectOption('dense');
  await page.getByLabel('Reduced motion').check(); await page.getByRole('button', { name: 'ALL SET' }).click();
  await page.reload(); await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await expect(page.getByLabel('Graphics quality')).toHaveValue('medium'); await expect(page.getByLabel('Traffic density')).toHaveValue('dense'); await expect(page.getByLabel('Reduced motion')).toBeChecked();
  expect(errors).toEqual([]);
});
test('real fixed-step driving, both cameras, steering, pause and saved records', async ({ page }) => {
  // Keep real fixed-step input while avoiding hundreds of software-GPU renders.
  test.setTimeout(150000);await page.setViewportSize({width:800,height:500});
  await setup(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=DRIVE');
  await startDrive(page); await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(2.4));
  await page.clock.runFor(67);
  let state = await inspect(page);
  expect(state.elapsed).toBeGreaterThan(2.4);
  expect(state.trafficModels.length).toBeGreaterThan(0);
  expect(state.trafficModels.every(car=>car.ready&&!car.failed)).toBe(true);
  expect(state.speed).toBeGreaterThan(10); expect(state.s).toBeGreaterThan(12);
  expect(state.agents.filter(a => a.kind === 'police').every(a => !a.active)).toBe(true);
  expect(state.agents.filter(a => a.direction === -1).every(a => a.x < 0)).toBe(true);
  const before = state.s; await page.keyboard.press('c'); await page.evaluate(() => window.__drive.advance(.7)); await page.clock.runFor(17);
  state = await inspect(page); expect(state.view).toBe('cockpit'); expect(state.s).toBeGreaterThan(before); await expect(page.locator('body')).toHaveAttribute('data-view', 'cockpit');
  await page.screenshot({ path: 'test-results/chillwave-cockpit.png' });
  await page.keyboard.down('v'); await page.evaluate(() => window.__drive.advance(.15)); await page.clock.runFor(17); await page.keyboard.up('v'); await page.keyboard.press('c');
  await page.keyboard.down('d'); await page.evaluate(() => window.__drive.advance(.2)); await page.keyboard.up('d'); await page.evaluate(() => window.__drive.advance(.2));
  state = await inspect(page); expect(state.x).toBeGreaterThan(6.5);
  await page.keyboard.press('Escape'); await page.keyboard.up('w'); const paused = await inspect(page);
  await page.evaluate(() => window.__drive.advance(1.8)); await page.clock.runFor(17); expect((await inspect(page)).s).toBe(paused.s);
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click({ force: true }); await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(.5));
  await page.keyboard.up('w'); expect((await inspect(page)).s).toBeGreaterThan(paused.s);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click({ force: true });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chillwave-drive:record:v1')!)); expect(saved.best).toBeGreaterThan(20);
  await startDrive(page); expect((await inspect(page)).damage).toBe(0); expect((await inspect(page)).s).toBe(0);
  expect(errors).toEqual([]);
});
test('a real overtake alerts patrols and activates the map, lights and pursuit state',async({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=CAPTURE');
  await startDrive(page);expect((await inspect(page)).level).toBe(0);
  // Brake soon after overtaking, before reaching the next traffic queue at fatal closing speed.
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(12));await page.keyboard.up('w');
  const state=await inspect(page);expect(state.joins).toBeGreaterThan(0);expect(state.agents.some(a=>a.kind==='police'&&a.active&&a.s<state.s)).toBe(true);await expect(page.locator('#police-state')).not.toContainText('OVERTAKING');
  const flashes=[];
  for(let i=0;i<4;i++){
    flashes.push(await page.evaluate(()=>{const canvas=document.getElementById('minimap') as HTMLCanvasElement,data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let red=0,blue=0;for(let k=0;k<data.length;k+=4){if(data[k]>225&&data[k+1]<130&&data[k+2]<160)red++;if(data[k+2]>220&&data[k]<120&&data[k+1]>110&&data[k+1]<180)blue++;}return {red,blue};}));
    await page.evaluate(()=>window.__drive.advance(.1));
  }
  expect(flashes.some(f=>f.red>0)).toBe(true);expect(flashes.some(f=>f.blue>0)).toBe(true);
  await page.clock.fastForward(100);await page.screenshot({path:'test-results/police-pursuit.png'});
  await page.keyboard.down('s');
  for(let i=0;i<100&&(await inspect(page)).speed>.4&&(await inspect(page)).state==='playing';i++)await page.evaluate(()=>window.__drive.advance(.1));
  await page.keyboard.up('s');await page.evaluate(()=>window.__drive.advance(35));
  expect((await inspect(page)).state).toBe('over');await expect(page.getByRole('dialog')).toContainText('TOP SPEED');
  await page.keyboard.press('r');expect((await inspect(page)).state).toBe('playing');expect((await inspect(page)).capture).toBe(0);

});

test('production assets work under the renamed repository subdirectory', async ({ page }) => {
  await setup(page); const failures: string[] = []; page.on('pageerror', e => failures.push(e.message)); page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  await page.setViewportSize({width:800,height:500});await page.clock.install();await page.clock.pauseAt(new Date());
  await page.goto('http://127.0.0.1:4174/chillwave-drive/?qa&seed=PAGES');
  await startDrive(page); await page.keyboard.down('w');
  await page.evaluate(()=>window.__drive.advance(.5)); expect((await inspect(page)).speed).toBeGreaterThan(1); await page.keyboard.up('w');
  expect(failures).toEqual([]);
});
test('small touch layout keeps start, driving and camera controls reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await context.newPage(); await setup(page);await page.clock.install();await page.clock.pauseAt(new Date());
  await page.goto('/?qa'); await expect(page.getByRole('button', { name: 'START DRIVE' })).toBeInViewport(); await startDrive(page, true);
  await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Change camera', exact: true }).tap();
  expect((await inspect(page)).view).toBe('cockpit'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await context.close();
});

test('high quality reflections, cockpit mirrors and car render without shader errors', async ({ page }) => {
  await page.setViewportSize({width:640,height:400});
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'high', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=AFTERGLOW');
  await expect.poll(async()=>(await inspect(page)).modelReady,{timeout:30000}).toBe(true);
  await page.clock.fastForward(100); await page.screenshot({ path: 'test-results/chillwave-menu.png' });
  await startDrive(page);
  await page.clock.fastForward(100); await page.screenshot({ path: 'test-results/chillwave-chase.png' });
  await page.keyboard.press('c'); await page.clock.fastForward(100); await page.screenshot({ path: 'test-results/chillwave-cockpit.png' });
  expect((await inspect(page)).weather.blades).toBe(2); expect((await inspect(page)).weather.drops).toBeGreaterThan(0); expect((await inspect(page)).weather.drops).toBeLessThanOrEqual(340); await expect(page.locator('#rain-glass')).toHaveCount(0);
  expect((await inspect(page)).chunks).toBe(14); expect((await inspect(page)).modelReady).toBe(true); expect((await inspect(page)).view).toBe('cockpit'); expect(errors).toEqual([]);
});

test('world streaming releases resources over a 100 km window sweep',async({page})=>{
  test.setTimeout(150000);await setup(page);await page.setViewportSize({width:320,height:200});await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SOAK');await waitForDrive(page);await page.clock.runFor(34);
  const counts=await page.evaluate(()=>{const out=[];for(let i=0;i<80;i++)out.push(window.__drive.streamAt(i*1320));return out;});
  console.log('100 km stream resource range',JSON.stringify({geometries:[Math.min(...counts.map(c=>c.geometries)),Math.max(...counts.map(c=>c.geometries))],textures:[Math.min(...counts.map(c=>c.textures)),Math.max(...counts.map(c=>c.textures))]}));
  expect(counts.every(c=>c.chunks===14)).toBe(true);const first=counts.slice(10,30),last=counts.slice(-20);expect(Math.max(...last.map(c=>c.geometries))).toBeLessThanOrEqual(Math.max(...first.map(c=>c.geometries))+20);expect(Math.max(...last.map(c=>c.textures))).toBeLessThanOrEqual(Math.max(...first.map(c=>c.textures))+8);
});


test('steering with the brake initiates a real drift and countersteering catches it', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 800, height: 500 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=DRIFT');
  await startDrive(page);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4));
  const before = await inspect(page); expect(before.speed).toBeGreaterThan(20);
  await page.keyboard.down('d'); await page.keyboard.down('s'); // Brake works with the accelerator still held.
  await page.evaluate(() => window.__drive.advance(.7));
  const slide = await inspect(page);
  expect(slide.slipAngle).toBeGreaterThan(.3); expect(slide.yaw).toBeGreaterThan(.35);
  expect(slide.drift).toBeGreaterThan(.8); expect(slide.speed).toBeLessThan(before.speed);
  expect(slide.damage).toBe(0);
  await page.clock.fastForward(50); await page.screenshot({ path: 'test-results/brake-drift.png' });
  await page.keyboard.up('s'); await page.keyboard.up('d'); await page.keyboard.down('a');
  await page.evaluate(() => window.__drive.advance(.45)); await page.keyboard.up('a');
  const caught = await inspect(page); expect(Math.abs(caught.slipAngle)).toBeLessThan(slide.slipAngle * .25);
  await page.keyboard.up('w'); await page.evaluate(() => window.__drive.advance(1.4));
  const recovered = await inspect(page);
  expect(Math.abs(recovered.slipAngle)).toBeLessThan(.06); expect(recovered.drift).toBeLessThan(.05);
  expect(recovered.damage).toBe(0); expect(recovered.state).toBe('playing'); expect(errors).toEqual([]);
});


test('accelerating still permits quick left-right steering without entering a drift', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 800, height: 500 });
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=AGILE');
  await startDrive(page);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4));
  const before = await inspect(page);
  await page.keyboard.down('d'); await page.evaluate(() => window.__drive.advance(.5));
  const right = await inspect(page); expect(right.x - before.x).toBeGreaterThan(.5); expect(right.lateral).toBeGreaterThan(2.7);
  await page.keyboard.up('d'); await page.keyboard.down('a'); await page.evaluate(() => window.__drive.advance(.9));
  const left = await inspect(page); expect(left.lateral).toBeLessThan(-.3); expect(left.steering).toBeLessThan(0);
  expect(left.drift).toBe(0); expect(left.damage).toBe(0); expect(left.state).toBe('playing');
  await page.keyboard.up('a'); await page.keyboard.up('w');
});

test('a real clean close pass gives a small boost only after fully clearing traffic', async ({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SKIM');
  await startDrive(page);
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(4));
  await page.keyboard.down('d');await page.evaluate(()=>window.__drive.advance(.3));await page.keyboard.up('d');
  await page.keyboard.down('a');await page.evaluate(()=>window.__drive.advance(1/3));await page.keyboard.up('a');
  await page.evaluate(()=>window.__drive.advance(415/60));
  const before=await inspect(page);expect(before.nearMisses).toBe(0);expect(before.damage).toBe(0);
  await page.evaluate(()=>window.__drive.advance(.1));
  const after=await inspect(page);
  expect(after.nearMisses).toBe(1);expect(after.speed-before.speed).toBeGreaterThan(3.8);
  expect(after.speed-before.speed).toBeLessThan(4.5);expect(after.damage).toBe(0);
  await expect(page.locator('#toast')).toHaveText('CLOSE PASS · SPEED BOOST');
  await page.clock.runFor(17);
  const burst=await inspect(page);expect(burst.boost.visible).toBe(true);expect(burst.boost.strength).toBeGreaterThan(.5);expect(burst.boost.plumes).toBe(2);
  await page.screenshot({path:'test-results/clean-close-pass-boost.png'});
  await page.evaluate(()=>window.__drive.advance(.6));await page.clock.runFor(17);expect((await inspect(page)).nearMisses).toBe(1);expect((await inspect(page)).boost.visible).toBe(false);
  await page.keyboard.up('w');
});

test('sunset lighting is ready before driving even when the HDR loads after the cars',async({page})=>{
  await setup(page);await page.setViewportSize({width:640,height:400});
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/textures/venice-sunset.hdr',async route=>{await gate;await route.continue();});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=LIGHTING');
  await expect.poll(async()=>(await inspect(page)).modelReady,{timeout:30000}).toBe(true);
  expect((await inspect(page)).hdrReady).toBe(false);await expect(page.getByRole('button',{name:'START DRIVE'})).toBeDisabled();
  release();await waitForDrive(page);
  expect((await inspect(page)).hdrReady).toBe(true);
  await startDrive(page);await page.keyboard.down('w');
  await page.evaluate(()=>window.__drive.advance(3));await page.keyboard.up('w');
  expect((await inspect(page)).state).toBe('playing');expect((await inspect(page)).hdrReady).toBe(true);
});

test('arrow-key handbrake countersteering responds to the newest key and preserves heading on release',async({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=ARROWS');
  await startDrive(page);
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.__drive.advance(4));await page.keyboard.up('ArrowUp');
  await page.keyboard.down('Space');await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.__drive.advance(.7));
  const left=await inspect(page);expect(left.slipAngle).toBeLessThan(-.25);
  // Keep Left held while pressing Right: the newest direction must win, including against key repeat.
  await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowLeft');
  await page.evaluate(()=>window.__drive.advance(1/60));
  const immediate=await inspect(page);expect(immediate.steering).toBeGreaterThan(0);
  await page.keyboard.up('ArrowLeft');await page.evaluate(()=>window.__drive.advance(.3));
  const right=await inspect(page);expect(right.lateral).toBeGreaterThan(0);expect(right.yaw).toBeGreaterThan(left.yaw);expect(right.yawRate).toBeGreaterThan(0);
  await page.keyboard.up('Space');await page.evaluate(()=>window.__drive.advance(.5));
  const caught=await inspect(page);expect(Math.abs(caught.slipAngle)).toBeLessThan(.08);expect(caught.drift).toBeLessThan(.06);expect(caught.steering).toBeGreaterThan(0);
  await page.keyboard.up('ArrowRight');
  // A smaller separate turn verifies release without coasting a large drift into a barrier.
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'RESTART DRIVE'}).click();
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.__drive.advance(3));await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.__drive.advance(.2));await page.keyboard.up('ArrowRight');
  await page.evaluate(()=>window.__drive.advance(.4));const heading=await inspect(page);
  await page.evaluate(()=>window.__drive.advance(1));const released=await inspect(page);
  expect(heading.yaw).toBeGreaterThan(.04);expect(Math.abs(released.yaw-heading.yaw)).toBeLessThan(.004);
  expect(released.x-heading.x).toBeGreaterThan(.7);expect(released.damage).toBe(0);
  await page.clock.runFor(17);await page.screenshot({path:'test-results/heading-preserved.png'});
});

test('real traffic impacts deduct score, reset the clean multiplier and save the high score',async({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=CRASH');
  await startDrive(page);await page.keyboard.down('w');
  const impact=await page.evaluate(()=>{
    let before=window.__drive.inspect();
    for(let i=0;i<600&&before.state==='playing';i++){
      window.__drive.advance(.1);const after=window.__drive.inspect();
      if(after.scoreHits>before.scoreHits)return {before,after};
      before=after;
    }
    return null;
  });
  expect(impact).not.toBeNull();
  expect(impact!.before.multiplier).toBeGreaterThan(1);expect(impact!.after.multiplier).toBe(1);
  expect(impact!.after.score).toBeLessThan(impact!.before.score);expect(impact!.after.score).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#score')).toHaveText(impact!.after.score.toLocaleString('en-US'));
  await expect(page.locator('#score-multiplier')).toHaveText('CLEAN ×1.0');
  await page.keyboard.up('w');await page.clock.runFor(17);await page.screenshot({path:'test-results/collision-score-penalty.png'});
  const final=await inspect(page);
  if(final.state==='over') { await page.clock.fastForward(4500); }
  else await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'MAIN MENU',exact:true}).click();
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('chillwave-drive:record:v1')!));
  expect(record.bestScore).toBe(final.score);await expect(page.locator('#menu-score')).toHaveText(final.score.toLocaleString('en-US'));
  await startDrive(page);
  expect((await inspect(page)).score).toBe(0);expect((await inspect(page)).multiplier).toBe(1);
  await expect(page.locator('#score')).toHaveText('0');await expect(page.locator('#score-multiplier')).toHaveText('CLEAN ×1.0');
});

test('cockpit stays level and steady while accelerating and turning',async({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=STEADY');
  await startDrive(page);await page.keyboard.press('c');
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(2.4));
  const first=await inspect(page);expect(first.view).toBe('cockpit');expect(first.cameraFov).toBe(71);
  await page.keyboard.down('d');await page.evaluate(()=>window.__drive.advance(.3));
  await page.keyboard.down('Space');await page.evaluate(()=>window.__drive.advance(.15));
  const turning=await inspect(page);
  expect(turning.cameraY).toBeCloseTo(first.cameraY,8);expect(turning.cameraFov).toBe(71);
  expect(turning.bodyTilt.pitch).toBe(0);expect(turning.bodyTilt.roll).toBe(0);
  expect(turning.yaw).toBeGreaterThan(first.yaw);expect(turning.speed).toBeGreaterThan(first.speed-1);
  await page.keyboard.up('d');await page.keyboard.up('Space');await page.keyboard.up('w');
  await page.clock.runFor(17);await page.screenshot({path:'test-results/steady-cockpit.png'});
});

test('wet-road building reflections remain continuous across moving rendered frames',async({page})=>{
  test.setTimeout(180000);await page.setViewportSize({width:640,height:400});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'high',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=REFLECTION');
  await startDrive(page);await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(4));await page.keyboard.up('w');
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade{visibility:hidden!important}'});
  const luminance:number[]=[];
  for(let frame=0;frame<8;frame++){
    await page.clock.runFor(17);
    const screenshot=await page.locator('#world').screenshot({path:'test-results/road-reflection-'+frame+'.png'});
    luminance.push(patchLuminance(screenshot,90,210,125,75));
    const state=await inspect(page),reflection=state.roadReflection;
    expect(reflection.visible).toBe(true);expect(reflection.anchorZ+state.s-state.origin).toBeCloseTo(-650,5);expect(reflection.depthBias).toBe(true);expect(reflection.mipmaps).toBe(true);
  }
  const changes=luminance.slice(1).map((value,i)=>Math.abs(value-luminance[i]));
  console.log('moving wet-road reflection luminance',JSON.stringify({luminance,maxFrameChange:Math.max(...changes)}));
  expect(luminance.every(value=>value>.02)).toBe(true);expect(Math.max(...changes)).toBeLessThan(.025);expect(errors).toEqual([]);
});
