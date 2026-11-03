import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';

test('Potato persists, reduces rendering work and restores higher presets live',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:960,height:540});
  await page.addInitScript(()=>{if(!localStorage.getItem('chillwave-drive:settings:v1'))localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false}));});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=POTATO');await startDrive(page);await page.clock.runFor(34);
  const low=await page.evaluate(()=>window.__drive.inspect());
  const select=async(quality:string)=>{
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'AUDIO & GRAPHICS',exact:true}).click();
    await page.getByLabel('Graphics quality').selectOption(quality);await page.getByRole('button',{name:'ALL SET'}).click();await page.getByRole('button',{name:'RESUME DRIVE'}).click();
    await page.clock.runFor(34);return page.evaluate(()=>window.__drive.inspect());
  };
  const potato=await select('potato');
  expect(potato.resolution).toBe(.5);expect(potato.graphics).toMatchObject({quality:'potato',shadows:false,rainVertices:0,ao:false,cityLights:false,trafficLights:false,mirrorSize:[128,48]});
  expect(potato.roadReflection.visible).toBe(false);expect(potato.proceduralBuildings.detailBuildings).toBeLessThan(low.proceduralBuildings.detailBuildings);
  expect(potato.renderTriangles).toBeLessThan(low.renderTriangles);
  await page.keyboard.press('c');await page.clock.runFor(34);const mirrors=(await page.evaluate(()=>window.__drive.inspect())).graphics.mirrorFrames;
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(1));await page.keyboard.up('w');await page.clock.runFor(34);
  const driving=await page.evaluate(()=>window.__drive.inspect());expect(driving.s).toBeGreaterThan(0);expect(driving.graphics.mirrorFrames).toBeGreaterThan(mirrors);
  await page.screenshot({path:'test-results/potato-cockpit.png'});
  await page.reload();await startDrive(page);await page.clock.runFor(34);
  expect((await page.evaluate(()=>window.__drive.inspect())).graphics.quality).toBe('potato');
  const ultra=await select('ultra');expect(ultra.resolution).toBe(1);expect(ultra.graphics).toMatchObject({shadows:true,rainVertices:3600,ao:true,cityLights:true,trafficLights:true,mirrorSize:[512,192]});expect(ultra.roadReflection.visible).toBe(true);
  const restored=await select('low');expect(restored.graphics).toMatchObject({shadows:false,rainVertices:900,ao:false,cityLights:true,trafficLights:true,mirrorSize:[256,96]});expect(restored.resolution).toBe(1);
  expect(errors).toEqual([]);
});
