import * as THREE from 'three';
import type { Agent } from './traffic';
import { buildPlayerCar, type PlayerCarRig } from './car-asset';
import { animateFleetRig, buildFleetCar, disposeFleetRig, fleetKind, type FleetRig, type VehicleLOD } from './fleet-asset';
import { VEHICLE_CATALOG } from './vehicle-catalog';
import type { Vehicle } from './vehicle';
import { RainGlass } from './rain-glass';
import { BoostEffects } from './boost-effects';
import { WIPER_AXIS, wiperSweep } from './weather';

let contactMaterial: THREE.MeshBasicMaterial | undefined;
/** All coachwork is loaded from independent GLBs. This class only binds gameplay to the rig. */
export class CarVisual {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly wheels: THREE.Object3D[] = [];
  readonly wipers: THREE.Group[] = [];
  readonly steering = new THREE.Group();
  readonly head = new THREE.MeshBasicMaterial({ color: '#e0f1ff' });
  readonly red = new THREE.MeshBasicMaterial({ color: '#20262c' });
  readonly blue = new THREE.MeshBasicMaterial({ color: '#20262c' });
  readonly mirror: THREE.Mesh;
  readonly sideMirrors: THREE.Mesh[] = [];
  readonly dashboard: THREE.CanvasTexture;
  readonly eye = new THREE.Vector3(-.4, 1.2, .2);
  ready: Promise<void> = Promise.resolve();
  assetReady = false;
  assetFailed = false;
  private canvas = document.createElement('canvas');
  private dashValue = '';
  private wheelPhase = 0;
  private player?: PlayerCarRig;
  private boost?:BoostEffects;
  private boostPulse=0;
  private sprung?: THREE.Group;
  private fleet?: FleetRig;
  private rainGlass?: RainGlass;
  private retired = false;
  private police = false;
  private signal = 0;
  private detail: VehicleLOD = 0;
  private epoch = 0;
  private roll = 0;
  private pitch = 0;
  private owned: THREE.BufferGeometry[] = [];
  private ownedMaterials: THREE.Material[] = [];
  constructor(private color = '#394d71', readonly detailed = false, readonly kind: Agent['kind'] = 'sport') {
    this.group.add(this.body);
    if (!contactMaterial) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
      gradient.addColorStop(0, '#00000080'); gradient.addColorStop(1, '#00000000'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
      contactMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
    }
    const spec = VEHICLE_CATALOG[fleetKind(kind)];
    const contactGeometry = new THREE.PlaneGeometry(detailed ? 2.7 : spec.width * 1.25, detailed ? 5.8 : spec.length * 1.18);
    this.owned.push(contactGeometry);
    const contact = new THREE.Mesh(contactGeometry, contactMaterial); contact.rotation.x = -Math.PI / 2; contact.position.y = .009; this.group.add(contact);
    this.canvas.width = detailed ? 512 : 1; this.canvas.height = detailed ? 128 : 1;
    this.dashboard = new THREE.CanvasTexture(this.canvas); this.dashboard.colorSpace = THREE.SRGBColorSpace;
    const mirrorGeometry = new THREE.PlaneGeometry(.39, .13); this.owned.push(mirrorGeometry);
    this.mirror = new THREE.Mesh(mirrorGeometry, new THREE.MeshBasicMaterial({ color: '#b9cdd9' }));
    if (detailed) {
      this.boost=new BoostEffects();this.group.add(this.boost.group);
      for (let i = 0; i < 2; i++) {
        const geometry = new THREE.PlaneGeometry(.2, .09); this.owned.push(geometry);
        this.sideMirrors.push(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#b9cdd9' })));
      }
      this.updateDashboard(0, 1); this.ready = this.loadPlayer();
    } else this.ready = this.loadFleet(0);
  }
  private async loadPlayer(): Promise<void> {
    try {
      const rig = await buildPlayerCar(this.color);
      if (this.retired) { new Set(rig.owned).forEach(g => g.dispose()); rig.unique.forEach(m => m.dispose()); return; }
      this.player = rig; this.eye.copy(rig.eye);
      this.boost?.setMounts(rig.wheels.filter(w=>w.position.z>0).map(w=>w.position));
      // The body and cockpit are sprung; wheel pivots remain planted at road height.
      const body = new THREE.Group(); body.name = 'SprungBody';
      for (const child of [...rig.group.children]) if (!rig.wheels.includes(child as THREE.Group)) body.add(child);
      rig.group.add(body); this.sprung = body;
      this.rainGlass = new RainGlass(rig); this.group.add(rig.group);
      const displayGeometry = new THREE.PlaneGeometry(.34, .10); this.owned.push(displayGeometry);
      const displayMaterial = new THREE.MeshBasicMaterial({ map: this.dashboard }); this.ownedMaterials.push(displayMaterial);
      const display = new THREE.Mesh(displayGeometry, displayMaterial);
      display.position.set(-.335 * rig.scale, .825 * rig.scale, -.42 * rig.scale); body.add(display);
      this.mirror.geometry = rig.mirror; body.add(this.mirror);
      this.sideMirrors.forEach((m, i) => { m.geometry = rig.sideMirrors[i]; body.add(m); });
      this.assetReady = true;
    } catch { this.assetFailed = true; }
  }
  private async loadFleet(lod: VehicleLOD): Promise<void> {
    const epoch = ++this.epoch;
    try {
      const rig = await buildFleetCar(fleetKind(this.kind), this.color, lod);
      if (this.retired || epoch !== this.epoch) { disposeFleetRig(rig); return; }
      if (this.fleet) disposeFleetRig(this.fleet);
      this.fleet = rig; this.body.add(rig.group); this.wheels.splice(0, this.wheels.length, ...rig.wheels);
      this.assetReady = true; this.assetFailed = false;
    } catch { if (epoch === this.epoch) this.assetFailed = true; }
  }
  get detailLevel(): VehicleLOD { return this.detail; }
  setDetail(lod: VehicleLOD): void {
    if (this.detailed || lod === this.detail || this.retired) return;
    this.detail = lod; this.ready = this.loadFleet(lod);
  }
  resetWeather(): void { this.rainGlass?.reset();this.boost?.update(0,0); }
  get boostDiagnostics(){return this.boost?.diagnostics??{visible:false,strength:0,plumes:0};}
  get bodyTilt(){return {pitch:this.sprung?.rotation.x??0,roll:this.sprung?.rotation.z??0};}
  get weatherDiagnostics() { return this.rainGlass?.diagnostics ?? { drops: 0, blades: 0 }; }
  setPolice(active: boolean): void { this.police = active; }
  updateAgent(agent: Agent): void {
    this.roll = agent.roll ?? 0; this.pitch = agent.pitch ?? 0; this.signal = agent.signal ?? 0;
  }
  updateDashboard(speed: number, gear: number, rpm = 850): void {
    const value = Math.round(Math.abs(speed) * 3.6) + ':' + gear + ':' + Math.floor(rpm / 200);
    if (value === this.dashValue || !this.detailed) return; this.dashValue = value;
    const ctx = this.canvas.getContext('2d')!;
    ctx.fillStyle = '#081118'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffcf91'; ctx.font = 'bold 76px monospace'; ctx.textAlign = 'center'; ctx.fillText(value.split(':')[0], 205, 88);
    ctx.fillStyle = '#f9ce96'; ctx.font = '32px monospace'; ctx.fillText(gear < 0 ? 'R' : 'D' + gear, 430, 75);
    ctx.fillStyle = '#4e5459'; ctx.fillRect(35, 108, 440, 4); ctx.fillStyle = '#e9b979'; ctx.fillRect(35, 108, 440 * Math.min(1, rpm / 7000), 4); this.dashboard.needsUpdate = true;
  }
  animate(dt: number, time: number, speed: number, steer: number, braking: boolean, reduced = false, sheltered = false): void {
    if (this.fleet) {
      animateFleetRig(this.fleet, dt, time, speed, steer, braking, this.police, this.signal);
      this.fleet.body.rotation.set(this.pitch, 0, this.roll);
    }
    this.boost?.update(this.boostPulse,time,reduced);
    if (this.player) {
      this.wheelPhase += speed * dt / .34;
      this.player.wheels.forEach((w, i) => w.rotation.y = i % 2 === 0 ? steer : 0); this.player.spins.forEach(w => w.rotation.x = -this.wheelPhase);
      this.player.steering.quaternion.setFromAxisAngle(new THREE.Vector3(0, -.35, 1).normalize(), -steer * 5);
      this.player.wipers.forEach((w, i) => w.quaternion.setFromAxisAngle(new THREE.Vector3(...WIPER_AXIS).normalize(), wiperSweep(time, i, reduced)));
      this.player.lamps.forEach(m => m.emissiveIntensity = braking ? 4 : .7);
      this.rainGlass?.update(dt, speed, sheltered, reduced);
    }
    this.red.color.set(this.police && time % .6 < .3 ? '#ff253a' : '#20262c');
    this.blue.color.set(this.police && time % .6 >= .3 ? '#1675ff' : '#20262c');
  }
  updatePlayer(vehicle: Vehicle, steadyCockpit = false): void {
    this.boostPulse=vehicle.boostPulse;
    if (this.player) {
      this.player.damage.value = vehicle.damage / 100;
      this.player.headlamps.forEach(m => m.emissiveIntensity = vehicle.headlights ? 2.5 : .02);
      this.sprung?.rotation.set(steadyCockpit?0:vehicle.pitch, 0, steadyCockpit?0:vehicle.roll);
      this.player.paint.forEach(m => m.roughness = .21 + vehicle.damage * .002);
    }
    this.updateDashboard(vehicle.speed, vehicle.speed < -.2 ? -1 : vehicle.gear, vehicle.rpm);
  }
  dispose(): void {
    this.boost?.dispose();
    this.retired = true; this.epoch++; this.rainGlass?.dispose();
    if (this.fleet) disposeFleetRig(this.fleet);
    this.player?.unique.forEach(m => m.dispose());
    new Set([...this.owned, ...(this.player?.owned ?? [])]).forEach(g => g.dispose());
    this.ownedMaterials.forEach(m => m.dispose());
    this.dashboard.dispose(); (this.mirror.material as THREE.Material).dispose();
    this.sideMirrors.forEach(m => (m.material as THREE.Material).dispose());
    this.head.dispose(); this.red.dispose(); this.blue.dispose(); this.group.clear();
  }
}
