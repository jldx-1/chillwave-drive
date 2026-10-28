import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';
import {CYBER_MODEL_IDS,CYBER_VEHICLES} from '../../src/drive/cyber-vehicles';
import {patchLuminance} from '../helpers/png-luminance';

test('all fifteen futuristic prefabs render from front, rear, both sides and three-quarter on the wet expressway',async({page})=>{
  test.setTimeout(360000);await page.setViewportSize({width:720,height:450});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://i.ytimg.com/**',r=>r.fulfill({status:204}));
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'medium',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=SUNSET');await startDrive(page);await page.clock.runFor(17);
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade,.radio-card{visibility:hidden!important}'});
  const selected=process.env.CYBER_QA_MODEL?CYBER_MODEL_IDS.filter(id=>id===process.env.CYBER_QA_MODEL):CYBER_MODEL_IDS;expect(selected.length).toBeGreaterThan(0);
  for(const id of selected){
    for(const [name,angle]of [['rear',0],['front',Math.PI],['left',-Math.PI/2],['right',Math.PI/2],['quarter',.65]]as const){
      const state=await page.evaluate(({id,angle})=>window.__drive.previewFleet(id,angle),{id,angle});
      expect(state.wheels).toBe(CYBER_VEHICLES[id].axles.length*2);expect(state.lamps.head).toBeGreaterThan(0);expect(state.lamps.brake).toBeGreaterThan(0);
      const image=await page.locator('#world').screenshot({path:`test-results/fleet-${id}-${name}.png`});
      expect(patchLuminance(image,180,120,360,240),`${id}/${name}`).toBeGreaterThan(.009);
    }
    await page.evaluate(id=>window.__drive.previewFleet(id,.65,2),id);
    await page.locator('#world').screenshot({path:`test-results/fleet-${id}-distant.png`});
  }
  expect(errors).toEqual([]);
});
