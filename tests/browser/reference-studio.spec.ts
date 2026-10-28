import {test,expect} from '@playwright/test';
import {patchLuminance} from '../helpers/png-luminance';
test('vehicle studio renders delivered GLBs, switches models and offers downloads',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1200,height:800});await page.goto('/vehicles.html');
  await expect(page.locator('#vehicle option')).toHaveCount(15);
  await expect(page.locator('#status')).toContainText('triangles');await expect(page.locator('#download')).toHaveAttribute('href',/nebula-lod0.glb$/);
  await page.locator('#lod').selectOption('player');await expect(page.locator('#download')).toHaveAttribute('href',/nebula-player.glb$/);
  const shot=await page.locator('canvas').screenshot({path:'test-results/studio-player.png'});expect(patchLuminance(shot,400,200,600,400)).toBeGreaterThan(.025);
  await page.locator('#vehicle').selectOption('vortex');await expect(page.locator('#download')).toHaveAttribute('href',/vortex-lod0.glb$/);await page.locator('[data-view=side]').click();await page.locator('canvas').screenshot({path:'test-results/studio-police.png'});
  for(const id of ['nova','pulse','orbit','titan']){await page.locator('#vehicle').selectOption(id);await expect(page.locator('#download')).toHaveAttribute('href',new RegExp(id+'-lod0.glb$'));await page.locator('[data-view=quarter]').click();await page.locator('canvas').screenshot({path:`test-results/studio-${id}.png`});}
  await page.locator('[data-view=bottom]').click();await expect(page.locator('#status')).toContainText('triangles');
  await page.locator('#lod').selectOption('2');await expect(page.locator('#download')).toHaveAttribute('href',/titan-lod2.glb$/);
  expect(errors).toEqual([]);
});
