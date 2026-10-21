import * as THREE from 'three';
import { damp, type View } from './config';
import { sceneZ, road } from './road';
import type { Vehicle, Pose } from './vehicle';
export class DriveCamera {
  readonly camera = new THREE.PerspectiveCamera(62, 1, .035, 2400);
  private focus = new THREE.Vector3();
  private position = new THREE.Vector3();
  private initialized = false;
  private origin = 0;
  reset(): void { this.initialized = false; }
  resize(w: number, h: number): void { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(dt: number, player: Vehicle, pose: Pose, origin: number, view: View, rear: boolean, reduced: boolean, eye = new THREE.Vector3(-.4, 1.2, .2)): void {
    if (this.initialized && this.origin !== origin) { const shift = origin - this.origin; this.camera.position.z += shift; this.focus.z += shift; }
    this.origin = origin;
    // During a slide the chase view follows momentum, making the car's yaw visible.
    const followYaw = view === 'chase' ? pose.yaw - player.slipAngle * Math.min(1, player.driftAmount * 1.5) : pose.yaw;
    const z = sceneZ(pose.s, origin), sin = Math.sin(followYaw), cos = Math.cos(followYaw);
    if (view === 'cockpit') {
      this.position.set(pose.x + eye.x * cos - sin * eye.z, eye.y, z + eye.x * sin + cos * eye.z);
      this.focus.set(pose.x + sin * (rear ? -50 : 80), eye.y, z - cos * (rear ? -50 : 80));
      // Driver eye stays inside the moving cockpit during a view transition.
      if (rear) this.position.set(pose.x - sin * 2.6, 1.6, z + cos * 2.6);
      this.camera.position.copy(this.position); this.focus.y = rear ? 1.6 : eye.y;
    } else {
      const distance = (rear ? -1 : 1) * (7.5 + Math.abs(player.speed) * .025);
      this.position.set(pose.x - sin * distance, 3.25 + Math.abs(player.speed) * .006, z + cos * distance);
      this.focus.set(pose.x + sin * (rear ? -18 : 20), 1.05, z - cos * (rear ? -18 : 20));
      // Keep the chase eye inside the traversable road envelope.
      this.position.x = road.constrain(this.position.x, pose.s - distance);
      if (!this.initialized || rear) this.camera.position.copy(this.position);
      else this.camera.position.lerp(this.position, 1 - Math.exp(-dt * 11));
    }
    if (view === 'chase' && !reduced && player.impact > .01) {
      const kick = player.impact * Math.sin(player.s * 17 + player.impact * 50);
      this.camera.position.x += kick * .045; this.camera.position.y += kick * .028;
    }
    this.camera.lookAt(this.focus);
    this.camera.fov = view==='cockpit' ? 71 : damp(this.camera.fov,59+(reduced?0:Math.min(8,Math.abs(player.speed)*.1)),4,dt);
    this.camera.updateProjectionMatrix(); this.initialized = true;
  }
}
