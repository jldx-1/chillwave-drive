import { expect, test } from '@playwright/test';
import { startDrive } from './helpers';

test('a ramp launches the player during normal driving and missiles fly from the car before destroying traffic', async ({page}) => {
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=JUMP');await startDrive(page);
  const before=await page.evaluate(()=>window.__drive.inspect());
  const target=before.agents.filter(a=>a.s>2&&a.s<100&&Math.abs(a.x-before.x)<15).sort((a,b)=>a.s-b.s)[0];
  expect(target).toBeDefined();await page.keyboard.press('q');
  let state=await page.evaluate(()=>window.__drive.inspect());
  expect(state.agents.some(a=>a.id===target.id)).toBe(true);expect(state.pulseCooldown).toBeGreaterThan(4.9);
  expect(state.missiles).toHaveLength(1);expect(state.missiles[0].s).toBeGreaterThan(state.s+2);
  await expect(page.locator('#toast')).toContainText('MISSILE AWAY');
  await page.evaluate(()=>window.__drive.advance(.25));await page.clock.runFor(17);
  state=await page.evaluate(()=>window.__drive.inspect());
  expect(state.missileVisual.visible).toBe(1);expect(state.missiles[0].s).toBeGreaterThan(15);
  await page.screenshot({path:'test-results/missile-flight.png'});
  await page.evaluate(()=>window.__drive.advance(1.5));
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.agents.some(a=>a.id===target.id)).toBe(false);
  expect(state.missiles).toHaveLength(0);
  await expect(page.locator('#toast')).toContainText('TARGET DESTROYED');
  await page.keyboard.press('e');await expect(page.locator('#toast')).toContainText('RECHARGING');
  await page.keyboard.down('w');let peak=0;
  for(let i=0;i<80;i++){await page.evaluate(()=>window.__drive.advance(.15));state=await page.evaluate(()=>window.__drive.inspect());peak=Math.max(peak,state.jumpHeight);}
  await page.keyboard.up('w');expect(peak).toBeGreaterThan(2);expect(state.airborne).toBe(false);
});

test('phone missile buttons respond to touch', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=JUMP');await startDrive(page,true);
  await page.getByRole('button',{name:'Fire missile behind'}).tap();await expect(page.locator('#toast')).toContainText('NO CAR BEHIND');
  await page.getByRole('button',{name:'Fire missile ahead'}).tap();await expect(page.locator('#toast')).toContainText('MISSILE AWAY');
  expect((await page.evaluate(()=>window.__drive.inspect())).pulseCooldown).toBeGreaterThan(4.9);
  await context.close();
});


test('the active shield follows the rendered car between physics steps',async({page})=>{
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SHIELD');await startDrive(page);
  await page.keyboard.down('w');
  for(let i=0;i<60;i++){
    await page.evaluate(()=>window.__drive.advance(.15));
    if((await page.evaluate(()=>window.__drive.inspect())).shield>0)break;
  }
  expect((await page.evaluate(()=>window.__drive.inspect())).shield).toBeGreaterThan(0);
  await page.keyboard.down('d');
  for(const frame of [5,8,11,17,7,13]) {
    await page.clock.runFor(frame);
    const state=await page.evaluate(()=>window.__drive.inspect());
    expect(state.shieldVisual.visible).toBe(true);
    expect(state.shieldVisual.x).toBeCloseTo(state.renderedPlayer.x,9);
    expect(state.shieldVisual.z).toBeCloseTo(state.renderedPlayer.z,9);
    expect(state.shieldVisual.y).toBeCloseTo(state.renderedPlayer.y+.9,9);
    expect(state.shieldVisual.yaw).toBeCloseTo(state.renderedPlayer.yaw,9);
  }
  await page.keyboard.up('d');await page.keyboard.up('w');
  await page.screenshot({path:'test-results/shield-alignment.png'});
});
