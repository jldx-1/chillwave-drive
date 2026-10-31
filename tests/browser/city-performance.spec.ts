import { test, expect } from '@playwright/test';

for (const quality of ['medium','low'] as const) test(`city startup and steady frames (${quality})`, async ({page}) => {
  test.setTimeout(180000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize(quality==='low'?{width:390,height:844}:{width:960,height:540});
  await page.addInitScript(q=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:q,density:'low',musicEnabled:false})),quality);
  const started=Date.now();
  await page.goto('/?qa&seed=SUNSET');
  const start=page.getByRole('button',{name:'START DRIVE'});
  await expect(start).toBeEnabled({timeout:120000});
  const startupMs=Date.now()-started;
  await start.click();
  const frames=await page.evaluate(async()=>{
    const times:number[]=[];let previous=0;
    for(let i=0;i<100;i++){
      const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
      if(i>10)times.push(now-previous);previous=now;
    }
    times.sort((a,b)=>a-b);
    return {p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]};
  });
  const state=await page.evaluate(()=>window.__drive.inspect());
  console.log('CITY_PERFORMANCE',JSON.stringify({quality,startupMs,loading:state.loading,frames,buildings:state.proceduralBuildings,drawCalls:state.drawCalls,triangles:state.renderTriangles,geometries:state.geometries,textures:state.textures}));
  expect(state.proceduralBuildings.activeBuildings).toBeGreaterThan(0);
  expect(state.proceduralBuildings.drawBatches).toBeLessThan(330);
  if(quality==='low') {
    // Compact four-row blocks contain 320 buildings in this stream window (formerly 128).
    // Keep the denser scene bounded while retaining all frontage and per-camera culling.
    expect(state.renderTriangles).toBeLessThan(4000000);
    // Batched visibility uses two small data textures per batch; image textures retain their budget.
    expect(state.textures).toBeLessThan(state.graphics.cameraBatches*2+80);
    expect(state.proceduralBuildings.visibility.culledPieces).toBeGreaterThan(0);
    expect(state.proceduralBuildings.visibility.visibleBuildings).toBeLessThan(state.proceduralBuildings.activeBuildings);
  }
  await page.screenshot({path:`test-results/city-performance-${quality}.png`});
  expect(errors).toEqual([]);
});
