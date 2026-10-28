import { expect, test } from '@playwright/test';
import { startDrive } from './helpers';

test('Shift boosts only while held, preserves partial fuel, drains and recharges',async({page})=>{
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=NITRO');await startDrive(page);
  await expect(page.locator('#nitro-status')).toContainText('HOLD SHIFT');
  // A tap does not schedule a three-second boost after keyup.
  await page.keyboard.press('ShiftLeft');await page.evaluate(()=>window.__drive.advance(.1));
  let state=await page.evaluate(()=>window.__drive.inspect());expect(state.nitro).toBe(0);expect(state.nitroFuel).toBe(3);
  await page.keyboard.down('ShiftLeft');await page.evaluate(()=>window.__drive.advance(.5));await page.clock.runFor(17);
  state=await page.evaluate(()=>window.__drive.inspect());const partial=state.nitroFuel;
  expect(state.nitro).toBeGreaterThan(0);expect(partial).toBeLessThan(2.51);expect(state.speed).toBeGreaterThan(4);expect(state.boost.visible).toBe(true);expect(state.boost.plumes).toBe(2);
  await expect(page.locator('#nitro-status')).toContainText('ACTIVE');await page.screenshot({path:'test-results/nitro-flames.png'});
  await page.keyboard.up('ShiftLeft');await page.evaluate(()=>window.__drive.advance(1/60));await page.clock.runFor(17);
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.nitro).toBe(0);expect(state.nitroFuel).toBeGreaterThan(partial);expect(state.boost.visible).toBe(false);
  await expect(page.locator('#nitro-status')).toContainText('HOLD SHIFT');
  // Either Shift works, and releasing one leaves the other held.
  await page.keyboard.down('ShiftRight');await page.evaluate(()=>window.__drive.advance(.2));state=await page.evaluate(()=>window.__drive.inspect());expect(state.nitroFuel).toBeLessThan(partial);
  await page.keyboard.down('ShiftLeft');await page.keyboard.up('ShiftRight');await page.evaluate(()=>window.__drive.advance(.1));expect((await page.evaluate(()=>window.__drive.inspect())).nitro).toBeGreaterThan(0);
  await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.__drive.inspect());expect(paused.nitro).toBe(0);
  await page.evaluate(()=>window.__drive.advance(3));expect((await page.evaluate(()=>window.__drive.inspect())).nitroFuel).toBe(paused.nitroFuel);
  await page.keyboard.up('ShiftLeft');await page.getByRole('button',{name:'RESUME DRIVE'}).click({force:true});await page.keyboard.down('s');await page.evaluate(()=>window.__drive.advance(10));await page.keyboard.up('s');
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.state).toBe('playing');expect(state.nitroFuel).toBe(3);expect(state.nitroCooldown).toBe(0);expect(state.nitro).toBe(0);
  await page.keyboard.down('ShiftRight');await page.evaluate(()=>window.__drive.advance(3));await page.clock.runFor(17);
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.nitro).toBe(0);expect(state.nitroReady).toBe(false);expect(state.nitroFuel).toBeLessThan(.02);expect(state.boost.visible).toBe(false);
  await expect(page.locator('#nitro-status')).toContainText('RECHARGING');
  await page.keyboard.up('ShiftRight');await page.keyboard.down('s');await page.evaluate(()=>window.__drive.advance(10));await page.keyboard.up('s');
  expect((await page.evaluate(()=>window.__drive.inspect())).nitroFuel).toBe(3);
});

test('phone nitro is held and stops on touch release or cancellation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=NITRO');await startDrive(page,true);
  const button=page.locator('[data-nitro]');await expect(button).toBeVisible();await expect(button).toContainText('100%');
  const box=(await button.boundingBox())!,go=(await page.locator('[data-key="KeyW"]').boundingBox())!,point={x:box.x+box.width/2,y:box.y+box.height/2,id:1};
  const session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,{x:go.x+go.width/2,y:go.y+go.height/2,id:2}]});
  await page.evaluate(()=>window.__drive.advance(.4));await page.clock.runFor(17);
  let state=await page.evaluate(()=>window.__drive.inspect());expect(state.controls.nitro).toBe(true);expect(state.controls.throttle).toBe(1);expect(state.nitro).toBeGreaterThan(0);await expect(button).toContainText('BOOST');
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>window.__drive.advance(1/60));
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.controls.nitro).toBe(false);expect(state.nitro).toBe(0);const remaining=state.nitroFuel;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.evaluate(()=>window.__drive.advance(.2));expect((await page.evaluate(()=>window.__drive.inspect())).nitroFuel).toBeLessThan(remaining);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.evaluate(()=>window.__drive.advance(1/60));await page.clock.runFor(17);
  state=await page.evaluate(()=>window.__drive.inspect());expect(state.controls.nitro).toBe(false);expect(state.nitro).toBe(0);expect(state.boost.visible).toBe(false);
  await page.screenshot({path:'test-results/nitro-phone.png'});await context.close();
});
