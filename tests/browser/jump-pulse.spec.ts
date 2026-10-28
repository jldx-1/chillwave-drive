import { expect, test } from '@playwright/test';
import { startDrive } from './helpers';

test('a ramp launches the player during normal driving and pulse controls destroy traffic', async ({page}) => {
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=JUMP');await startDrive(page);
  const before=await page.evaluate(()=>window.__drive.inspect());
  const target=before.agents.filter(a=>a.s>2&&a.s<100&&Math.abs(a.x-before.x)<15).sort((a,b)=>a.s-b.s)[0];
  expect(target).toBeDefined();await page.keyboard.press('q');
  let state=await page.evaluate(()=>window.__drive.inspect());expect(state.agents.some(a=>a.id===target.id)).toBe(false);expect(state.pulseCooldown).toBeGreaterThan(4.9);
  await expect(page.locator('#toast')).toContainText('TARGET DESTROYED');
  await page.keyboard.press('e');await expect(page.locator('#toast')).toContainText('RECHARGING');
  await page.keyboard.down('w');let peak=0;
  for(let i=0;i<80;i++){await page.evaluate(()=>window.__drive.advance(.15));state=await page.evaluate(()=>window.__drive.inspect());peak=Math.max(peak,state.jumpHeight);}
  await page.keyboard.up('w');expect(peak).toBeGreaterThan(2);expect(state.airborne).toBe(false);
});

test('phone pulse buttons respond to touch', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=JUMP');await startDrive(page,true);
  await page.getByRole('button',{name:'Blast car behind'}).tap();await expect(page.locator('#toast')).toContainText('NO CAR BEHIND');
  await page.getByRole('button',{name:'Blast car ahead'}).tap();await expect(page.locator('#toast')).toContainText('TARGET DESTROYED');
  expect((await page.evaluate(()=>window.__drive.inspect())).pulseCooldown).toBeGreaterThan(4.9);
  await context.close();
});
