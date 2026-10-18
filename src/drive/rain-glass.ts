import * as THREE from 'three';
import type { PlayerCarRig } from './car-asset';
import { GLASS, WaterFilm, type BladeSegment } from './weather';

/** A water-height texture on the real windshield. The car itself occludes it; HUD stays clear. */
export class RainGlass {
  private readonly film = new WaterFilm();
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private redraw = 1;
  private readonly blades: { pivot: THREE.Group; a: THREE.Vector3; b: THREE.Vector3 }[];
  constructor(private readonly rig: PlayerCarRig) {
    this.canvas.width = 512; this.canvas.height = 288;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    this.blades = rig.wipers.map(pivot => {
      const blade = pivot.children.find(o => /GEO_Wiper[25]/.test(o.name)) as THREE.Mesh;
      blade.geometry.computeBoundingBox();
      const bounds = blade.geometry.boundingBox!, center = bounds.getCenter(new THREE.Vector3());
      return { pivot, a: new THREE.Vector3(bounds.min.x, center.y, center.z), b: new THREE.Vector3(bounds.max.x, center.y, center.z) };
    });
    for (const material of rig.windows) {
      material.onBeforeCompile = shader => {
        shader.uniforms.windshieldWater = { value: this.texture };
        shader.uniforms.carScale = { value: rig.scale };
        shader.vertexShader = `varying vec3 glassLocal; varying vec3 glassRight; varying vec3 glassUp; varying float glassFacing;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            glassLocal=position;glassFacing=abs(normal.y);glassRight=normalize(normalMatrix*vec3(1.,0.,0.));glassUp=normalize(normalMatrix*vec3(0.,${GLASS.upY},${GLASS.upZ}));`);
        shader.fragmentShader = `varying vec3 glassLocal; varying vec3 glassRight; varying vec3 glassUp; varying float glassFacing;
          uniform sampler2D windshieldWater; uniform float carScale; vec2 waterSlope; float waterHeight;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 localGlass=glassLocal/carScale;
          vec2 waterUV=vec2(localGlass.x/${GLASS.width}+.5,((localGlass.y-${GLASS.baseY})*${GLASS.upY}+(localGlass.z-(${GLASS.baseZ}))*${GLASS.upZ})/${GLASS.height});
          float onWindshield=step(.65,glassFacing)*(1.-step(-.12,localGlass.z))*step(0.,waterUV.y)*step(waterUV.y,1.);
          waterHeight=texture2D(windshieldWater,waterUV).r*onWindshield;
          waterSlope=vec2(texture2D(windshieldWater,waterUV+vec2(1./512.,0.)).r-texture2D(windshieldWater,waterUV-vec2(1./512.,0.)).r,
            texture2D(windshieldWater,waterUV+vec2(0.,1./288.)).r-texture2D(windshieldWater,waterUV-vec2(0.,1./288.)).r)*onWindshield;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.41,.49),waterHeight*.35);
          diffuseColor.a=min(.82,diffuseColor.a+waterHeight*.65);
          totalEmissiveRadiance+=vec3(.32,.38,.44)*max(0.,waterSlope.y-waterSlope.x*.5);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal=normalize(normal-(glassRight*waterSlope.x+glassUp*waterSlope.y)*.65);
          roughnessFactor=mix(roughnessFactor,.025,waterHeight);
        `);
      };
      material.needsUpdate = true;
    }
  }
  reset(): void { this.film.reset(); this.redraw = 1; }
  private project(p: THREE.Vector3): { x: number; y: number } {
    const v = p.clone().divideScalar(this.rig.scale);
    return { x: v.x, y: (v.y - GLASS.baseY) * GLASS.upY + (v.z - GLASS.baseZ) * GLASS.upZ };
  }
  update(dt: number, speed: number, sheltered: boolean, reduced: boolean): void {
    const segments: BladeSegment[] = this.blades.map(b => {
      b.pivot.updateMatrix();
      return { a: this.project(b.a.clone().applyMatrix4(b.pivot.matrix)), b: this.project(b.b.clone().applyMatrix4(b.pivot.matrix)) };
    });
    this.film.update(dt, speed, segments, sheltered, reduced); this.redraw += dt;
    if (this.redraw < 1 / 30) return;
    this.redraw = 0;
    const ctx = this.context, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (const d of this.film.drops) {
      const x = (d.x / GLASS.width + .5) * w, y = (1 - d.y / GLASS.height) * h;
      const r = d.radius / GLASS.width * w;
      const gradient = ctx.createRadialGradient(x - r * .2, y - r * .2, r * .1, x, y, r);
      gradient.addColorStop(0, '#fff'); gradient.addColorStop(.45, '#999'); gradient.addColorStop(.8, '#777'); gradient.addColorStop(1, '#000');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.18, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.texture.needsUpdate = true;
  }
  get diagnostics() { return { drops: this.film.drops.length, blades: this.blades.length }; }
  dispose(): void { this.texture.dispose(); }
}
