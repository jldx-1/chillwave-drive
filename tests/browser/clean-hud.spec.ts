import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';

test('driving view keeps speed, distance, navigation and top controls without extra panels', async ({page})=>{
  await page.setViewportSize({width:960,height:600});await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=HUD');await startDrive(page);
  for(const selector of ['.distance-block','.speedometer','.navigation','.radio-card','#pause-button'])await expect(page.locator(selector)).toBeVisible();
  for(const selector of ['.drive-score','.powerups','.pursuit','.vehicle-health'])await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('.brand')).toBeHidden();await page.clock.runFor(17);await page.screenshot({path:'test-results/clean-hud.png'});
});

test('phone retains its driving controls and minimap', async ({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=HUD');await startDrive(page,true);
  for(const selector of ['.speedometer','.distance-block','.navigation','[aria-label="Accelerate"]','[aria-label="Steer left"]'])await expect(page.locator(selector)).toBeVisible();
  await page.clock.runFor(17);await page.screenshot({path:'test-results/clean-hud-phone.png'});await context.close();
});
