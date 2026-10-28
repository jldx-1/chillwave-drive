import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
declare global {interface Window {SirenPreview:typeof import('../../src/drive/cyber-siren')}}
test('the real spatial siren renders smooth layered audio without clipping or gaps',async({page})=>{
  const script=await build({entryPoints:['src/drive/cyber-siren.ts'],bundle:true,format:'iife',globalName:'SirenPreview',write:false});
  await page.addScriptTag({content:script.outputFiles[0].text});
  const data=await page.evaluate(async()=>{
    const rate=24000,context=new OfflineAudioContext(1,rate*6,rate),voice=new window.SirenPreview.CyberSiren(context,context.destination);
    for(let frame=0;frame<360;frame++){const time=frame/60;voice.update(time,0,time>=3,0,-8,time);}
    const buffer=await context.startRendering(),samples=buffer.getChannelData(0);let peak=0,jump=0;
    const levels=[];for(let start=0;start<samples.length;start+=rate/4){let sum=0;for(let i=start;i<start+rate/4;i++){peak=Math.max(peak,Math.abs(samples[i]));if(i)jump=Math.max(jump,Math.abs(samples[i]-samples[i-1]));sum+=samples[i]*samples[i];}levels.push(Math.sqrt(sum/(rate/4)));}
    voice.dispose();voice.dispose();return {rate,samples:Array.from(samples),levels,peak,jump};
  });
  expect(data.peak).toBeLessThan(.18);expect(data.peak).toBeGreaterThan(.03);expect(data.jump).toBeLessThan(.04);
  expect(data.levels.every(level=>level>.01&&level<.08)).toBe(true);
  console.log('cyber siren audio',JSON.stringify({peak:data.peak,jump:data.jump,rms:data.levels}));
  const wav=Buffer.alloc(44+data.samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(data.rate,24);wav.writeUInt32LE(data.rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  data.samples.forEach((sample,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),44+i*2));
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/cyber-police-siren.wav',wav);
});
