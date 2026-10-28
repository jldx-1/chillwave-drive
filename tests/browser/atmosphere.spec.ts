import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';
import {imageDifference,patchLuminance} from '../helpers/png-luminance';

test('mist conceals chunk and origin boundaries in both directions with the sunset fixed ahead',async({page})=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'high',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SUNSET');await startDrive(page);await page.clock.runFor(17);
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade{visibility:hidden!important}'});
  for(const rear of [false,true])for(const distance of [120,1000]) {
    const before=await page.evaluate(({rear,distance})=>window.__drive.previewCity(distance,rear,distance-.01),{rear,distance});
    // Repeat once so reflection/shadow buffers use exactly the same static camera for the comparison.
    await page.evaluate(({rear,distance})=>window.__drive.previewCity(distance,rear,distance-.01),{rear,distance});
    const first=await page.locator('#world').screenshot({path:`test-results/mist-${rear?'rear':'front'}-${distance}-before.png`});
    const after=await page.evaluate(({rear,distance})=>window.__drive.previewCity(distance,rear,distance+.01),{rear,distance});
    const second=await page.locator('#world').screenshot({path:`test-results/mist-${rear?'rear':'front'}-${distance}-after.png`});
    const difference=imageDifference(first,second);console.log('mist boundary',JSON.stringify({rear,distance,difference}));
    expect(difference).toBeLessThan(.0015);
    expect(after.chunks).toBe(14);expect(after.atmosphere.fullyHiddenAt).toBe(680);expect(after.atmosphere.streamBehind).toBe(6);
    expect(after.atmosphere.sunsetVisible).toBe(true);expect(after.atmosphere.sunsetInView).toBe(!rear);
    if(!rear) {const x=Math.round((before.sunsetScreen[0]+1)*400),y=Math.round((1-before.sunsetScreen[1])*250);
      expect(patchLuminance(second,x-8,y-8,16,16)).toBeGreaterThan(.08);
    }
  }
  const visible=await page.evaluate(()=>window.__drive.previewCity(1000,false,1000,{sun:true}));
  const x=Math.round((visible.sunsetScreen[0]+1)*400),y=Math.round((1-visible.sunsetScreen[1])*250);
  const lit=patchLuminance(await page.locator('#world').screenshot(),x-8,y-8,16,16);
  await page.evaluate(()=>window.__drive.previewCity(1000,false,1000,{sun:false}));
  const unlit=patchLuminance(await page.locator('#world').screenshot(),x-8,y-8,16,16);
  expect(lit-unlit).toBeGreaterThan(.08);
  for(const occluder of [240,560,900,1600]) {
    await page.evaluate(occluder=>window.__drive.previewCity(1000,false,1000,{occluder,sun:true}),occluder);
    const on=patchLuminance(await page.locator('#world').screenshot({path:`test-results/sun-blocked-${occluder}.png`}),x-8,y-8,16,16);
    await page.evaluate(occluder=>window.__drive.previewCity(1000,false,1000,{occluder,sun:false}),occluder);
    const off=patchLuminance(await page.locator('#world').screenshot(),x-8,y-8,16,16);
    console.log('sun occlusion',JSON.stringify({occluder,on,off}));
    expect(Math.abs(on-off)).toBeLessThan(.002);
  }
  expect(errors).toEqual([]);
});
