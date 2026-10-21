/** Import a licensed replacement that already follows the canonical mesh contract. */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
const path=value('--file'),kind=value('--kind'),author=value('--author'),license=value('--license'),source=value('--source');
const paths={sedan:'traffic/sedan',suv:'traffic/suv',pickup:'traffic/pickup-truck',truck:'traffic/box-truck',hatchback:'traffic/hatchback',sport:'traffic/sports-coupe',police:'police/police-suv',player:'player/sports-car'};
if(!args.includes('--file')||!paths[kind]||!args.includes('--author')||!args.includes('--license')||!args.includes('--source'))throw new Error('Usage: node tools/vehicle-import.mjs --kind sedan --file /path/model.glb --author "Author" --license CC-BY-4.0 --source https://source.example/model');
const bytes=await readFile(path);if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Expected a complete glTF 2.0 binary');
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const wheelNames=['Wheel_FL','Wheel_RL','Wheel_FR','Wheel_RR'];for(const name of wheelNames){const wheel=gltf.nodes?.find(n=>n.name===name);if(!wheel||!wheel.children?.some(i=>/^Spin(?:_\d+)?$/.test(gltf.nodes[i].name??'')))throw new Error('Model must have canonical '+name+' with child Spin. Normalize in Blender or tools/vehicle-author.ts before import.');}
if(gltf.buffers?.some(b=>b.uri)||gltf.images?.some(i=>i.uri))throw new Error('Replacement must embed geometry and textures.');
const roles=new Set(gltf.materials?.map(m=>m.extras?.vehicleRole));for(const role of ['paint','glass','tire','head','brake','turn'])if(!roles.has(role))throw new Error('Missing material extras.vehicleRole '+role);
if(kind==='police')for(const role of['red','blue'])if(!roles.has(role))throw new Error('Police asset is missing '+role+' lamp role');
const destination=new URL('../public/assets/vehicles/'+paths[kind]+'.glb',import.meta.url);await writeFile(destination,bytes);
const auditURL=new URL('../public/assets/vehicles/imports.json',import.meta.url);let audit={};try{audit=JSON.parse(await readFile(auditURL,'utf8'));}catch{}
audit[kind]={author,license,source,path:destination.pathname.split('/public/')[1],sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,notice:'Replacement imported from an explicitly attributed local asset. Update geometry-audit/catalog dimensions and matching LODs before shipping.'};await writeFile(auditURL,JSON.stringify(audit,null,2)+'\n');
console.log('Imported '+kind+'. Verify catalog dimensions, LOD art and license notice before deployment.');
