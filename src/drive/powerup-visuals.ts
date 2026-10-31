import * as THREE from 'three';
import type { PowerUp } from './powerups';
import type { Vehicle, Pose } from './vehicle';
import { sceneZ } from './road';

/** Shared geometry and a bounded pool keep streamed collectibles inexpensive. */
export class PowerUpVisuals {
  readonly group = new THREE.Group();
  private items = new Map<number, THREE.Group>();
  private gem = new THREE.OctahedronGeometry(.75);
  private ring = new THREE.TorusGeometry(1.1, .055, 6, 24);
  private materials = {
    shield: new THREE.MeshBasicMaterial({ color: '#55f7d4', toneMapped: false }),
    turbo: new THREE.MeshBasicMaterial({ color: '#ffb34f', toneMapped: false }),
  };
  private shieldMaterial = new THREE.MeshBasicMaterial({ color: '#4be8ff', transparent: true, opacity: .13, wireframe: true, depthWrite: false });
  private bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), this.shieldMaterial);
  get shieldPose(){return {visible:this.bubble.visible,x:this.bubble.position.x,z:this.bubble.position.z,y:this.bubble.position.y,yaw:this.bubble.rotation.y,opacity:this.shieldMaterial.opacity};}
  constructor() { this.group.add(this.bubble); this.bubble.visible = false; }
  update(items: PowerUp[], vehicle: Vehicle, origin: number, reduced: boolean, pose:Pose=vehicle.pose(1)): void {
    const live = new Set(items.map(item => item.id));
    for (const [id, group] of this.items) if (!live.has(id)) { this.group.remove(group); this.items.delete(id); }
    for (const item of items) {
      let group = this.items.get(item.id);
      if (!group) {
        group = new THREE.Group(); group.name = `pickup-${item.kind}`;
        const core = new THREE.Mesh(this.gem, this.materials[item.kind]);
        if (item.kind === 'turbo') core.scale.set(.55, 1.5, .55);
        const halo = new THREE.Mesh(this.ring, this.materials[item.kind]);
        group.add(core, halo); this.items.set(item.id, group); this.group.add(group);
      }
      group.position.set(item.x, 1.35 + (reduced ? 0 : Math.sin(vehicle.simulationTime * 2 + item.id) * .15), sceneZ(item.s, origin));
      group.rotation.y = reduced ? 0 : vehicle.simulationTime * 1.4;
    }
    this.bubble.visible = vehicle.shield > 0 && !vehicle.exploded;
    this.bubble.position.set(pose.x, .9+(pose.height??0), sceneZ(pose.s, origin));
    this.bubble.rotation.y = -pose.yaw; this.bubble.scale.set(1.45, 1.3, 2.8);
    this.shieldMaterial.opacity = .16*Math.min(1,vehicle.shield/.35);
  }
}
