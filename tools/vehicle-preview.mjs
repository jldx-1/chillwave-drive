/** Capture the actual delivered GLBs in a neutral local showroom for art review. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.VEHICLE_EXPORT_PORT??4175),output=process.env.VEHICLE_REVIEW_DIR??'/tmp/chillwave-vehicle-review';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port);break;}catch{await new Promise(r=>setTimeout(r,250));}}
 await mkdir(output,{recursive:true});browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const paths={sedan:'traffic/sedan',suv:'traffic/suv',pickup:'traffic/pickup-truck',hatchback:'traffic/hatchback',sport:'traffic/sports-coupe',truck:'traffic/box-truck',police:'police/police-suv',player:'player/sports-car'};
 const selected=process.env.VEHICLE_REVIEW_KINDS?.split(',');
 for(const[kind,path]of Object.entries(paths).filter(([kind])=>!selected||selected.includes(kind))){
  const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto('http://127.0.0.1:'+port+'/tools/vehicle-export.html');await page.waitForTimeout(2000);const stats=await page.evaluate(async({path})=>{const{reviewVehicle}=await import('/tools/vehicle-review.ts');return reviewVehicle('/assets/vehicles/'+path+'.glb');},{path});await page.screenshot({path:output+'/'+kind+'-front.png'});console.log(kind,stats);await page.close();
 }
}finally{await browser?.close();server.kill();}
