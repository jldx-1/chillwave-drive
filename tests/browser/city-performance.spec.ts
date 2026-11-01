import { test, expect } from '@playwright/test';

for (const quality of ['ultra','high','medium','low'] as const) test(`city startup and steady frames (${quality})`, async ({page}) => {
  test.setTimeout(180000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize(quality==='low'?{width:390,height:844}:quality==='medium'?{width:960,height:540}:{width:2560,height:1440});
  await page.addInitScript(q=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:q,density:'low',musicEnabled:false})),quality);
  const started=Date.now();
  await page.goto('/?qa&seed=SUNSET');
  const start=page.getByRole('button',{name:'START DRIVE'});
  await expect(start).toBeEnabled({timeout:120000});
  const startupMs=Date.now()-started;
  await start.click();
  const frames=await page.evaluate(async()=>{
    const times:number[]=[];let previous=0;
    for(let i=0;i<160;i++){
      const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
      if(i>50)times.push(now-previous);previous=now;
    }
    times.sort((a,b)=>a-b);
    return {p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]};
  });
  const state=await page.evaluate(()=>window.__drive.inspect());
  console.log('CITY_PERFORMANCE',JSON.stringify({quality,startupMs,loading:state.loading,streaming:state.streaming,frames,timing:state.performance,buildings:state.proceduralBuildings,infrastructure:state.infrastructure,drawCalls:state.drawCalls,triangles:state.renderTriangles,geometries:state.geometries,textures:state.textures}));
  expect(state.proceduralBuildings.activeBuildings).toBeGreaterThan(0);
  expect(state.streaming.worker).toBe(true);expect(state.streaming.error).toBeUndefined();
  expect(state.proceduralBuildings.drawBatches).toBeLessThan(330);
  if(quality==='low') {
    // Compact four-row blocks contain 320 buildings in this stream window (formerly 128).
    // Keep the denser scene bounded while retaining all frontage and per-camera culling.
    // Merging compatible materials widens conservative bounds slightly, trading <7% extra
    // triangles for fewer draw calls while retaining the exact source geometry.
    expect(state.renderTriangles).toBeLessThan(4100000);
    // Batched visibility uses two small data textures per batch; image textures retain their budget.
    expect(state.textures).toBeLessThan(80+state.infrastructure.batches*2);
    expect(state.proceduralBuildings.visibility.culledPieces).toBeGreaterThan(0);
    expect(state.proceduralBuildings.visibility.visibleBuildings).toBeLessThan(state.proceduralBuildings.activeBuildings);
  }
  await page.screenshot({path:`test-results/city-performance-${quality}.png`});
  expect(errors).toEqual([]);
});


test('1440p Ultra sustains driving through streamed city boundaries',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:2560,height:1440});
  await page.addInitScript(()=>localStorage.setItem('chillwave-drive:settings:v1',JSON.stringify({quality:'ultra',density:'normal',musicEnabled:false})));
  await page.goto('/?qa&seed=PERFORMANCE');const start=page.getByRole('button',{name:'START DRIVE'});await expect(start).toBeEnabled({timeout:120000});await start.click();
  await page.keyboard.down('w');
  const frames=await page.evaluate(async()=>{
    const samples:number[]=[];let previous=0;
    for(let i=0;i<660;i++) {
      const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
      if(i>60)samples.push(now-previous);previous=now;
    }
    samples.sort((a,b)=>a-b);
    return {p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],missed:samples.filter(v=>v>25).length/samples.length};
  });
  await page.keyboard.up('w');const state=await page.evaluate(()=>window.__drive.inspect());
  console.log('ULTRA_DRIVING',JSON.stringify({frames,distance:state.s,streaming:state.streaming,timing:state.performance,draws:state.drawCalls,triangles:state.renderTriangles}));
  expect(state.state).toBe('playing');expect(state.s).toBeGreaterThan(240);
  expect(state.streaming.worker).toBe(true);expect(state.streaming.hits).toBeGreaterThanOrEqual(2);expect(state.streaming.synchronous).toBe(14);
  expect(state.streaming.ready).toBeLessThanOrEqual(4);expect(errors).toEqual([]);
  // This timing target is for the user's verified hardware; software-GPU CI still runs functional checks.
  if(state.performance.renderer.includes('RTX 4070 Ti')){expect(frames.p95).toBeLessThan(20);expect(frames.missed).toBeLessThan(.02);}
  await page.screenshot({path:'test-results/ultra-1440p-driving.png'});
});
