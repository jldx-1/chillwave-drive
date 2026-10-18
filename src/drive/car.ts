import * as THREE from 'three';
import type { Agent } from './traffic';
import { coachwork, quad } from './surfaces';
import { buildPlayerCar, type PlayerCarRig } from './car-asset';
import type { Vehicle } from './vehicle';
import { RainGlass } from './rain-glass';
import { WIPER_AXIS, wiperSweep } from './weather';
import { buildPoliceCar, isSharedPoliceResource } from './police-car';
import { POLICE_SIZE } from './config';
let contactMaterial: THREE.MeshBasicMaterial | undefined;
const geometry = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(.34, .34, .23, 20);
const tire = new THREE.MeshStandardMaterial({ color: '#101218', roughness: .88 });
const chrome = new THREE.MeshStandardMaterial({ color: '#8394a3', metalness: .95, roughness: .18 });
const interior = new THREE.MeshStandardMaterial({ color: '#141923', roughness: .86 });
const glass = new THREE.MeshPhysicalMaterial({ color: '#7598ac', metalness: .1, roughness: .08, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide });
function box(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
export class CarVisual {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly wipers: THREE.Group[] = [];
  readonly steering = new THREE.Group();
  readonly brake = new THREE.MeshStandardMaterial({ color: '#9c131c', emissive: '#ff192a', emissiveIntensity: .8 });
  readonly head = new THREE.MeshBasicMaterial({ color: '#e0f1ff' });
  readonly red = new THREE.MeshBasicMaterial({ color: '#ff253a' });
  readonly blue = new THREE.MeshBasicMaterial({ color: '#296dff' });
  readonly mirror: THREE.Mesh;
  readonly sideMirrors: THREE.Mesh[] = [];
  readonly dashboard: THREE.CanvasTexture;
  private dashCanvas = document.createElement('canvas');
  private dashValue = '';
  private wheelAngle = 0;
  readonly eye = new THREE.Vector3(-.4, 1.2, .2);
  ready: Promise<void> = Promise.resolve();
  assetReady = false;
  assetFailed = false;
  private rig?: PlayerCarRig;
  private rainGlass?: RainGlass;
  private retired = false;
  private activePolice = false;
  private damage = 0;
  constructor(color = '#394d71', readonly detailed = false, readonly kind: Agent['kind'] = 'sport') {
    const height = kind === 'suv' || kind === 'van' ? .3 : 0;
    this.group.add(this.body);
    if (!contactMaterial) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
      gradient.addColorStop(0, '#000000a0'); gradient.addColorStop(1, '#00000000'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
      contactMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    }
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.8), contactMaterial); contact.rotation.x = -Math.PI / 2; contact.position.y = .009; this.group.add(contact);

    if (!detailed && kind === 'police') {
      const rig = buildPoliceCar({ head: this.head, brake: this.brake, red: this.red, blue: this.blue });
      this.body.add(rig.group); this.wheels.push(...rig.wheels);
      this.dashCanvas.width = this.dashCanvas.height = 1;
      this.dashboard = new THREE.CanvasTexture(this.dashCanvas); this.dashboard.colorSpace = THREE.SRGBColorSpace;
      this.mirror = new THREE.Mesh(); this.setPolice(false); return;
    }
    const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .26, clearcoat: 1, clearcoatRoughness: .12 });

    // Bevelled, tapered body outline with a low hood and wide rear haunches.
    const outline = new THREE.Shape();
    outline.moveTo(-.83, -2.25); outline.lineTo(.83, -2.25); outline.lineTo(.97, -1.75);
    outline.lineTo(.98, 1.6); outline.lineTo(.8, 2.2); outline.lineTo(-.8, 2.2); outline.lineTo(-.98, 1.6); outline.lineTo(-.97, -1.75); outline.closePath();
    const shell = new THREE.ExtrudeGeometry(outline, { depth: .35, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .13, bevelThickness: .1 });
    shell.rotateX(Math.PI / 2); shell.translate(0, .82, 0);
    const chassis = new THREE.Mesh(shell, paint); chassis.castShadow = true; chassis.receiveShadow = true; this.body.add(chassis);
    if (!detailed) {
      this.body.remove(chassis); shell.dispose();
      const curved = new THREE.Mesh(coachwork(kind === 'van' ? 5.5 : 4.6, 1.95, .8), paint); curved.castShadow = curved.receiveShadow = true; this.body.add(curved);
      const windowMaterial = new THREE.MeshPhysicalMaterial({ color: '#102330', metalness: .38, roughness: .12, clearcoat: 1, side: THREE.DoubleSide });
      const roofY = kind === 'suv' || kind === 'van' ? 1.67 : 1.38;
      const roof = new THREE.Mesh(coachwork(1.65, 1.52, .14), paint); roof.position.set(0, roofY - .13, .14); this.body.add(roof);
      const addGlass = (p: number[]) => { const m = new THREE.Mesh(quad(p), windowMaterial); this.body.add(m); };
      addGlass([-.79,.8,-1.12, .79,.8,-1.12, .7,roofY-.1,-.65, -.7,roofY-.1,-.65]);
      addGlass([-.74,roofY-.1,.92, .74,roofY-.1,.92, .86,.82,1.45, -.86,.82,1.45]);
      for (const side of [-1, 1]) {
        addGlass([side*.86,.84,-.97, side*.75,roofY-.1,-.59, side*.75,roofY-.1,.84, side*.88,.84,1.25]);
        box(this.body, paint, side*.76, (roofY+.8)/2, .12, .055, roofY-.8, .07);
        box(this.body, chrome, side*.95, .79, .56, .02, .035, .22);
        box(this.body, paint, side*1.03, 1.01, -.72, .21, .12, .26);
      }
      box(this.body, this.head, 0, .64, -2.28, 1.35, .065, .04);
      box(this.body, this.brake, 0, .65, 2.29, 1.35, .065, .04);
      box(this.body, interior, 0, .39, -2.27, 1.25, .14, .07);
      box(this.body, interior, 0, .38, 2.28, 1.3, .14, .07);
      for (const x of [-.96, .96]) for (const z of [-1.38, 1.38]) {
        const pivot = new THREE.Group(); pivot.position.set(x, .35, z);
        const wheel = new THREE.Mesh(cylinder, tire); wheel.rotation.z = Math.PI / 2; pivot.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.235, .235, .24, 14), chrome); hub.rotation.z = Math.PI / 2; pivot.add(hub);
        this.group.add(pivot); this.wheels.push(pivot);
      }
      if (kind === 'truck') {
        const trailer = new THREE.Mesh(coachwork(7.7, 2.5, 2.9), paint); trailer.position.set(0, 0, 1.3); this.body.add(trailer);
        for (let z = -1; z < 4.9; z += .45) for (const side of [-1,1]) box(this.body, chrome, side*1.23, 1.7, z, .025, 1.8, .025);
      }
      this.dashCanvas.width = this.dashCanvas.height = 1; this.dashboard = new THREE.CanvasTexture(this.dashCanvas); this.dashboard.colorSpace = THREE.SRGBColorSpace; this.mirror = new THREE.Mesh(); return;
    }
    box(this.body, paint, 0, .77, -1.48, 1.65, .19, 1.35).rotation.x = -.08;
    box(this.body, interior, 0, .4, 0, 1.6, .2, 3.7);
    box(this.body, paint, 0, 1.65 + height, .23, 1.5, .1, 1.7);
    for (const side of [-1, 1]) {
      const pillar = box(this.body, paint, side * .76, 1.2 + height / 2, -.67, .07, .95 + height, .08); pillar.rotation.x = -.48;
      box(this.body, paint, side * .76, 1.22 + height / 2, .98, .08, .9 + height, .08).rotation.x = .35;
      box(this.body, paint, side * 1.05, 1.01, -.61, .25, .13, .33);
      box(this.body, chrome, side * .98, 1.02, -.53, .025, .08, .24);
      const mirrorGeometry = new THREE.PlaneGeometry(.2, .09), uv = mirrorGeometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (side < 0 ? .65 : 0) + uv.getX(i) * .35);
      const sideMirror = new THREE.Mesh(mirrorGeometry, new THREE.MeshBasicMaterial({ color: '#b9cdd9' }));
      sideMirror.position.set(side * 1.06, 1.035, -.43); this.body.add(sideMirror); this.sideMirrors.push(sideMirror);

      box(this.body, interior, side * .88, .69, .05, .1, .37, 1.7);
      box(this.body, chrome, side * .9, .91, .48, .035, .035, .21);
      box(this.body, this.head, side * .58, .72, -2.4, .49, .07, .05);
      box(this.body, this.brake, side * .6, .73, 2.37, .48, .075, .05);
      box(this.body, interior, side * .61, .38, 2.19, .2, .15, .09);
      for (const z of [-1.39, 1.37]) {
        const pivot = new THREE.Group(); pivot.position.set(side * .94, .36, z);
        const wheel = new THREE.Mesh(cylinder, tire); wheel.rotation.z = Math.PI / 2; pivot.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .235, 10), chrome); hub.rotation.z = Math.PI / 2; pivot.add(hub);
        for (let i = 0; i < 5; i++) {
          const spoke = box(pivot, interior, side * .123, 0, 0, .01, .39, .035); spoke.rotation.x = i * Math.PI / 5;
        }
        this.group.add(pivot); this.wheels.push(pivot);
      }
    }
    box(this.body, interior, 0, .5, -2.22, 1.22, .17, .06);
    const windshield = box(this.body, glass, 0, 1.24 + height / 2, -.86, 1.45, .84 + height, .015); windshield.rotation.x = -.5;
    const rear = box(this.body, new THREE.MeshPhysicalMaterial({ color: '#142639', metalness: .45, roughness: .1, transparent: true, opacity: .72 }), 0, 1.25 + height / 2, 1.1, 1.4, .74 + height, .015); rear.rotation.x = .35;
    for (const side of [-1, 1]) box(this.body, glass, side * .77, 1.3, .15, .014, .56, 1.46);
    box(this.body, paint, 0, .87, 1.65, 1.6, .12, 1);
    box(this.body, interior, 0, .43, 2.31, 1.5, .18, .08);
    box(this.body, this.brake, 0, .79, 2.38, .5, .025, .025);
    box(this.body, paint, 0, 1.01, 1.99, 1.64, .045, .25);
    box(this.body, interior, 0, .94, -.54, 1.5, .19, .48);
    for (const side of [-1, 1]) {
      box(this.body, interior, side * .4, .63, .36, .48, .28, .62);
      box(this.body, interior, side * .4, .91, .62, .48, .68, .18).rotation.x = -.13;
    }
    box(this.body, interior, 0, .7, .1, .25, .3, 1.15);
    this.steering.position.set(-.41, .95, -.23); this.steering.rotation.x = -.2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.16, .02, 8, 32), interior); this.steering.add(rim);
    box(this.steering, chrome, 0, 0, 0, .35, .035, .04); box(this.steering, interior, 0, -.09, 0, .04, .18, .045);
    this.body.add(this.steering);
    this.dashCanvas.width = 512; this.dashCanvas.height = 128;
    this.dashboard = new THREE.CanvasTexture(this.dashCanvas); this.dashboard.colorSpace = THREE.SRGBColorSpace;
    box(this.body, interior, -.4, 1.105, -.66, .48, .16, .14);
    const display = box(this.body, new THREE.MeshBasicMaterial({ map: this.dashboard }), -.4, 1.105, -.58, .42, .13, .012); display.rotation.x = -.15;
    this.mirror = box(this.body, new THREE.MeshBasicMaterial({ color: '#7997ac' }), 0, 1.32, -.61, .39, .13, .025);
    for (const x of [-.5, .15]) {
      const pivot = new THREE.Group(); pivot.position.set(x, .94, -1.06); pivot.rotation.x = -.5;
      box(pivot, interior, .13, .2, -.02, .025, .47, .025); this.body.add(pivot); this.wipers.push(pivot);
    }
    if (kind === 'truck') {
      const cargo = new THREE.MeshStandardMaterial({ color: '#a6abb1', roughness: .7 });
      box(this.body, cargo, 0, 1.6, 1.9, 2.3, 2.5, 5.4); this.group.scale.set(1.03, 1.05, 1.2);
    }
    this.updateDashboard(0, 1);
    this.body.visible=false;this.wheels.forEach(w=>w.visible=false);
    this.ready = this.loadPlayerCar(color);
  }
  private async loadPlayerCar(color: string): Promise<void> {
    try {
      const rig = await buildPlayerCar(color);
      if (this.retired) { rig.owned.forEach(g => g.dispose()); rig.unique.forEach(m => m.dispose()); return; }
      this.rig = rig; this.rainGlass = new RainGlass(rig); this.assetReady = true; this.eye.copy(rig.eye);
      this.body.visible = false; this.wheels.forEach(w => w.visible = false); this.group.add(rig.group);
      // Move the working instruments/mirrors into the loaded cockpit.
      const display = new THREE.Mesh(new THREE.PlaneGeometry(.34, .10), new THREE.MeshBasicMaterial({ map: this.dashboard }));
      display.position.set(-.335*rig.scale, .825*rig.scale, -.42*rig.scale); rig.group.add(display);
      this.mirror.removeFromParent(); this.mirror.geometry = rig.mirror; this.mirror.position.set(0, 0, 0); this.mirror.scale.set(1, 1, 1); rig.group.add(this.mirror);
      this.sideMirrors.forEach((m, i) => { m.removeFromParent(); m.geometry.dispose(); m.geometry = rig.sideMirrors[i]; m.position.set(0, 0, 0); rig.group.add(m); });
    } catch { this.assetFailed = true; this.body.visible=true;this.wheels.forEach(w=>w.visible=true); }
  }
  resetWeather(): void { this.rainGlass?.reset(); }
  get weatherDiagnostics() { return this.rainGlass?.diagnostics ?? { drops: 0, blades: 0 }; }
  setPolice(active: boolean): void {
    this.activePolice = active;
    if (!active && this.kind === 'police') { this.red.color.set('#302d35'); this.blue.color.set('#252e3d'); }
  }
  updateDashboard(speed: number, gear: number, rpm = 850): void {
    const value = `${Math.round(Math.abs(speed) * 3.6)}:${gear}:${Math.floor(rpm/200)}`; if (value === this.dashValue) return; this.dashValue = value;
    const ctx = this.dashCanvas.getContext('2d')!;
    ctx.fillStyle = '#081118'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffcf91'; ctx.font = 'bold 76px monospace'; ctx.textAlign = 'center'; ctx.fillText(value.split(':')[0], 205, 88);
    ctx.fillStyle = '#f9ce96'; ctx.font = '32px monospace'; ctx.fillText(gear < 0 ? 'R' : `D${gear}`, 430, 75); ctx.fillStyle='#4e5459';ctx.fillRect(35,108,440,4);ctx.fillStyle='#e9b979';ctx.fillRect(35,108,440*Math.min(1,rpm/7000),4); this.dashboard.needsUpdate = true;
  }
  animate(dt: number, time: number, speed: number, steer: number, braking: boolean, reduced = false, sheltered = false): void {
    this.wheelAngle += speed * dt / (this.kind === 'police' ? POLICE_SIZE.wheelRadius : .34);
    this.wheels.forEach((w, i) => { w.rotation.y = i % 2 === 0 ? steer : 0; for (const child of w.children) child.rotation.x = this.wheelAngle; });
    this.steering.rotation.z = -steer * 5;
    this.brake.emissiveIntensity = braking ? 4 : .75;
    if (this.kind === 'police' && !this.activePolice) { this.red.color.set('#302d35'); this.blue.color.set('#252e3d'); }
    this.wipers.forEach((w, i) => w.rotation.z = reduced ? -.6 : -.6 + Math.sin(time * 3.8 + i * .1) * .65);
    if (this.rig) {
      this.rig.wheels.forEach((w, i) => w.rotation.y = i % 2 === 0 ? steer : 0); this.rig.spins.forEach(w => w.rotation.x = -this.wheelAngle);
      this.rig.steering.quaternion.setFromAxisAngle(new THREE.Vector3(0, -.35, 1).normalize(), -steer * 5);
      this.rig.wipers.forEach((w, i) => w.quaternion.setFromAxisAngle(new THREE.Vector3(...WIPER_AXIS).normalize(), wiperSweep(time, i, reduced)));
      this.rig.lamps.forEach(m => m.emissiveIntensity = braking ? 4 : .7);
      this.rainGlass?.update(dt, speed, sheltered, reduced);
    }
    if (this.kind === 'police' && this.activePolice) { this.red.color.set(time % .6 < .3 ? '#ff253a' : '#300409'); this.blue.color.set(time % .6 >= .3 ? '#1675ff' : '#030e34'); }
  }
  updatePlayer(vehicle: Vehicle): void {
    this.damage = vehicle.damage;
    if (this.rig) { this.rig.damage.value=vehicle.damage/100;this.rig.headlamps.forEach(m=>m.emissiveIntensity=vehicle.headlights?2.5:.02); this.rig.group.rotation.set(vehicle.pitch, 0, vehicle.roll); this.rig.paint.forEach(m => m.roughness = .21 + this.damage * .002); }
    this.body.rotation.set(vehicle.pitch, 0, vehicle.roll); this.updateDashboard(vehicle.speed, vehicle.speed < -.2 ? -1 : vehicle.gear, vehicle.rpm); }
  dispose(): void {
    this.retired = true; this.rainGlass?.dispose(); this.rig?.unique.forEach(m => m.dispose()); this.rig?.owned.forEach(g => g.dispose());
    this.group.traverse(o => { if (o instanceof THREE.Mesh && o.geometry !== geometry && o.geometry !== cylinder && !isSharedPoliceResource(o.geometry)) o.geometry.dispose(); });
    this.dashboard.dispose();
    // Shared paints are bounded by the traffic pool; dispose unique per-car materials.
    const materials = new Set<THREE.Material>(); this.group.traverse(o => { if (o instanceof THREE.Mesh) materials.add(o.material as THREE.Material); });
    for (const m of materials) if (m !== contactMaterial && !isSharedPoliceResource(m) && ![tire, chrome, interior, glass].includes(m as THREE.MeshStandardMaterial)) m.dispose();
  }
}
