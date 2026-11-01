import * as THREE from 'three';
import type {CityMaterials} from './world-materials';

export interface MaterialSpec {basic:boolean;facade:boolean;castShadow:boolean}
export interface MaterialSchema {fields:Record<string,string|string[]|number[][]>;specs:Record<string,MaterialSpec>}
export interface PackedChunk {
  name:string;userData:Record<string,unknown>;position:number[];quaternion:number[];scale:number[];
  castShadow:boolean;receiveShadow:boolean;renderOrder:number;visible:boolean;
  geometry?:{attributes:Record<string,{array:THREE.TypedArray;itemSize:number;normalized:boolean}>;index:THREE.TypedArray|null};
  material?:string|{color:number[];opacity:number;transparent:boolean;depthWrite:boolean;toneMapped:boolean;side:THREE.Side};
  children:PackedChunk[];
}
export function describeChunkMaterials(materials:CityMaterials,asphalt:THREE.Material) {
  const schema:MaterialSchema={fields:{},specs:{}},byKey=new Map<string,THREE.Material>(),byMaterial=new Map<THREE.Material,string>();
  const add=(key:string,m:THREE.Material)=>{
    byKey.set(key,m);byMaterial.set(m,key);schema.specs[key]={basic:m instanceof THREE.MeshBasicMaterial,facade:!!m.userData.facade,castShadow:m.userData.castShadow!==false};return key;
  };
  for(const [key,value] of Object.entries(materials)) {
    if(value instanceof THREE.Material)schema.fields[key]=add(key,value);
    else if(Array.isArray(value)&&value.every(v=>v instanceof THREE.Material))schema.fields[key]=value.map((m,i)=>add(key+':'+i,m));
    else if(Array.isArray(value)&&value.every(v=>Array.isArray(v)))schema.fields[key]=value;
  }
  add('$asphalt',asphalt);return {schema,byKey,byMaterial};
}
/** Workers use material identities and geometry flags only; textures stay on the rendering thread. */
export function buildChunkMaterialPlaceholders(schema:MaterialSchema) {
  const byKey=new Map<string,THREE.Material>(),byMaterial=new Map<THREE.Material,string>();
  for(const [key,spec] of Object.entries(schema.specs)) {
    const material=spec.basic?new THREE.MeshBasicMaterial():new THREE.MeshStandardMaterial();
    material.userData.facade=spec.facade;material.userData.castShadow=spec.castShadow;
    byKey.set(key,material);byMaterial.set(material,key);
  }
  const fields=Object.fromEntries(Object.entries(schema.fields).map(([key,value])=>[key,typeof value==='string'?byKey.get(value):value.length&&typeof value[0]==='string'?(value as string[]).map(k=>byKey.get(k)):value]));
  return {materials:fields as unknown as CityMaterials,asphalt:byKey.get('$asphalt')!,byMaterial};
}
export function packChunk(object:THREE.Object3D,materials:Map<THREE.Material,string>):PackedChunk {
  const node:PackedChunk={name:object.name,userData:object.userData,position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),castShadow:object.castShadow,receiveShadow:object.receiveShadow,renderOrder:object.renderOrder,visible:object.visible,children:object.children.map(child=>packChunk(child,materials))};
  if(object instanceof THREE.Mesh) {
    node.geometry={attributes:Object.fromEntries(Object.entries(object.geometry.attributes as Record<string,THREE.BufferAttribute>).map(([key,attribute])=>[key,{array:attribute.array,itemSize:attribute.itemSize,normalized:attribute.normalized}])),index:object.geometry.index?.array??null};
    const material=object.material as THREE.MeshBasicMaterial,key=materials.get(material);
    if(key)node.material=key;
    else node.material={color:material.color.toArray(),opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,toneMapped:material.toneMapped,side:material.side};
  }
  return node;
}
export function chunkTransfers(node:PackedChunk,result:Transferable[]=[]):Transferable[] {
  if(node.geometry){for(const value of Object.values(node.geometry.attributes))result.push(value.array.buffer as ArrayBuffer);if(node.geometry.index)result.push(node.geometry.index.buffer as ArrayBuffer);}
  node.children.forEach(child=>chunkTransfers(child,result));return result;
}
export function unpackChunk(node:PackedChunk,materials:Map<string,THREE.Material>):THREE.Group {
  const hydrate=(data:PackedChunk):THREE.Object3D=>{
    let object:THREE.Object3D;
    if(data.geometry&&data.material) {
      const geometry=new THREE.BufferGeometry();
      for(const [name,attribute] of Object.entries(data.geometry.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
      if(data.geometry.index)geometry.setIndex(new THREE.BufferAttribute(data.geometry.index,1));
      let material:THREE.Material;
      if(typeof data.material==='string')material=materials.get(data.material)!;
      else {const spec=data.material;material=new THREE.MeshBasicMaterial({...spec,color:new THREE.Color().fromArray(spec.color)});}
      object=new THREE.Mesh(geometry,material);
    }else object=new THREE.Group();
    object.name=data.name;object.userData=data.userData;object.position.fromArray(data.position);object.quaternion.fromArray(data.quaternion);object.scale.fromArray(data.scale);
    object.castShadow=data.castShadow;object.receiveShadow=data.receiveShadow;object.renderOrder=data.renderOrder;object.visible=data.visible;
    data.children.forEach(child=>object.add(hydrate(child)));return object;
  };
  return hydrate(node) as THREE.Group;
}
