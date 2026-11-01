import {test,expect} from '@playwright/test';
import {startDrive} from './helpers';
import {patchDifference,projectedSamples} from '../helpers/png-luminance';

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


for(const view of ['chase','cockpit'] as const)test(`window surfaces remain steady during actual driving (${view})`,async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(view=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'high',density:'low',musicEnabled:false,view})),view);
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=WINDOWS');await startDrive(page);
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade,.radio-card{visibility:hidden!important}'});
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(4));
  const histories=new Map<string,number[]>();let differences:number[]=[];const records:{change:number;id:string;frame:number;point:number[];previous:number[];current:number[]}[]=[];
  for(let i=0;i<14;i++) {
    await page.clock.runFor(17);
    const probes=await page.evaluate(()=>window.__drive.windowProbes());
    const png=await page.locator('#world').screenshot({path:`test-results/window-drive-${view}-${i}.png`});
    for(const pane of probes) {
      const values=projectedSamples(png,pane.points),previous=histories.get(pane.id);
      if(previous){
        const change=values.reduce((sum,v,j)=>sum+Math.abs(v-previous[j]),0)/values.length;differences.push(change);
        const at=values.reduce((best,v,j)=>Math.abs(v-previous[j])>Math.abs(values[best]-previous[best])?j:best,0),sample=Math.floor(at/3);
        records.push({change,id:pane.id,frame:i,point:pane.points[sample],previous:previous.slice(sample*3,sample*3+3),current:values.slice(sample*3,sample*3+3)});
      }
      histories.set(pane.id,values);
    }
  }
  await page.keyboard.up('w');differences.sort((a,b)=>a-b);
  const p90=differences[Math.floor(differences.length*.9)],worst=differences.at(-1);
  console.log('actual driving window stability',{view,samples:differences.length,p90,worst});
  if(p90>=.035)console.log('unstable window samples',JSON.stringify(records.sort((a,b)=>b.change-a.change).slice(0,5)));
  expect(differences.length).toBeGreaterThan(30);expect(p90).toBeLessThan(.035);expect(errors).toEqual([]);
});


test('windows and neon signs keep steady brightness as simulation time advances',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:800,height:500});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa&seed=STEADY');await startDrive(page);
  await page.addStyleTag({content:'#hud,.header,#toast,.screen-shade,.radio-card{visibility:hidden!important}'});
  let reference:Buffer|undefined;
  for(const seconds of [0,.09,.21,.57,1.31,3.27,6.49]) {
    await page.evaluate(seconds=>window.__drive.advance(seconds),seconds);
    await page.evaluate(()=>window.__drive.previewCity(1160,false,1160,{district:true}));
    const png=await page.locator('#world').screenshot({path:`test-results/steady-city-${seconds}.png`});
    if(reference) {
      const difference=patchDifference(reference,png,20,60,760,250);
      console.log('city lighting over time',{seconds,difference});expect(difference).toBeLessThan(.001);
    }else reference=png;
  }
  expect(errors).toEqual([]);
});
