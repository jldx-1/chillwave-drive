/** Reproducible GLB delivery of the exact source prefabs used by the game. No server/network. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const root=fileURLToPath(new URL('../',import.meta.url));
// GLTFExporter uses FileReader for its binary Blob; Node already supplies Blob.
globalThis.FileReader=class {
  result=null; onloadend=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result=`data:${blob.type};base64,${Buffer.from(data).toString('base64')}`;this.onloadend?.();});}
};
const compiled=await build({stdin:{contents:"export * from './src/drive/cyber-prefabs.ts';export * from './src/drive/cyber-vehicles.ts';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {cyberPrefab,cyberPlayerPrefab,CYBER_MODEL_IDS,CYBER_VEHICLES}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const output=new URL('../public/models/cyber/',import.meta.url);await mkdir(output,{recursive:true});
const manifest={version:2,frame:'metres, +Y up, -Z forward, road Y=0',source:'src/drive/reference-coachwork.ts',models:[]};
const exporter=new GLTFExporter();
async function deliver(id,lod,model){
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);let vertices=0,triangles=0,meshes=0;const wheels=[];
  model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}if(o.userData.vehicleWheel)wheels.push(o.name);});
  const data=Buffer.from(await exporter.parseAsync(model,{binary:true,onlyVisible:false}));
  const file=`${id}${lod==='player'?'-player':`-lod${lod}`}.glb`;await writeFile(new URL(file,output),data);
  manifest.models.push({id,lod,file,name:model.name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),vertices,triangles,meshes,wheels,bounds:{min:box.min.toArray(),max:box.max.toArray()},collision:CYBER_VEHICLES[id]&&{length:CYBER_VEHICLES[id].length,width:CYBER_VEHICLES[id].width,height:CYBER_VEHICLES[id].height,mass:CYBER_VEHICLES[id].mass}});
  console.log(`${file}: ${triangles} triangles, ${Math.round(data.length/1024)} KiB`);
}
for(const id of CYBER_MODEL_IDS)for(const lod of [0,1,2])await deliver(id,lod,cyberPrefab(id,lod));
await deliver('nebula','player',cyberPlayerPrefab());
await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');
