import { test, expect } from '@playwright/test';
test('real traffic impacts preserve driving controls even at maximum body damage',async({page})=>{
 test.setTimeout(150000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:640,height:400});
 await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'low',density:'low',musicEnabled:false})));
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.goto('/?qa&seed=IMPACT');await page.getByRole('button',{name:'START DRIVE'}).click();
 await page.keyboard.down('w');
 let state=await page.evaluate(()=>window.__drive.inspect());
 // These impacts come entirely from held accelerator input and real seeded traffic.
 for(let i=0;i<30&&state.damage<100&&state.state==='playing';i++){
  await page.evaluate(()=>window.__drive.advance(2));state=await page.evaluate(()=>window.__drive.inspect());
 }
 expect(state.damage).toBe(100);expect(state.state).toBe('playing');
 await page.keyboard.down('a');await page.evaluate(()=>window.__drive.advance(.2));
 expect((await page.evaluate(()=>window.__drive.inspect())).steering).toBeLessThan(0);
 await page.keyboard.up('a');await page.keyboard.down('d');await page.evaluate(()=>window.__drive.advance(.35));
 expect((await page.evaluate(()=>window.__drive.inspect())).steering).toBeGreaterThan(0);
 await page.keyboard.up('d');await page.keyboard.up('w');
 // Brake long enough to leave room behind the struck car before testing acceleration.
 const before=await page.evaluate(()=>window.__drive.inspect());
 await page.keyboard.down('s');await page.evaluate(()=>window.__drive.advance(1.5));await page.keyboard.up('s');
 const slowed=await page.evaluate(()=>window.__drive.inspect());expect(slowed.speed).toBeLessThan(before.speed);
 await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(1));await page.keyboard.up('w');
 const after=await page.evaluate(()=>window.__drive.inspect());
 expect(after.speed).toBeGreaterThan(slowed.speed);expect(after.state).toBe('playing');expect(after.damage).toBe(100);
 expect(after.s).toBeGreaterThan(before.s);
 await page.clock.fastForward(100);await page.screenshot({path:'test-results/maximum-damage-driving.png'});
 expect(errors).toEqual([]);
});
