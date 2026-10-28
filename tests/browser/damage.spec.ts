import { startDrive } from './helpers';
import { test, expect } from '@playwright/test';

test('shield collection, expiry, a real frontal explosion and a clean restart', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=IMPACT'); await startDrive(page);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(6));
  const shielded = await page.evaluate(() => window.__drive.inspect());
  expect(shielded.shield).toBeGreaterThan(7); expect(shielded.damage).toBe(0);
  await expect(page.locator('#shield-status')).toContainText('DAMAGE PROTECTION');
  await page.clock.fastForward(17); await page.screenshot({ path: 'test-results/shield-pickup.png' });
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__drive.advance(3));
  expect((await page.evaluate(() => window.__drive.inspect())).shield).toBe(shielded.shield);
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click({ force: true }); await page.keyboard.down('w');
  await page.evaluate(() => window.__drive.advance(45)); await page.keyboard.up('w');
  const crashed = await page.evaluate(() => window.__drive.inspect());
  expect(crashed.shield).toBe(0); expect(crashed.exploded).toBe(true); expect(crashed.damage).toBe(100);
  expect(crashed.state).toBe('over'); expect(crashed.speed).toBe(0);
  await page.clock.fastForward(250); await page.screenshot({ path: 'test-results/frontal-explosion.png' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await page.evaluate(() => window.__drive.inspect())).graphics.effectsReady).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('chillwave-drive:record:v1'))).toBeNull();
  await page.clock.fastForward(3000);
  expect((await page.evaluate(() => window.__drive.inspect())).graphics.explosion.smoke).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(1100);
  expect((await page.evaluate(() => window.__drive.inspect())).graphics.explosion.smoke).toBe(false);
  await expect(page.getByRole('dialog')).toContainText('CAR DESTROYED');
  const panel = await page.getByRole('dialog').boundingBox();
  expect(Math.abs(panel!.x + panel!.width / 2 - 400)).toBeLessThan(2);
  expect(Math.abs(panel!.y + panel!.height / 2 - 250)).toBeLessThan(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chillwave-drive:record:v1')!).runs)).toBe(1);
  const stoppedAt = crashed.s; await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(2));
  expect((await page.evaluate(() => window.__drive.inspect())).s).toBe(stoppedAt);
  await page.keyboard.up('w'); await page.keyboard.press('r');
  const fresh = await page.evaluate(() => window.__drive.inspect());
  expect(fresh.state).toBe('playing'); expect(fresh.exploded).toBe(false);
  expect(fresh.shield).toBe(0); expect(fresh.turbo).toBe(0); expect(fresh.damage).toBe(0);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(6)); await page.keyboard.up('w');
  expect((await page.evaluate(() => window.__drive.inspect())).shield).toBeGreaterThan(7);
  expect(errors).toEqual([]);
});

test('steering into an amber pickup activates turbo and its flame ribbons', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=IMPACT'); await startDrive(page);
  await page.keyboard.down('w'); await page.evaluate(() => window.__drive.advance(7));
  // Feedback steering sends ordinary keyboard events through the real input handler.
  const powered = await page.evaluate(() => {
    let held = '';
    for (let i = 0; i < 90; i++) {
      const state = window.__drive.inspect();
      if (state.turbo > 0 || state.state !== 'playing') break;
      const correction = (10.1 - state.x) * .7 - state.yaw * 15;
      const key = correction > .04 ? 'KeyD' : correction < -.04 ? 'KeyA' : '';
      if (key !== held) {
        if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held }));
        if (key) window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
        held = key;
      }
      window.__drive.advance(.1);
    }
    if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held }));
    return window.__drive.inspect();
  });
  expect(powered.turbo).toBeGreaterThan(5); await expect(page.locator('#turbo-status')).toContainText('HOLD W');
  // Measure immediately after collection, before later traffic can affect speed.
  await page.evaluate(() => window.__drive.advance(.2)); await page.clock.fastForward(17);
  const boosted = await page.evaluate(() => window.__drive.inspect());
  expect(boosted.speed).toBeGreaterThan(powered.speed + 1); expect(boosted.boost.visible).toBe(true);
  await page.screenshot({ path: 'test-results/turbo-pickup.png' }); await page.keyboard.up('w');
  expect(errors).toEqual([]);
});

test('median openings appear on the map and close on the simulation timer', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: false })));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=MEDIAN'); await startDrive(page);
  const openPixels = () => page.evaluate(() => {
    const canvas = document.getElementById('minimap') as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 140 && data[i + 1] > 220 && data[i + 2] > 170) count++;
    return count;
  });
  await page.evaluate(() => window.__drive.advance(2)); expect(await openPixels()).toBeGreaterThan(40);
  await page.evaluate(() => window.__drive.advance(16)); expect(await openPixels()).toBe(0);
  expect((await page.evaluate(() => window.__drive.inspect())).state).toBe('playing');
});
