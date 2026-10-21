import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Random, hashSeed } from '../core/random';
import { sceneZ } from './road';
/** Stable world-position districts overlap the detailed city; only the far window changes. */
export class CityBackdrop {
  readonly group = new THREE.Group();
  private masses: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private rounded: THREE.InstancedMesh;
  private ground: THREE.Mesh;
  private transform = new THREE.Object3D();
  private key = '';
  constructor() {
    const material = new THREE.MeshStandardMaterial({ color: '#647079', roughness: .77, metalness: .12 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.masses = new THREE.InstancedMesh(geometry, material, 600); this.crowns = new THREE.InstancedMesh(geometry, material, 300);
    this.rounded = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, .16), material, 180);
    this.masses.frustumCulled = this.crowns.frustumCulled = this.rounded.frustumCulled = false;
    this.masses.castShadow = this.crowns.castShadow = false;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 16000), new THREE.MeshStandardMaterial({ color: '#646a62', roughness: .93 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -.52;
    this.group.add(this.ground, this.masses, this.crowns, this.rounded);
  }
  update(seed: string, s: number, origin: number): void {
    this.ground.position.z = sceneZ(s, origin);
    const block = Math.floor(s / 360), key = `${seed}:${block}:${origin}`; if (key === this.key) return; this.key = key;
    let count = 0, crown = 0, rounded = 0;
    for (let id = block - 4; id <= block + 10; id++) {
      const r = new Random(hashSeed(`${seed}:distant-district:${id}`));
      for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let slot = 0; slot < 3; slot++) {
        const h = r.range(row === 0 ? 45 : 65, row === 3 ? 260 : 185), w = r.range(22, 43), d = r.range(24, 60);
        const x = side * (220 + row * 115 + r.range(-18, 18)), worldS = id * 360 + slot * 120 + r.range(12, 70);
        this.transform.position.set(x, h / 2 - .1, sceneZ(worldS, origin)); this.transform.scale.set(w, h, d); this.transform.rotation.y = 0; this.transform.updateMatrix(); if (row % 3 === 1) this.rounded.setMatrixAt(rounded++, this.transform.matrix); else this.masses.setMatrixAt(count++, this.transform.matrix);
        if (r.next() > .45 && crown < 300) { const ch = r.range(5, 27); this.transform.position.y = h + ch / 2; this.transform.scale.set(w * .6, ch, d * .63); this.transform.updateMatrix(); this.crowns.setMatrixAt(crown++, this.transform.matrix); }
      }
    }
    this.masses.count = count; this.crowns.count = crown; this.rounded.count = rounded; this.masses.instanceMatrix.needsUpdate = this.crowns.instanceMatrix.needsUpdate = this.rounded.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); this.group.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); const list = Array.isArray(o.material) ? o.material : [o.material]; for (const m of list) materials.add(m); } }); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); }
  reset(): void { this.key = ''; }
  get diagnostics() { return { skylineBuildings: this.masses.count + this.rounded.count, skylineWindow: this.key.split(':').slice(-2).join(':') }; }
}
