import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';

test('service brakes respond promptly, override held throttle and hold the car at rest',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:640,height:400});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=BRAKES');await startDrive(page);
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(4));
  const before=await page.evaluate(()=>window.__drive.inspect());expect(before.speed).toBeGreaterThan(15);
  await page.keyboard.down('s');await page.evaluate(()=>window.__drive.advance(.1));
  const braking=await page.evaluate(()=>window.__drive.inspect());expect(before.speed-braking.speed).toBeGreaterThan(1.1);
  await page.keyboard.up('w');await page.evaluate(()=>window.__drive.advance(3));
  expect((await page.evaluate(()=>window.__drive.inspect())).speed).toBe(0);
  await page.evaluate(()=>window.__drive.advance(1));expect((await page.evaluate(()=>window.__drive.inspect())).speed).toBe(0);
  await page.keyboard.up('s');await page.evaluate(()=>window.__drive.advance(.1));
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(.3));await page.keyboard.up('w');
  const resumed=await page.evaluate(()=>window.__drive.inspect());expect(resumed.state).toBe('playing');expect(resumed.speed).toBeGreaterThan(0);expect(errors).toEqual([]);
});
