import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';
import {patchDifference} from '../helpers/png-luminance';

test('window interiors stay stable under subpixel camera movement',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=WINDOWS');await startDrive(page);
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade{visibility:hidden!important}'});
  for(const distance of [1160,2960,4760]) {
    await page.evaluate(s=>window.__drive.previewCity(s,false,s,{district:true}),distance);
    const a=await page.locator('#world').screenshot({path:`test-results/windows-${distance}.png`});
    await page.evaluate(s=>window.__drive.previewCity(s,false,s,{district:true,offsetX:.001}),distance);
    const b=await page.locator('#world').screenshot();
    const difference=patchDifference(a,b,30,90,740,170);
    console.log('window subpixel stability',{distance,difference});
    expect(difference).toBeLessThan(.004);
  }
  expect(errors).toEqual([]);
});
