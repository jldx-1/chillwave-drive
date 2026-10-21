import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PLAYER_ASSET_PATH } from './vehicle-catalog';

let loaded: Promise<THREE.Group> | undefined;
/** Locally served, attributed ChevroletSS GT3; decode only once per page. */
export function playerCarAsset(): Promise<THREE.Group> {
  if (!loaded) loaded = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(import.meta.env.BASE_URL + PLAYER_ASSET_PATH).then(g => g.scene);
  return loaded;
}
export interface PlayerCarRig {
  scale: number; group: THREE.Group; wheels: THREE.Group[]; spins: THREE.Group[];
  steering: THREE.Group; wipers: THREE.Group[]; eye: THREE.Vector3;
  mirror: THREE.BufferGeometry; sideMirrors: THREE.BufferGeometry[];
  damage: { value: number }; paint: THREE.MeshPhysicalMaterial[];
  lamps: THREE.MeshStandardMaterial[]; headlamps: THREE.MeshStandardMaterial[];
  windows: THREE.MeshPhysicalMaterial[]; unique: THREE.Material[]; owned: THREE.BufferGeometry[];
}
export async function buildPlayerCar(color: string): Promise<PlayerCarRig> {
  return rigCanonicalPlayer(await playerCarAsset(), color);
}

/** Bake the source transforms, keeping wheels, calipers, steering and wipers independent. */
export function rigPlayerCar(source: THREE.Group, color: string): PlayerCarRig {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3());
  const scale = 4.6 / size.z, center = bounds.getCenter(new THREE.Vector3());
  const normalize = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y + .012, -center.z));
  const group = new THREE.Group(), steering = new THREE.Group(), wipers: THREE.Group[] = [];
  group.name = 'Cyan 911 GT3';
  const wheels: THREE.Group[] = [], spins: THREE.Group[] = [], unique: THREE.Material[] = [];
  const owned: THREE.BufferGeometry[] = [], paint: THREE.MeshPhysicalMaterial[] = [];
  const windows: THREE.MeshPhysicalMaterial[] = [];
  const lamps: THREE.MeshStandardMaterial[] = [], headlamps: THREE.MeshStandardMaterial[] = [];
  const damage = { value: 0 }, materials = new Map<string, THREE.MeshPhysicalMaterial>();
  function material(original: THREE.MeshStandardMaterial, name: string): THREE.MeshPhysicalMaterial {
    // The source shares one lamp material between front and rear lights.
    const role = /^FrontLight/.test(name) ? 'head' : /^RearLight/.test(name) ? 'brake' : '';
    const key = `${original.uuid}:${role}`;
    if (materials.has(key)) return materials.get(key)!;
    const m = original instanceof THREE.MeshPhysicalMaterial ? original.clone() : new THREE.MeshPhysicalMaterial();
    if (!(original instanceof THREE.MeshPhysicalMaterial)) THREE.MeshStandardMaterial.prototype.copy.call(m, original);
    materials.set(key, m); unique.push(m);
    const nameOfMaterial = original.name;
    if (/Carpaint/i.test(nameOfMaterial)) {
      m.color.set(color); m.metalness = .72; m.roughness = .21; m.clearcoat = 1; m.clearcoatRoughness = .075;
      paint.push(m);
      m.onBeforeCompile = shader => {
        shader.uniforms.damageAmount = damage;
        shader.vertexShader = 'varying vec3 carSurface;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncarSurface=position;');
        shader.fragmentShader = 'varying vec3 carSurface; uniform float damageAmount;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float scratch=step(.965,fract(carSurface.z*43.+sin(carSurface.y*72.)))*step(.45,damageAmount)*step(carSurface.y,.75);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.31,.33),scratch*damageAmount*.7);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 cells=carSurface.xz*150.;vec2 bead=fract(cells)-.5;
          float water=smoothstep(.24,.06,length(bead))*step(.978,fract(sin(dot(floor(cells),vec2(12.9898,78.233)))*43758.5453));
          normal=normalize(normal+vec3(bead*water*.14,0.));roughnessFactor=mix(roughnessFactor,.08,water);
        `);
      };
    } else if (/EXT_Rim/.test(nameOfMaterial)) {
      m.color.set('#202730'); m.metalness = .88; m.roughness = .2; m.clearcoat = .5;
    } else if (/EXT_Disc|aluminium|Metal_Alu|Front_Light_chrome/.test(nameOfMaterial)) {
      m.color.set('#a4aeb6'); m.metalness = .92; m.roughness = .26;
    } else if (/Brake_Caliper|Metal_Rollbar/.test(nameOfMaterial)) {
      m.color.set(color); m.metalness = .55; m.roughness = .28;
    } else if (/Tyre/.test(nameOfMaterial)) {
      m.color.set('#14161a'); m.metalness = 0; m.roughness = .87;
    } else if (/Skin_White|DECALS_Rubber/.test(nameOfMaterial)) {
      m.color.set('#744838'); m.metalness = 0; m.roughness = .7;
    } else if (/INT_Carbon/.test(nameOfMaterial)) {
      m.color.set('#20252b'); m.metalness = .35; m.roughness = .4;
    }
    if (/EXT_Glass_Windows/.test(nameOfMaterial)) windows.push(m);
    if (/Glass/.test(nameOfMaterial)) {
      const window = /Windows|INT_Glass/.test(nameOfMaterial);
      m.color.set(window ? '#c1dae2' : /Rear/.test(name) ? '#e74355' : '#e2edf5');
      m.metalness = 0; m.roughness = .055; m.transmission = 0;
      m.transparent = true; m.opacity = window ? .14 : .18; m.depthWrite = false;
    }
    if (/EXT_Glass_Light_INT/.test(nameOfMaterial) || role === 'brake' && /Flat_Light/.test(nameOfMaterial)) {
      m.color.set('#950f20'); m.emissive.set('#ff182e'); m.emissiveIntensity = .7; lamps.push(m);
    }
    if (role === 'head' && /Flat_Light|Front_Light/.test(nameOfMaterial)) {
      m.color.set('#f0f7ff'); m.emissive.set('#e0f3ff'); m.emissiveIntensity = 2.5; headlamps.push(m);
    }
    // Untextured source gauge/decal faces should not glow as blank white panels.
    if (/INT_DECALS_Emissive/.test(nameOfMaterial)) { m.color.set('#111820'); m.emissive.set('#000000'); }
    return m;
  }
  const baked: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>; name: string; center: THREE.Vector3 }[] = [];
  source.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = o.parent?.name ?? o.name;
    // Omit the duplicate motion-blur rim, which otherwise flickers over the real spokes.
    if (/rim_blur/.test(name)) return;
    const geometry = o.geometry.clone();
    // Meshopt's normalized integer positions must become floats BEFORE world-space baking.
    for (const attr of ['position', 'normal']) {
      const input = geometry.getAttribute(attr);
      if (!input) continue;
      const data = new Float32Array(input.count * 3);
      for (let i = 0; i < input.count; i++) { data[i * 3] = input.getX(i); data[i * 3 + 1] = input.getY(i); data[i * 3 + 2] = input.getZ(i); }
      geometry.setAttribute(attr, new THREE.BufferAttribute(data, 3));
    }
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, o.matrixWorld)); owned.push(geometry);
    const mesh = new THREE.Mesh(geometry, material(o.material as THREE.MeshStandardMaterial, name)); mesh.name = name;
    mesh.castShadow = !mesh.material.transparent; mesh.receiveShadow = true;
    geometry.computeBoundingBox();
    baked.push({ mesh, name, center: geometry.boundingBox!.getCenter(new THREE.Vector3()) });
  });
  const movable = new Set<THREE.Mesh>();
  const tires = baked.filter(e => /Tyre/.test(e.name));
  // Preserve the front/rear ordering expected by the steering animation.
  tires.sort((a, b) => Math.sign(a.center.x) - Math.sign(b.center.x) || a.center.z - b.center.z);
  for (const entry of tires) {
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.copy(entry.center); pivot.add(spin);
    pivot.name = entry.center.z < 0 ? 'Front wheel' : 'Rear wheel';
    wheels.push(pivot); spins.push(spin); group.add(pivot);
    for (const part of baked) {
      if (!/Tyre|rim_|Wheel_Hub|Brake_Caliper|A_DISC/.test(part.name)) continue;
      const nearest = tires.reduce((a, b) => part.center.distanceToSquared(a.center) < part.center.distanceToSquared(b.center) ? a : b);
      if (nearest !== entry) continue;
      part.mesh.geometry.translate(-entry.center.x, -entry.center.y, -entry.center.z);
      (/Caliper/.test(part.name) ? pivot : spin).add(part.mesh); movable.add(part.mesh);
    }
  }
  function pivotParts(parts: typeof baked, pivot: THREE.Group, origin: THREE.Vector3) {
    pivot.position.copy(origin); group.add(pivot);
    for (const part of parts) { part.mesh.geometry.translate(-origin.x, -origin.y, -origin.z); pivot.add(part.mesh); movable.add(part.mesh); }
  }
  const steeringParts = baked.filter(e => /GEO_Steer_/.test(e.name));
  const steeringBounds = new THREE.Box3(); steeringParts.forEach(e => steeringBounds.expandByObject(e.mesh));
  pivotParts(steeringParts, steering, steeringBounds.getCenter(new THREE.Vector3()));
  for (const ids of ['012', '345']) {
    const parts = baked.filter(e => new RegExp(`GEO_Wiper[${ids}]`).test(e.name));
    const base = parts.find(e => new RegExp(`GEO_Wiper${ids[0]}`).test(e.name))!;
    const pivot = new THREE.Group(); pivotParts(parts, pivot, base.center); wipers.push(pivot);
  }
  function mirrorGeometry(part: typeof baked[number], side: number): THREE.BufferGeometry {
    movable.add(part.mesh);
    const geometry = part.mesh.geometry, box = geometry.boundingBox!, span = box.getSize(new THREE.Vector3());
    const positions = geometry.getAttribute('position'), uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i++) {
      const u = (positions.getX(i) - box.min.x) / span.x;
      uv[i * 2] = side ? (side < 0 ? .65 : 0) + u * .35 : u;
      uv[i * 2 + 1] = (positions.getY(i) - box.min.y) / span.y;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
  }
  const mirror = mirrorGeometry(baked.find(e => /^MIRROR/.test(e.name))!, 0);
  const sideMirrors = [-1, 1].map(side => mirrorGeometry(baked.find(e => /GEO_Mirror_/.test(e.name) && Math.sign(e.center.x) === side)!, side));
  const staticParts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const { mesh } of baked) {
    if (movable.has(mesh)) continue;
    if (!staticParts.has(mesh.material)) staticParts.set(mesh.material, []);
    staticParts.get(mesh.material)!.push(mesh.geometry);
  }
  for (const [material, parts] of staticParts) {
    const geometry = mergeGeometries(parts, false);
    if (!geometry) throw new Error('Incompatible player-car geometry');
    owned.push(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = !(material as THREE.MeshPhysicalMaterial).transparent; mesh.receiveShadow = true; group.add(mesh);
  }
  // The real left-hand driver seat, comfortably below the curved coupe roof.
  const eye = new THREE.Vector3(-.335 * scale, 1.045 * scale, .10 * scale);
  return { scale, group, wheels, spins, steering, wipers, eye, mirror, sideMirrors, damage, paint, lamps, headlamps, windows, unique, owned };
}

/** Restore the authored canonical GT3 rig without rebuilding or rescaling its coachwork. */
export function rigCanonicalPlayer(source: THREE.Group, color: string): PlayerCarRig {
  const copy = source.clone(true), roots: THREE.Group[] = [];
  copy.traverse(o => { if (o.userData.playerRig) roots.push(o as THREE.Group); });
  const group = roots[0]; if (!group) throw new Error('Player GLB has no canonical rig metadata');
  group.removeFromParent();
  const damage = { value: 0 }, unique: THREE.Material[] = [], paint: THREE.MeshPhysicalMaterial[] = [];
  const lamps: THREE.MeshStandardMaterial[] = [], headlamps: THREE.MeshStandardMaterial[] = [], windows: THREE.MeshPhysicalMaterial[] = [];
  const cache = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = (original: THREE.Material) => {
      let m = cache.get(original); if (m) return m;
      m = original instanceof THREE.MeshPhysicalMaterial ? original.clone() : new THREE.MeshPhysicalMaterial();
      if (!(original instanceof THREE.MeshPhysicalMaterial) && original instanceof THREE.MeshStandardMaterial) THREE.MeshStandardMaterial.prototype.copy.call(m, original);
      m.userData = { ...original.userData };
      const role = String(m.userData.vehicleRole ?? '');
      if (role === 'paint' || /Carpaint/i.test(m.name)) {
        m.color.set(color); m.metalness = .72; m.roughness = .21; m.clearcoat = 1; m.clearcoatRoughness = .075; paint.push(m);
        m.onBeforeCompile = shader => {
          shader.uniforms.damageAmount = damage;
          shader.vertexShader = 'varying vec3 carSurface;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncarSurface=position;');
          shader.fragmentShader = 'varying vec3 carSurface; uniform float damageAmount;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat scratch=step(.965,fract(carSurface.z*43.+sin(carSurface.y*72.)))*step(.45,damageAmount)*step(carSurface.y,.75);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.31,.33),scratch*damageAmount*.7);');
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec2 cells=carSurface.xz*150.;vec2 bead=fract(cells)-.5;float water=smoothstep(.24,.06,length(bead))*step(.978,fract(sin(dot(floor(cells),vec2(12.9898,78.233)))*43758.5453));normal=normalize(normal+vec3(bead*water*.14,0.));roughnessFactor=mix(roughnessFactor,.08,water);');
        };
      }
      if (role === 'window' || /EXT_Glass_Windows/.test(m.name)) windows.push(m);
      if (role === 'head') headlamps.push(m);
      if (role === 'brake') lamps.push(m);
      unique.push(m); cache.set(original, m); return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    o.castShadow = !(Array.isArray(o.material) ? o.material.some(m => m.transparent) : o.material.transparent); o.receiveShadow = true;
  });
  const get = (name: string) => { const node = group.getObjectByName(name); if (!node) throw new Error('Missing player rig node ' + name); return node; };
  const wheels = ['Wheel_FL', 'Wheel_RL', 'Wheel_FR', 'Wheel_RR'].map(name => get(name) as THREE.Group);
  const spins = wheels.map(w => (w.getObjectByName('Spin') ?? w.children[0]) as THREE.Group);
  const mirrorGeometry = (name: string) => { const node = get(name) as THREE.Mesh; node.removeFromParent(); return node.geometry; };
  return { group, scale: Number(group.userData.scale), eye: new THREE.Vector3().fromArray(group.userData.eye),
    wheels, spins, steering: get('Steering') as THREE.Group, wipers: [get('Wiper_0'), get('Wiper_1')] as THREE.Group[],
    mirror: mirrorGeometry('Mirror_Center'), sideMirrors: [mirrorGeometry('Mirror_Left'), mirrorGeometry('Mirror_Right')],
    damage, paint, lamps, headlamps, windows, unique, owned: [] };
}
