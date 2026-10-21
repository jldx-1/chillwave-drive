import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLE_CATALOG, type FleetKind } from './vehicle-catalog';

export type VehicleLOD = 0 | 1 | 2;
export type VehicleLampRole = 'head' | 'brake' | 'turn' | 'red' | 'blue';
export interface FleetRig {
  group: THREE.Group; body: THREE.Group; wheelPhase: number; wheels: THREE.Object3D[]; spins: THREE.Object3D[];
  lamps: Record<VehicleLampRole, THREE.MeshStandardMaterial[]>;
  paint: THREE.MeshPhysicalMaterial[]; unique: THREE.Material[];
  wheelRadius: number;
}
const sources = new Map<string, Promise<THREE.Group>>();
const decoded = new Map<string, THREE.Group>();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const keys = Object.keys(VEHICLE_CATALOG) as FleetKind[];
export const fleetKind = (kind: string): FleetKind => kind === 'van' ? 'truck' : kind as FleetKind;
export function fleetPath(kind: FleetKind, lod: VehicleLOD = 0): string {
  const spec = VEHICLE_CATALOG[kind];
  return lod === 2 ? spec.lod2Path ?? spec.lod1Path ?? spec.path : lod === 1 ? spec.lod1Path ?? spec.path : spec.path;
}
/** Buffers/textures are shared for the page lifetime, never disposed when traffic recycles. */
export function fleetAsset(kind: FleetKind, lod: VehicleLOD = 0): Promise<THREE.Group> {
  const path = fleetPath(kind, lod);
  let pending = sources.get(path);
  if (!pending) {
    pending = loader.loadAsync(import.meta.env.BASE_URL + path).then(g => { g.scene.updateMatrixWorld(true); decoded.set(path, g.scene); return g.scene; });
    sources.set(path, pending);
  }
  return pending;
}
export async function preloadFleet(): Promise<void> {
  await Promise.all(keys.map(kind => Promise.all([fleetAsset(kind, 0), fleetAsset(kind, 1), fleetAsset(kind, 2)])));
}
export function fleetDiagnostics() { return { models: decoded.size, requested: sources.size, categories: keys.length, ready: keys.every(k => decoded.has(fleetPath(k))) }; }
export function materialRole(m: THREE.Material): string { return String(m.userData.vehicleRole ?? m.userData.role ?? '').toLowerCase(); }
/** Canonical GLBs carry their pivots and surfaces; runtime creates no substitute coachwork. */
export function rigFleetCar(source: THREE.Group, kind: FleetKind, color: string): FleetRig {
  const group = source.clone(true), unique: THREE.Material[] = [], paint: THREE.MeshPhysicalMaterial[] = [];
  const lamps: FleetRig['lamps'] = { head: [], brake: [], turn: [], red: [], blue: [] };
  const materials = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  group.name = kind + ' GLB';
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = (original: THREE.Material) => {
      let m = materials.get(original); if (m) return m;
      m = new THREE.MeshPhysicalMaterial();
      if (original instanceof THREE.MeshStandardMaterial) THREE.MeshStandardMaterial.prototype.copy.call(m, original);
      else if (original instanceof THREE.MeshBasicMaterial) { m.color.copy(original.color); m.map = original.map; m.transparent = original.transparent; m.opacity = original.opacity; m.side = original.side; }
      m.userData = { ...original.userData }; m.name = original.name;
      const role = materialRole(m);
      if (role === 'paint') {
        m.clearcoat = 1; m.clearcoatRoughness = .14; m.metalness = Math.max(.25, m.metalness); m.roughness = Math.min(.34, Math.max(.18, m.roughness));
        if (kind !== 'police' && !m.map) m.color.set(color);
        paint.push(m);
      } else if (role === 'glass' || role === 'window') {
        m.color.set('#b3c6cf'); m.metalness = .05; m.roughness = .09; m.transparent = true; m.opacity = .38; m.depthWrite = false; m.side = THREE.DoubleSide; m.clearcoat = 1;
      } else if (role === 'tire' || role === 'rubber') { m.roughness = .91; m.metalness = 0; }
      if (role in lamps) {
        const lamp = role as VehicleLampRole; lamps[lamp].push(m);
        m.emissive.set(lamp === 'head' ? '#d2e7ff' : lamp === 'brake' || lamp === 'red' ? '#ff1934' : lamp === 'blue' ? '#1675ff' : '#ffad38');
        m.emissiveIntensity = lamp === 'head' ? 1.3 : lamp === 'brake' ? .3 : 0; m.roughness = .18;
      }
      materials.set(original, m); unique.push(m); return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    o.castShadow = !(Array.isArray(o.material) ? o.material.some(m => m.transparent) : o.material.transparent); o.receiveShadow = true;
  });
  const wheels = ['Wheel_FL', 'Wheel_RL', 'Wheel_FR', 'Wheel_RR'].map(name => group.getObjectByName(name)).filter((o): o is THREE.Object3D => !!o);
  if (wheels.length !== 4) { unique.forEach(m => m.dispose()); throw new Error('Vehicle ' + kind + ' has invalid wheel pivots'); }
  const spins = wheels.map(w => w.getObjectByName('Spin') ?? w.children[0]);
  // Suspension tilts the sprung body; tire contact patches stay on the road.
  const body = new THREE.Group(), frame = wheels[0].parent!;
  body.name = 'SprungBody';
  for (const child of [...frame.children]) if (!wheels.includes(child)) body.add(child);
  frame.add(body);
  return { group, body, wheelPhase: 0, wheels, spins, lamps, paint, unique, wheelRadius: VEHICLE_CATALOG[kind].wheelRadius };
}
export async function buildFleetCar(kind: FleetKind, color: string, lod: VehicleLOD = 0): Promise<FleetRig> { return rigFleetCar(await fleetAsset(kind, lod), kind, color); }
export function animateFleetRig(rig: FleetRig, dt: number, time: number, speed: number, steering: number, braking: boolean, police: boolean, signal: number = 0): void {
  rig.wheelPhase += speed * dt / rig.wheelRadius;
  rig.wheels.forEach((wheel, i) => wheel.rotation.y = i % 2 === 0 ? steering : 0);
  rig.spins.forEach(wheel => wheel.rotation.x = -rig.wheelPhase);
  rig.lamps.head.forEach(m => m.emissiveIntensity = 1.5);
  rig.lamps.brake.forEach(m => m.emissiveIntensity = braking ? 3.5 : .25);
  const blink = Math.floor(time * 2.4) % 2 === 0;
  rig.lamps.turn.forEach(m => {
    const side = String(m.userData.vehicleSide ?? '');
    const selected = signal !== 0 && (!side || side === (signal < 0 ? 'left' : 'right'));
    m.emissiveIntensity = selected && blink ? 4 : 0;
  });
  const phase = time % .6 < .3;
  for (const role of ['red', 'blue'] as const) rig.lamps[role].forEach(m => {
    const on = police && (role === 'red' ? phase : !phase);
    m.emissiveIntensity = on ? 5 : 0;
    m.color.set(on ? role === 'red' ? '#ff253a' : '#1675ff' : '#20262c');
  });
  const wheel = rig.body.getObjectByName('Steering');
  if (wheel) wheel.rotation.z = -steering * 5;
}
export function disposeFleetRig(rig: FleetRig): void { rig.group.removeFromParent(); rig.unique.forEach(m => m.dispose()); }

interface Proxy { group: THREE.Group; meshes: THREE.InstancedMesh[]; count: number }
/** Far instances come from each real vehicle's LOD silhouette, including its wheels. */
export class FleetDistant {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private proxies = new Map<FleetKind, Proxy>();
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private scale = new THREE.Vector3(1, 1, 1);
  private retired = false;
  constructor() {
    this.ready = Promise.all(keys.map(async kind => {
      const source = await fleetAsset(kind, 2); if (this.retired) return;
      const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
      source.updateMatrixWorld(true);
      source.traverse(o => {
        if (!(o instanceof THREE.Mesh) || !o.visible) return;
        if (Array.isArray(o.material)) return; // Canonical exporter splits material primitives.
        const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
        const list = buckets.get(o.material) ?? []; list.push(g); buckets.set(o.material, list);
      });
      const group = new THREE.Group(), meshes: THREE.InstancedMesh[] = [];
      for (const [material, parts] of buckets) {
        const all = parts.map(g => g.index ? g.toNonIndexed() : g), merged = mergeGeometries(all);
        new Set([...parts, ...all]).forEach(g => g.dispose());
        if (!merged) throw new Error('Incompatible ' + kind + ' proxy attributes');
        const mesh = new THREE.InstancedMesh(merged, material, 100); mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.receiveShadow = true; group.add(mesh); meshes.push(mesh);
      }
      this.proxies.set(kind, { group, meshes, count: 0 }); this.group.add(group);
    })).then(() => {});
  }
  begin(): void { for (const p of this.proxies.values()) p.count = 0; }
  place(kind: FleetKind, x: number, z: number, yaw: number): void {
    const p = this.proxies.get(kind); if (!p || p.count >= 100) return;
    this.position.set(x, 0, z); this.rotation.setFromAxisAngle(this.up, -yaw); this.matrix.compose(this.position, this.rotation, this.scale);
    for (const mesh of p.meshes) mesh.setMatrixAt(p.count, this.matrix); p.count++;
  }
  end(): void { for (const p of this.proxies.values()) for (const mesh of p.meshes) { mesh.count = p.count; mesh.instanceMatrix.needsUpdate = true; } }
  get count(): number { return Array.from(this.proxies.values()).reduce((n, p) => n + p.count, 0); }
  dispose(): void { this.retired = true; for (const p of this.proxies.values()) for (const mesh of p.meshes) { mesh.geometry.dispose(); mesh.dispose(); } this.group.removeFromParent(); this.proxies.clear(); }
}
