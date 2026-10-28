import { test, expect } from '@playwright/test';
import { startDrive } from './helpers';

test('the streamed city renders each northbound side street without errors', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=STREETS');await startDrive(page);
  for (const distance of [1050,2850,4650]) {
    const scene=await page.evaluate(distance=>window.__drive.previewCity(distance,false),distance);
    expect(scene.chunks).toBeGreaterThan(0);expect(scene.geometries).toBeGreaterThan(0);
    await page.locator('#world').screenshot({path:`test-results/side-street-${distance}.png`});
  }
  expect(errors).toEqual([]);
});
