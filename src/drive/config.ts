import { COLLISION_PROFILES } from './collision-profiles';
import { VEHICLE_CATALOG } from './vehicle-catalog';
export const STEP = 1 / 60;
export const LANES = [2.9, 6.5, 10.1, 13.7];
export const ONCOMING = [-2.9, -6.5, -10.1, -13.7];
export const POLICE_SIZE = { width: COLLISION_PROFILES.police.width, length: COLLISION_PROFILES.police.length, wheelRadius: VEHICLE_CATALOG.police.wheelRadius } as const;
/** Collision shapes and independent GLB scale use the same pure catalog. */
export const VEHICLE_DIMENSIONS = { ...COLLISION_PROFILES, van: { width: 2, length: 5.5 } } as const;
export const TUNE = {
  damagePowerLoss: 0, mass: 1480, wheelbase: 2.7, engineForce: 10300, brakeForce: 17800,
  drag: .44, rolling: 210, wetGrip: .74, dryGrip: 1.02,
  maxSpeed: 78, width: COLLISION_PROFILES.player.width, length: COLLISION_PROFILES.player.length, footprint: COLLISION_PROFILES.player.hull, driveFalloffSpeed: 100, brakeDriftAssist: true, steerResponse: 24, steerReturn: 34, steerSlew: 3.6, cornerAssist: 1.3,
};
export type VehicleTuning = typeof TUNE;
/** The pursuit SUV uses the same tire/force equations with its own mass and powertrain. */
export const POLICE_TUNE: VehicleTuning = {
  ...TUNE, damagePowerLoss: .0035, mass: VEHICLE_CATALOG.police.mass, wheelbase: VEHICLE_CATALOG.police.wheelbase, engineForce: 26000, brakeForce: 31000,
  drag: .48, rolling: 250, wetGrip: .9, maxSpeed: 94, steerResponse:18, steerReturn:26, steerSlew:2.4,
  width: POLICE_SIZE.width, length: POLICE_SIZE.length, footprint: COLLISION_PROFILES.police.hull, driveFalloffSpeed: 150,
  brakeDriftAssist: false, cornerAssist: 1.12,
};
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export type View = 'chase' | 'cockpit';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Density = 'low' | 'normal' | 'high' | 'dense';
export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; rear: boolean }
export const neutral = (): Controls => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, rear: false });
