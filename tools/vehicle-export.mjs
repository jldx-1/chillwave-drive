/** Rebuild the checked-in runtime GLBs from local source models and original offline meshes. */
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.VEHICLE_EXPORT_PORT??4175);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port);break;}catch{await new Promise(r=>setTimeout(r,250));}}
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('console',m=>{if(m.type()==='error')console.error(m.text());});page.on('pageerror',e=>console.error(e));
 await page.goto('http://127.0.0.1:'+port+'/tools/vehicle-export.html');await page.waitForFunction(()=>typeof window.produceVehicles==='function');await page.waitForTimeout(3000);
 const paths={sedan:'traffic/sedan',suv:'traffic/suv',pickup:'traffic/pickup-truck',hatchback:'traffic/hatchback',sport:'traffic/sports-coupe',truck:'traffic/box-truck',police:'police/police-suv',player:'player/sports-car'};
 const audit={generatedBy:'tools/vehicle-export.mjs',frame:'metres, +Y up, -Z forward, road Y=0',files:{}};
 await page.exposeFunction('writeVehicleAsset',async({key,base64,stats})=>{const kind=key.replace(/-lod[12]$/,''),suffix=key.slice(kind.length),path='public/assets/vehicles/'+paths[kind]+suffix+'.glb',bytes=Buffer.from(base64,'base64');await writeFile(new URL('../'+path,import.meta.url),bytes);audit.files[key]={path:path.replace('public/',''),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...stats};console.log(key,bytes.length,Math.round(stats.triangles),stats.length.toFixed(2),stats.width.toFixed(2));});
 await page.evaluate(async()=>window.produceVehicles());
 await writeFile(new URL('../public/assets/vehicles/geometry-audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
 execFileSync(process.execPath,['tools/vehicle-colliders.mjs'],{cwd:root,stdio:'inherit'});
}finally {await browser?.close();server.kill();}
