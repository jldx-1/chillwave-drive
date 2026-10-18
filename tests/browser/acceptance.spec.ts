import { test, expect, type Page } from '@playwright/test';
interface Snapshot { state: string; x: number; s: number; speed: number; lateral:number; steering:number; slipAngle:number; drift:number; slip:number; yaw:number; view: string; damage: number; elapsed: number; capture: number; joins: number; level:number; modelReady:boolean; weather:{drops:number;blades:number}; hdrReady:boolean; textures:number; geometries:number; chunks: number; origin: number; agents: { s: number; x: number; kind: string; direction: number; active:boolean; yaw:number }[] }
declare global { interface Window { __drive: { inspect(): Snapshot; advance(seconds:number):void; streamAt(distance:number):{chunks:number;geometries:number;textures:number} } } }
const inspect = (page: Page) => page.evaluate(() => window.__drive.inspect());
async function setup(page: Page) {
  await page.addInitScript(() => { if (!localStorage.getItem('chillwave-drive:settings:v1')) localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: false })); });
}
test('branding, garage, controls and persistent settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await setup(page);
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
  test.setTimeout(150000);await page.setViewportSize({width:800,height:500});
  await setup(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=DRIVE');
  await page.getByRole('button', { name: 'START DRIVE' }).click(); await page.keyboard.down('w'); await page.clock.runFor(2400);
  let state = await inspect(page); expect(state.speed).toBeGreaterThan(10); expect(state.s).toBeGreaterThan(12);
  expect(state.agents.filter(a => a.kind === 'police').every(a => !a.active)).toBe(true);
  expect(state.agents.filter(a => a.direction === -1).every(a => a.x < 0)).toBe(true);
  const before = state.s; await page.keyboard.press('c'); await page.clock.runFor(700);
  state = await inspect(page); expect(state.view).toBe('cockpit'); expect(state.s).toBeGreaterThan(before); await expect(page.locator('body')).toHaveAttribute('data-view', 'cockpit');
  await page.screenshot({ path: 'test-results/chillwave-cockpit.png' });
  await page.keyboard.down('v'); await page.clock.runFor(150); await page.keyboard.up('v'); await page.keyboard.press('c');
  await page.keyboard.down('d'); await page.clock.runFor(200); await page.keyboard.up('d'); await page.clock.runFor(200);
  state = await inspect(page); expect(state.x).toBeGreaterThan(6.5);
  await page.keyboard.press('Escape'); await page.keyboard.up('w'); const paused = await inspect(page);
  await page.clock.runFor(1800); expect((await inspect(page)).s).toBe(paused.s);
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click({ force: true }); await page.keyboard.down('w'); await page.clock.runFor(500);
  await page.keyboard.up('w'); expect((await inspect(page)).s).toBeGreaterThan(paused.s);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click({ force: true });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chillwave-drive:record:v1')!)); expect(saved.best).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'START DRIVE' }).click(); expect((await inspect(page)).damage).toBe(0); expect((await inspect(page)).s).toBe(0);
  expect(errors).toEqual([]);
});
test('a real overtake alerts patrols and activates the map, lights and pursuit state',async({page})=>{
  await setup(page);await page.setViewportSize({width:800,height:500});await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=CAPTURE');
  await page.getByRole('button',{name:'START DRIVE'}).click();expect((await inspect(page)).level).toBe(0);
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(16));await page.keyboard.up('w');
  const state=await inspect(page);expect(state.joins).toBeGreaterThan(0);expect(state.agents.some(a=>a.kind==='police'&&a.active&&a.s<state.s)).toBe(true);await expect(page.locator('#police-state')).not.toContainText('OVERTAKING');
  const flashes=[];
  for(let i=0;i<4;i++){
    flashes.push(await page.evaluate(()=>{const canvas=document.getElementById('minimap') as HTMLCanvasElement,data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let red=0,blue=0;for(let k=0;k<data.length;k+=4){if(data[k]>225&&data[k+1]<130&&data[k+2]<160)red++;if(data[k+2]>220&&data[k]<120&&data[k+1]>110&&data[k+1]<180)blue++;}return {red,blue};}));
    await page.evaluate(()=>window.__drive.advance(.1));
  }
  expect(flashes.some(f=>f.red>0)).toBe(true);expect(flashes.some(f=>f.blue>0)).toBe(true);
  await page.clock.runFor(100);await page.screenshot({path:'test-results/police-pursuit.png'});
  await page.keyboard.down('s');
  for(let i=0;i<100&&(await inspect(page)).speed>.4&&(await inspect(page)).state==='playing';i++)await page.evaluate(()=>window.__drive.advance(.1));
  await page.keyboard.up('s');await page.evaluate(()=>window.__drive.advance(35));
  expect((await inspect(page)).state).toBe('over');await expect(page.getByRole('dialog')).toContainText('TOP SPEED');
  await page.keyboard.press('r');expect((await inspect(page)).state).toBe('playing');expect((await inspect(page)).capture).toBe(0);

});

test('production assets work under the renamed repository subdirectory', async ({ page }) => {
  await setup(page); const failures: string[] = []; page.on('pageerror', e => failures.push(e.message)); page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  await page.goto('http://127.0.0.1:4174/chillwave-drive/?qa&seed=PAGES');
  await page.getByRole('button', { name: 'START DRIVE' }).click(); await page.keyboard.down('w');
  await expect.poll(async () => (await inspect(page)).speed).toBeGreaterThan(1); await page.keyboard.up('w');
  expect(failures).toEqual([]);
});
test('small touch layout keeps start, driving and camera controls reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await context.newPage(); await setup(page);
  await page.goto('/?qa'); await expect(page.getByRole('button', { name: 'START DRIVE' })).toBeInViewport(); await page.getByRole('button', { name: 'START DRIVE' }).tap();
  await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Change camera', exact: true }).tap();
  expect((await inspect(page)).view).toBe('cockpit'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await context.close();
});

test('high quality reflections, cockpit mirrors and car render without shader errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'high', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=AFTERGLOW');
  await expect.poll(async()=>(await inspect(page)).modelReady).toBe(true);
  await page.clock.runFor(100); await page.screenshot({ path: 'test-results/chillwave-menu.png' });
  await page.getByRole('button', { name: 'START DRIVE' }).click();
  await page.clock.runFor(100); await page.screenshot({ path: 'test-results/chillwave-chase.png' });
  await page.keyboard.press('c'); await page.clock.runFor(100); await page.screenshot({ path: 'test-results/chillwave-cockpit.png' });
  expect((await inspect(page)).weather.blades).toBe(2); expect((await inspect(page)).weather.drops).toBeGreaterThan(0); expect((await inspect(page)).weather.drops).toBeLessThanOrEqual(340); await expect(page.locator('#rain-glass')).toHaveCount(0);
  expect((await inspect(page)).chunks).toBe(14); expect((await inspect(page)).modelReady).toBe(true); expect((await inspect(page)).view).toBe('cockpit'); expect(errors).toEqual([]);
});

test('world streaming releases resources over a 100 km window sweep',async({page})=>{
  test.setTimeout(150000);await setup(page);await page.setViewportSize({width:640,height:400});await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SOAK');await expect.poll(async()=>(await inspect(page)).modelReady).toBe(true);await page.clock.runFor(100);
  const counts=await page.evaluate(()=>{const out=[];for(let i=0;i<80;i++)out.push(window.__drive.streamAt(i*1320));return out;});
  console.log('100 km stream resource range',JSON.stringify({geometries:[Math.min(...counts.map(c=>c.geometries)),Math.max(...counts.map(c=>c.geometries))],textures:[Math.min(...counts.map(c=>c.textures)),Math.max(...counts.map(c=>c.textures))]}));
  expect(counts.every(c=>c.chunks===14)).toBe(true);const first=counts.slice(10,30),last=counts.slice(-20);expect(Math.max(...last.map(c=>c.geometries))).toBeLessThanOrEqual(Math.max(...first.map(c=>c.geometries))+20);expect(Math.max(...last.map(c=>c.textures))).toBeLessThanOrEqual(Math.max(...first.map(c=>c.textures))+8);
});


test('steering with the brake initiates a real drift and countersteering catches it', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 800, height: 500 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.goto('/?qa&seed=DRIFT');
  await page.getByRole('button', { name: 'START DRIVE' }).click();
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4));
  const before = await inspect(page); expect(before.speed).toBeGreaterThan(20);
  await page.keyboard.down('d'); await page.keyboard.down('s'); // Brake works with the accelerator still held.
  await page.evaluate(() => window.__drive.advance(.7));
  const slide = await inspect(page);
  expect(slide.slipAngle).toBeGreaterThan(.3); expect(slide.yaw).toBeGreaterThan(.35);
  expect(slide.drift).toBeGreaterThan(.8); expect(slide.speed).toBeLessThan(before.speed);
  expect(slide.damage).toBe(0);
  await page.clock.runFor(50); await page.screenshot({ path: 'test-results/brake-drift.png' });
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
  await page.getByRole('button', { name: 'START DRIVE' }).click();
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4));
  const before = await inspect(page);
  await page.keyboard.down('d'); await page.evaluate(() => window.__drive.advance(.5));
  const right = await inspect(page); expect(right.x - before.x).toBeGreaterThan(.5); expect(right.lateral).toBeGreaterThan(2.7);
  await page.keyboard.up('d'); await page.keyboard.down('a'); await page.evaluate(() => window.__drive.advance(.9));
  const left = await inspect(page); expect(left.lateral).toBeLessThan(-.3); expect(left.steering).toBeLessThan(0);
  expect(left.drift).toBe(0); expect(left.damage).toBe(0); expect(left.state).toBe('playing');
  await page.keyboard.up('a'); await page.keyboard.up('w');
});
