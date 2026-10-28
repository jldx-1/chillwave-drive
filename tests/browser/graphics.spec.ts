import { startDrive } from './helpers';
import { test, expect } from '@playwright/test';
import { luminanceTiles } from '../helpers/png-luminance';

test('moving road stays stable and every preset/camera uses the current rendering state', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 480, height: 300 });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'high', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=STABLE'); await startDrive(page);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(4));
  await page.keyboard.down('d'); await page.evaluate(() => window.__drive.advance(.18));
  await page.keyboard.up('d'); await page.keyboard.up('w');
  await page.addStyleTag({ content: '#hud,.header,#toast,.screen-shade{visibility:hidden!important}' });
  const frames: number[][] = [];
  for (let i = 0; i < 6; i++) {
    await page.clock.runFor(17);
    const png = await page.locator('#world').screenshot({ path: `test-results/stable-road-${i}.png` });
    frames.push([...luminanceTiles(png, 45, 180, 110, 90), ...luminanceTiles(png, 325, 180, 110, 90)]);
    const state = await page.evaluate(() => window.__drive.inspect());
    expect(state.graphics.samples).toBeGreaterThanOrEqual(2);
    expect(state.graphics.projectionMatches).toBe(true); expect(state.graphics.near).toBe(.2);
  }
  const changes = frames.slice(1).flatMap((frame, i) => frame.map((value, tile) => Math.abs(value - frames[i][tile])));
  console.log('moving pavement tile stability', JSON.stringify({ maxTileChange: Math.max(...changes) }));
  expect(Math.max(...changes)).toBeLessThan(.15);
  await page.keyboard.press('c');
  let mirrors = (await page.evaluate(() => window.__drive.inspect())).graphics.mirrorFrames;
  for (let i = 0; i < 2; i++) {
    await page.clock.runFor(17);
    const state = await page.evaluate(() => window.__drive.inspect());
    expect(state.graphics.projectionMatches).toBe(true); expect(state.graphics.near).toBe(.035);
    expect(state.graphics.mirrorFrames).toBeGreaterThan(mirrors); mirrors = state.graphics.mirrorFrames;
  }
  // Exercise live preset changes rather than reloading a new renderer for each one.
  await page.addStyleTag({ content: '.header{visibility:visible!important}' });
  for (const quality of ['medium', 'low', 'ultra']) {
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'AUDIO & GRAPHICS', exact: true }).click();
    await page.getByLabel('Graphics quality').selectOption(quality);
    await page.getByRole('button', { name: 'ALL SET' }).click(); await page.getByRole('button', { name: 'RESUME DRIVE' }).click();
    await page.clock.runFor(17);
    const state = await page.evaluate(() => window.__drive.inspect());
    expect(state.graphics.ao).toBe(quality === 'ultra');
    expect(state.roadReflection.visible).toBe(quality !== 'low');
    if (state.graphics.ao) expect(state.graphics.projectionMatches).toBe(true);
  }
  await page.screenshot({ path: 'test-results/stable-cockpit-ultra.png' });
  expect(errors).toEqual([]);
});
