import { startDrive } from './helpers';
import { test, expect } from '@playwright/test';

test('phone controls support two thumbs, sliding steering, cancellation and rotation', async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const page = await context.newPage(); const errors:string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.goto('/?qa&seed=PHONE'); await startDrive(page, true);
  await page.clock.runFor(17);
  const initial = await page.evaluate(()=>window.__drive.inspect());
  expect(initial.graphics.quality).toBe('low'); expect(initial.resolution).toBe(1); expect(initial.graphics.effectsReady).toBe(true);
  const point = async (name:string) => {
    const box=await page.getByRole('button',{name,exact:true}).boundingBox(); expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    return {x:box!.x+box!.width/2,y:box!.y+box!.height/2};
  };
  const go=await point('Accelerate'),left=await point('Steer left'),right=await point('Steer right');
  await point('Brake'); await point('Handbrake'); await point('Change camera');
  await page.screenshot({path:'test-results/mobile-portrait-controls.png'});
  await page.locator('[data-key="KeyW"]').evaluate(button => {
    button.addEventListener('pointerdown', event => {
      const element=button as HTMLElement;
      element.dataset.pointers=(element.dataset.pointers??'')+','+String((event as PointerEvent).pointerId);
    });
  });
  const session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...go,id:1},{...left,id:2}]});
  await page.evaluate(()=>window.__drive.advance(.6));
  let state=await page.evaluate(()=>window.__drive.inspect());
  expect(state.controls.throttle).toBe(1);expect(state.controls.steer).toBeLessThan(-.5);expect(state.speed).toBeGreaterThan(2);
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...go,id:1},{...right,id:2}]});
  await page.evaluate(()=>window.__drive.advance(.3));state=await page.evaluate(()=>window.__drive.inspect());
  expect(state.controls.throttle).toBe(1);expect(state.controls.steer).toBeGreaterThan(.5);
  // CDP can end the whole touch sequence; dispatch the ordinary partial-release pointer event separately.
  const firstPointer=Number((await page.locator('[data-key="KeyW"]').getAttribute('data-pointers'))!.split(',').filter(Boolean)[0]);
  await page.locator('[data-key="KeyW"]').dispatchEvent('pointerup',{pointerId:firstPointer,pointerType:'touch'});
  expect((await page.evaluate(()=>window.__drive.inspect())).controls.throttle).toBe(0);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  expect((await page.evaluate(()=>window.__drive.inspect())).controls.steer).toBe(0);
  // Releasing one of two fingers on the same pedal must not release the remaining finger.
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:go.x-8,y:go.y,id:3},{x:go.x+8,y:go.y,id:4}]});
  const pointers=(await page.locator('[data-key="KeyW"]').getAttribute('data-pointers'))!.split(',').filter(Boolean).map(Number);
  await page.locator('[data-key="KeyW"]').dispatchEvent('pointerup',{pointerId:pointers[pointers.length-2],pointerType:'touch'});
  expect((await page.evaluate(()=>window.__drive.inspect())).controls.throttle).toBe(1);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect((await page.evaluate(()=>window.__drive.inspect())).controls.throttle).toBe(0);
  await page.setViewportSize({width:844,height:390});
  await point('Accelerate');await point('Steer left');await point('Steer right');await point('Brake');await point('Handbrake');
  for (const button of await page.locator('.touch-controls button').all()) await expect(button).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0)).toBe(true);
  await page.screenshot({path:'test-results/mobile-landscape-controls.png'});
  await context.close(); expect(errors).toEqual([]);
});

test('small landscape phones keep Start reachable without saved settings', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:667,height:375},hasTouch:true,isMobile:true});
  const page=await context.newPage();await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('/?qa');
  await expect(page.getByRole('button',{name:'START DRIVE'})).toBeInViewport();
  await startDrive(page, true);
  await expect(page.getByRole('button',{name:'Accelerate',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Steer left',exact:true})).toBeInViewport();
  await context.close();
});
