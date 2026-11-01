import * as THREE from 'three';
import { shared } from './procedural-buildings/materials';

function constantAttribute(g: THREE.BufferGeometry, name: string, values: number[]): void {
  const data = new Float32Array(g.attributes.position.count * values.length);
  for (let i = 0; i < g.attributes.position.count; i++) data.set(values, i * values.length);
  g.setAttribute(name, new THREE.BufferAttribute(data, values.length));
}
/** Move per-piece uniforms to vertex attributes, allowing differently colored tubes to merge. */
function attributeMaterial(source: THREE.ShaderMaterial, fields: Record<string, string>): THREE.ShaderMaterial {
  const material = source.clone();
  let declarations = '', assignments = '';
  for (const [name, type] of Object.entries(fields)) {
    material.fragmentShader = material.fragmentShader.replace(`uniform ${type} ${name};`, `flat varying ${type} ${name};`);
    declarations += `attribute ${type} a_${name}; flat varying ${type} ${name};\n`;
    assignments += `${name} = a_${name};\n`;
    delete material.uniforms[name];
  }
  material.vertexShader = declarations + material.vertexShader.replace('void main() {', 'void main() {\n' + assignments);
  material.uniforms.uTime = shared.uTime; material.uniforms.uNeon = shared.uNeon;
  return material;
}
export class CityMaterialBatches {
  private neon?: THREE.ShaderMaterial;
  private sign?: THREE.ShaderMaterial;
  private surfaces=new Map<string,THREE.MeshStandardMaterial>();
  private basics=new Map<string,THREE.MeshBasicMaterial>();
  private regions = new Map<THREE.Texture, {x:number;y:number;size:number}>();
  readonly atlasPixels: number;
  constructor(source: THREE.Object3D) {
    const signs = new Map<THREE.Texture, THREE.ShaderMaterial>();
    source.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial && o.material.userData.cityStaticSign)
        signs.set(o.material.uniforms.map.value, o.material);
    });
    this.atlasPixels = 0;
    if (!signs.size) return;
    const cell = 256, columns = Math.ceil(Math.sqrt(signs.size)), size = columns * cell;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    let i = 0;
    for (const texture of signs.keys()) {
      const x = i % columns * cell, y = Math.floor(i / columns) * cell;
      // A gutter on every tile prevents neighboring text leaking through mipmaps.
      context.drawImage(texture.image, x + 4, y + 4, cell - 8, cell - 8);
      this.regions.set(texture, { x: (x + 4) / size, y: 1 - (y + cell - 4) / size, size: (cell - 8) / size });
      i++;
    }
    const atlas = new THREE.CanvasTexture(canvas); atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    const original = signs.values().next().value!;
    this.sign = attributeMaterial(original, { uIntensity: 'float', uCh: 'float' });
    this.sign.uniforms.map.value = atlas;
    this.atlasPixels = size * size;
  }
  material(source: THREE.Material, g: THREE.BufferGeometry): THREE.Material {
    if(source instanceof THREE.MeshStandardMaterial && source.userData.citySurface) {
      const options=source.userData.citySurface;
      const key=[options.pattern,source.side,source.envMapIntensity].join(':');
      constantAttribute(g,'aCityColor',source.color.toArray());
      constantAttribute(g,'aCityP0',[source.roughness,source.metalness,options.grime,options.bump]);
      constantAttribute(g,'aCityP1',[options.cell,options.vary]);
      let material=this.surfaces.get(key);
      if(!material) {
        material=source.clone();
        (material as THREE.MeshStandardMaterial & {defines:Record<string,number>}).defines={PATTERN:options.pattern};
        const compile=source.onBeforeCompile.bind(source);
        material.onBeforeCompile=(shader,renderer)=>{
          compile(shader,renderer);
          const declarations='flat varying vec3 vCityColor;flat varying vec4 vCityP0;flat varying vec2 vCityP1;\n';
          shader.vertexShader='attribute vec3 aCityColor;attribute vec4 aCityP0;attribute vec2 aCityP1;\n'+declarations+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('void main() {','void main() {vCityColor=aCityColor;vCityP0=aCityP0;vCityP1=aCityP1;');
          shader.fragmentShader=declarations+shader.fragmentShader;
          for(const [name,value] of Object.entries({uGrime:'vCityP0.z',uBumpS:'vCityP0.w',uCell:'vCityP1.x',uVary:'vCityP1.y'})) {
            shader.fragmentShader=shader.fragmentShader.replace(`uniform float ${name};`,'').replace(new RegExp('\\b'+name+'\\b','g'),value);
            delete shader.uniforms[name];
          }
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=vCityColor;');
          // Material chunks are expanded after onBeforeCompile.
          shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replace('roughness;','vCityP0.x;'))
            .replace('#include <metalnessmap_fragment>',THREE.ShaderChunk.metalnessmap_fragment.replace('metalness;','vCityP0.y;'));
        };
        material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-attributes';
        this.surfaces.set(key,material);
      }
      return material;
    }
    if(source instanceof THREE.MeshBasicMaterial && !source.map) {
      const key=[source.side,source.transparent,source.opacity,source.depthWrite,source.toneMapped].join(':');
      constantAttribute(g,'color',source.color.toArray());
      let material=this.basics.get(key);
      if(!material){material=source.clone();material.color.set(0xffffff);material.vertexColors=true;this.basics.set(key,material);}
      return material;
    }
    if (!(source instanceof THREE.ShaderMaterial)) return source;
    const u = source.uniforms;
    if (u.uChase) {
      this.neon ??= attributeMaterial(source, {uColor:'vec3',uIntensity:'float',uCh:'float',uChase:'float'});
      const color = u.uColor.value as THREE.Color;
      constantAttribute(g, 'a_uColor', [color.r,color.g,color.b]);
      for (const key of ['uIntensity','uCh','uChase']) constantAttribute(g, 'a_' + key, [u[key].value]);
      return this.neon;
    }
    const region = source.userData.cityStaticSign && this.regions.get(u.map.value);
    if (region && this.sign) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, region.x + uv.getX(i) * region.size, region.y + uv.getY(i) * region.size);
      constantAttribute(g, 'a_uIntensity', [u.uIntensity.value]);
      constantAttribute(g, 'a_uCh', [u.uCh.value]);
      return this.sign;
    }
    return source;
  }
}
