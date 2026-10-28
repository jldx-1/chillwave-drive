import { expect, type Page } from '@playwright/test';

/** The test clock pauses animation; shader preparation still needs its short loading timers. */
export async function waitForDrive(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: 'START DRIVE' });
  if (await start.isEnabled()) return;
  await expect.poll(() => page.evaluate(() => {
    const state = window.__drive?.inspect(); return !!state?.modelReady && !!state?.hdrReady;
  }), { timeout: 30000 }).toBe(true);
  await expect.poll(async () => {
    await page.clock.fastForward(12);
    return start.isEnabled();
  }, { timeout: 60000, intervals: [50,100] }).toBe(true);
}

export async function startDrive(page: Page, touch = false): Promise<void> {
  await waitForDrive(page);
  const start = page.getByRole('button', { name: 'START DRIVE' });
  if (touch) await start.tap(); else await start.click();
}
