import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Random, hashSeed } from '../core/random';
import { sceneZ } from './road';
import { CatalogSkyline } from './catalog-skyline';
/** Stable world-position districts overlap the detailed city; only the far window changes. */
export class CityBackdrop {
  readonly group = new THREE.Group();
  private masses: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private rounded: THREE.InstancedMesh;
  private ground: THREE.Mesh;
  private beacons: THREE.InstancedMesh;
  private landmarks: CatalogSkyline;
  private nightOrigin = { value: 0 };
  private transform = new THREE.Object3D();
  private key = '';
  constructor() {
    const material = new THREE.MeshStandardMaterial({ color: '#142342', roughness: .45, metalness: .3 });
    material.onBeforeCompile = shader => {
      shader.uniforms.nightOrigin = this.nightOrigin;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float nightOrigin; varying vec3 nightPosition; varying float nightAxis;');
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vec4 nightLocal = vec4(transformed,1.);
        #ifdef USE_INSTANCING
          nightLocal = instanceMatrix * nightLocal;
        #endif
        nightPosition = (modelMatrix * nightLocal).xyz;
        nightPosition.z -= nightOrigin;
        nightAxis = abs(normal.x);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 nightPosition; varying float nightAxis;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        vec2 grid = vec2(mix(nightPosition.x,nightPosition.z,step(.5,nightAxis))*.6,nightPosition.y*.34);
        vec2 cell = floor(grid), f = fract(grid), aa = min(fwidth(grid),vec2(.49));
        float hash = fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
        vec2 panes = smoothstep(vec2(.12)-aa,vec2(.12)+aa,f)*(1.-smoothstep(vec2(.82)-aa,vec2(.82)+aa,f));
        float detail = 1.-smoothstep(.4,1.3,max(fwidth(grid.x),fwidth(grid.y)));
        float occupied=fract(sin(floor(nightPosition.y*.085)*91.3)*1791.7);
        float windows=mix(.12,panes.x*panes.y*step(occupied>.4?.28:.9,hash),detail);
        vec3 windowColor = hash>.7?vec3(.65,.45,.24):hash>.4?vec3(.36,.43,.48):vec3(.04,.18,.35);
        windowColor = mix(vec3(.12,.28,.52),windowColor,detail);
        totalEmissiveRadiance += windowColor*windows*.9;
      `);
    };
    material.customProgramCacheKey = () => 'night-skyline-v1';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.masses = new THREE.InstancedMesh(geometry, material, 600); this.crowns = new THREE.InstancedMesh(geometry, material, 300);
    this.rounded = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, .16), material, 180);
    this.landmarks=new CatalogSkyline(material);
    this.beacons = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({color:'#20aaff'}), 720); this.beacons.frustumCulled=false;
    this.masses.frustumCulled = this.crowns.frustumCulled = this.rounded.frustumCulled = false;
    this.masses.castShadow = this.crowns.castShadow = false;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 16000), new THREE.MeshStandardMaterial({ color: '#121627', roughness: .93 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -.52;
    this.group.add(this.ground, this.masses, this.crowns, this.rounded, this.beacons, this.landmarks.group);
  }
  update(seed: string, s: number, origin: number): void {
    this.ground.position.z = sceneZ(s, origin); this.nightOrigin.value = origin;
    const block = Math.floor(s / 360), key = `${seed}:${block}:${origin}`; if (key === this.key) return; this.key = key;
    let count = 0, crown = 0, rounded = 0, beacon = 0;
    for (let id = block - 4; id <= block + 10; id++) {
      const r = new Random(hashSeed(`${seed}:distant-district:${id}`));
      for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let slot = 0; slot < 3; slot++) {
        const h = r.range(row === 0 ? 100 : 160, row === 3 ? 390 : 290), w = r.range(22, 43), d = r.range(24, 60);
        const x = side * (600 + row * 115 + r.range(-18, 18)), worldS = id * 360 + slot * 120 + r.range(12, 70);
        this.transform.position.set(x, h / 2 - .1, sceneZ(worldS, origin)); this.transform.scale.set(w, h, d); this.transform.rotation.y = 0; this.transform.updateMatrix(); if (row % 3 === 1) this.rounded.setMatrixAt(rounded++, this.transform.matrix); else this.masses.setMatrixAt(count++, this.transform.matrix);
        for (const edge of [-1, 1]) {
          this.transform.position.set(x + edge * (w / 2 + .08), h * .66, sceneZ(worldS, origin) + d / 2 + .08);
          this.transform.scale.set(.28, h * .68, .28); this.transform.updateMatrix(); this.beacons.setMatrixAt(beacon++,this.transform.matrix);
        }
        this.transform.position.set(x,h/2-.1,sceneZ(worldS,origin));
        if (r.next() > .45 && crown < 300) { const ch = r.range(5, 27); this.transform.position.y = h + ch / 2; this.transform.scale.set(w * .6, ch, d * .63); this.transform.updateMatrix(); this.crowns.setMatrixAt(crown++, this.transform.matrix); }
      }
    }
    this.landmarks.update(seed,block,origin);
    this.beacons.count = beacon; this.beacons.instanceMatrix.needsUpdate = true;
    this.masses.count = count; this.crowns.count = crown; this.rounded.count = rounded; this.masses.instanceMatrix.needsUpdate = this.crowns.instanceMatrix.needsUpdate = this.rounded.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); this.group.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); const list = Array.isArray(o.material) ? o.material : [o.material]; for (const m of list) materials.add(m); } }); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); }
  reset(): void { this.key = ''; }
  get diagnostics() { return { skylineBuildings: this.masses.count + this.rounded.count, landmarkTowers:this.landmarks.count, skylineWindow: this.key.split(':').slice(-2).join(':') }; }
}
