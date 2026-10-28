import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLE_CATALOG, type FleetKind } from './vehicle-catalog';
import { CYBER_VEHICLES,CYBER_MODEL_IDS,cyberModel,type CyberModel } from './cyber-vehicles';
import { cyberPrefab } from './cyber-prefabs';
import { VEHICLE_LAMPS } from './lamp-levels';
export type FleetIdentity=FleetKind|CyberModel;
const identity=(kind:FleetIdentity):CyberModel=>kind in CYBER_VEHICLES?kind as CyberModel:cyberModel(kind as FleetKind);

export type VehicleLOD = 0 | 1 | 2;
export type VehicleLampRole = 'head' | 'brake' | 'turn' | 'reverse' | 'red' | 'blue' | 'amber';
export interface FleetRig {
  group: THREE.Group; body: THREE.Group; wheelPhase: number; wheels: THREE.Object3D[]; spins: THREE.Object3D[];
  lamps: Record<VehicleLampRole, THREE.MeshStandardMaterial[]>;
  paint: THREE.MeshPhysicalMaterial[]; unique: THREE.Material[];
  wheelRadius: number; model:CyberModel; trailer?:THREE.Object3D;trailerAngle?:number;
}
const sources = new Map<string, Promise<THREE.Group>>();
const decoded = new Map<string, THREE.Group>();
const keys=CYBER_MODEL_IDS;
export const fleetKind = (kind: string): FleetKind => kind === 'van' ? 'truck' : kind as FleetKind;
export function fleetPath(kind: FleetKind, lod: VehicleLOD = 0): string {
  const spec = VEHICLE_CATALOG[kind];
  return lod === 2 ? spec.lod2Path ?? spec.lod1Path ?? spec.path : lod === 1 ? spec.lod1Path ?? spec.path : spec.path;
}
/** Buffers/textures are shared for the page lifetime, never disposed when traffic recycles. */
export function fleetAsset(kind: FleetIdentity, lod: VehicleLOD = 0): Promise<THREE.Group> {
  const model=identity(kind),key=model+':'+lod;
  let pending=sources.get(key);
  if(!pending){const group=cyberPrefab(model,lod);decoded.set(key,group);pending=Promise.resolve(group);sources.set(key,pending);}
  return pending;
}
export async function preloadFleet(): Promise<void> {
  await Promise.all(keys.map(kind => Promise.all([fleetAsset(kind, 0), fleetAsset(kind, 1), fleetAsset(kind, 2)])));
}
export function fleetDiagnostics() { return { models: decoded.size, requested: sources.size, categories: keys.length, ready: keys.every(k => decoded.has(k+':0')) }; }
export function materialRole(m: THREE.Material): string { return String(m.userData.vehicleRole ?? m.userData.role ?? '').toLowerCase(); }
/** Clone a cached authored prefab; geometry remains shared and dynamic materials are independent. */
export function rigFleetCar(source: THREE.Group, kind: FleetIdentity, color: string): FleetRig {
  const group = source.clone(true), unique: THREE.Material[] = [], paint: THREE.MeshPhysicalMaterial[] = [];
  const lamps: FleetRig['lamps'] = { head: [], brake: [], turn: [], reverse: [], red: [], blue: [], amber: [] };
  const materials = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  group.name=CYBER_VEHICLES[identity(kind)].name;
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
        if (CYBER_VEHICLES[identity(kind)].emergency!=='police' && !m.map) m.color.set(color);
        paint.push(m);
      } else if (role === 'glass' || role === 'window') {
        m.color.set('#193346'); m.metalness = .6; m.roughness = .13; m.clearcoat = 1;
        if(identity(kind)==='orbit'){m.transparent=true;m.opacity=.35;m.depthWrite=false;m.side=THREE.DoubleSide;}
      } else if (role === 'tire' || role === 'rubber') { m.roughness = .91; m.metalness = 0; }
      if (role in lamps) {
        const lamp = role as VehicleLampRole; lamps[lamp].push(m);
        m.emissive.set(lamp === 'head' ? '#d2e7ff' : lamp === 'brake' || lamp === 'red' ? '#ff1934' : lamp === 'blue' ? '#1675ff' : lamp==='reverse'?'#e8f6ff':'#ffad38');
        if(original instanceof THREE.MeshStandardMaterial&&original.userData.cyber)m.emissive.copy(original.emissive);
        m.emissiveIntensity = lamp === 'head' ? VEHICLE_LAMPS.head : lamp === 'brake' ? VEHICLE_LAMPS.tail : lamp==='amber'?.55:0; m.roughness = .18;
      }
      materials.set(original, m); unique.push(m); return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    o.castShadow = !(Array.isArray(o.material) ? o.material.some(m => m.transparent) : o.material.transparent); o.receiveShadow = true;
  });
  const wheels:THREE.Object3D[]=[];
  group.traverse(o=>{if(o.userData.vehicleWheel||/^Wheel_(FL|FR|RL|RR)$/.test(o.name))wheels.push(o);});
  if(wheels.length<4){unique.forEach(m=>m.dispose());throw new Error('Vehicle '+kind+' has invalid wheel pivots');}
  const spins = wheels.map(w => w.getObjectByName('Spin') ?? w.children[0]);
  // Suspension tilts the sprung body; tire contact patches stay on the road.
  const body = new THREE.Group(), frame = wheels[0].parent!;
  body.name = 'SprungBody';
  for (const child of [...frame.children]) if (!wheels.includes(child)) body.add(child);
  frame.add(body);
  return { group, body, wheelPhase: 0, wheels, spins, lamps, paint, unique, wheelRadius: CYBER_VEHICLES[identity(kind)].wheelRadius,model:identity(kind),trailer:group.getObjectByName('TrailerPivot') };
}
export async function buildFleetCar(kind: FleetIdentity, color: string, lod: VehicleLOD = 0): Promise<FleetRig> { return rigFleetCar(await fleetAsset(kind, lod), kind, color); }
export function animateFleetRig(rig: FleetRig, dt: number, time: number, speed: number, steering: number, braking: boolean, police: boolean, signal: number = 0): void {
  rig.wheelPhase += speed * dt / rig.wheelRadius;
  rig.wheels.forEach(wheel=>wheel.rotation.y=wheel.userData.frontWheel||/Wheel_F[LR]/.test(wheel.name)?steering:0);
  if(rig.trailer)rig.trailer.rotation.y=rig.trailerAngle??THREE.MathUtils.damp(rig.trailer.rotation.y,THREE.MathUtils.clamp(-steering*.18,-.075,.075),2,dt);
  rig.spins.forEach(wheel => wheel.rotation.x = -rig.wheelPhase);
  rig.lamps.head.forEach(m => m.emissiveIntensity = VEHICLE_LAMPS.head);
  rig.lamps.brake.forEach(m => m.emissiveIntensity = braking ? VEHICLE_LAMPS.brake : VEHICLE_LAMPS.tail);
  rig.lamps.reverse.forEach(m=>m.emissiveIntensity=speed<-.2?2:0);
  const rescue=CYBER_VEHICLES[rig.model].emergency==='rescue'&&police;
  rig.lamps.amber.forEach(m=>m.emissiveIntensity=rescue?(time%.8<.22||time%.8>.35&&time%.8<.5?4:.05):.55);
  const blink = Math.floor(time * 2.4) % 2 === 0;
  rig.lamps.turn.forEach(m => {
    const side = String(m.userData.vehicleSide ?? '');
    const selected = signal !== 0 && (!side || side === (signal < 0 ? 'left' : 'right'));
    m.emissiveIntensity = selected && blink ? 4 : 0;
  });
  const phase = time % .6 < .3;
  for (const role of ['red', 'blue'] as const) rig.lamps[role].forEach(m => {
    const on = police && (role === 'red' ? !rescue&&phase : rescue?time%.8>.4:!phase);
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
  private proxies = new Map<CyberModel, Proxy>();
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
  place(kind: FleetKind, x: number, z: number, yaw: number,model?:CyberModel): void {
    const p = this.proxies.get(cyberModel(kind,model)); if (!p || p.count >= 100) return;
    this.position.set(x, 0, z); this.rotation.setFromAxisAngle(this.up, -yaw); this.matrix.compose(this.position, this.rotation, this.scale);
    for (const mesh of p.meshes) mesh.setMatrixAt(p.count, this.matrix); p.count++;
  }
  end(): void { for (const p of this.proxies.values()) for (const mesh of p.meshes) { mesh.count = p.count; mesh.instanceMatrix.needsUpdate = true; } }
  get count(): number { return Array.from(this.proxies.values()).reduce((n, p) => n + p.count, 0); }
  dispose(): void { this.retired = true; for (const p of this.proxies.values()) for (const mesh of p.meshes) { mesh.geometry.dispose(); mesh.dispose(); } this.group.removeFromParent(); this.proxies.clear(); }
}
