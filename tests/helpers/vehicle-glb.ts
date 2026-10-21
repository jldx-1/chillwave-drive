import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
export type AssetJson = {asset:{version:string};buffers?:{uri?:string}[];images?:{uri?:string}[];nodes:{name?:string;children?:number[];extras?:Record<string,unknown>}[];materials:{extras?:Record<string,unknown>;[key:string]:unknown}[];extensionsRequired?:string[];[key:string]:unknown};
export function binary(path:string){const bytes=readFileSync(new URL('../../public/'+path,import.meta.url));expect(bytes.readUInt32LE(0)).toBe(0x46546c67);expect(bytes.readUInt32LE(4)).toBe(2);expect(bytes.readUInt32LE(8)).toBe(bytes.length);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())as AssetJson;return{bytes,json};}
/** Node has no image decoder: retain all original geometry/BIN while omitting only texture references. */
export function geometryOnly(bytes:Buffer,json:AssetJson):ArrayBuffer{
 const clone=JSON.parse(JSON.stringify(json));delete clone.images;delete clone.textures;delete clone.samplers;
 const omitMaps=(value:unknown):void=>{if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(/Texture$/.test(key))delete(value as Record<string,unknown>)[key];else omitMaps(item);}};omitMaps(clone.materials);
 const text=Buffer.from(JSON.stringify(clone)),jsonSize=Math.ceil(text.length/4)*4,sourceJsonSize=bytes.readUInt32LE(12),bin=bytes.subarray(20+sourceJsonSize),out=Buffer.alloc(20+jsonSize+bin.length,0x20);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jsonSize,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);bin.copy(out,20+jsonSize);return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength)as ArrayBuffer;
}
