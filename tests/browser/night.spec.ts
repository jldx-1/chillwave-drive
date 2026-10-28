import { test, expect } from '@playwright/test';
import { startDrive } from './helpers';
import { neonCoverage, patchLuminance } from '../helpers/png-luminance';

test('neon city keeps its night palette and readable road on high and low presets', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 960, height: 540 });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({quality:'high',density:'low',musicEnabled:false})));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=SUNSET'); await startDrive(page); await page.clock.runFor(17);
  await page.screenshot({path:'test-results/neon-city-chase.png'});
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4)); await page.keyboard.up('w'); await page.clock.runFor(17);
  await page.screenshot({path:'test-results/neon-city-driving.png'});
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade{visibility:hidden!important}'});
  const high = await page.locator('#world').screenshot({path:'test-results/neon-city-world.png'});
  const palette = neonCoverage(high); console.log('night palette', JSON.stringify(palette));
  expect(palette.cyan).toBeGreaterThan(.025); expect(palette.magenta).toBeGreaterThan(.015); expect(palette.dark).toBeGreaterThan(.1);
  expect(patchLuminance(high, 360, 340, 240, 180)).toBeGreaterThan(.025);
  const resolution = (await page.evaluate(() => window.__drive.inspect())).resolution;
  // Repeated long frames must not silently lower pixel density or change the preset.
  for (let frame = 0; frame < 16; frame++) {
    await page.clock.fastForward(100);
    const state = await page.evaluate(() => ({state:window.__drive.inspect(),width:(document.querySelector('#world') as HTMLCanvasElement).width}));
    expect(state.state.graphics.quality).toBe('high'); expect(state.state.resolution).toBe(resolution); expect(state.width).toBe(Math.floor(960 * resolution));
  }
  await page.keyboard.press('Escape'); await page.getByRole('button', {name:'AUDIO & GRAPHICS',exact:true}).click();
  await page.getByLabel('Graphics quality').selectOption('low'); await page.getByRole('button',{name:'ALL SET'}).click(); await page.getByRole('button',{name:'RESUME DRIVE'}).click(); await page.clock.runFor(17);
  const low = await page.locator('#world').screenshot({path:'test-results/neon-city-low.png'});
  const lowPalette = neonCoverage(low); expect(lowPalette.cyan).toBeGreaterThan(.015); expect(lowPalette.magenta).toBeGreaterThan(.01);
  expect((await page.evaluate(() => window.__drive.inspect())).roadReflection.visible).toBe(false);
  expect(patchLuminance(low, 360, 340, 240, 180)).toBeGreaterThan(.02);
  expect(errors).toEqual([]);
});
