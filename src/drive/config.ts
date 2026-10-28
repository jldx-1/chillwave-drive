import { MPS_TO_MPH } from './units';
import { COLLISION_PROFILES } from './collision-profiles';
import { CYBER_VEHICLES,cyberHull } from './cyber-vehicles';
export const STEP = 1 / 60;
export const LANES = [2.9, 6.5, 10.1, 13.7];
export const ONCOMING = [-2.9, -6.5, -10.1, -13.7];
export const POLICE_SIZE = { width: CYBER_VEHICLES.vortex.width, length: CYBER_VEHICLES.vortex.length, wheelRadius: CYBER_VEHICLES.vortex.wheelRadius } as const;
/** Legacy asset envelopes for authoring/compatibility; runtime agents use CYBER_VEHICLES dimensions. */
export const VEHICLE_DIMENSIONS = { ...COLLISION_PROFILES, van: { width: 2, length: 5.5 } } as const;
export const TUNE = {
  damagePowerLoss: 0, mass: 1480, wheelbase: 2.7, engineForce: 10300, brakeForce: 17800,
  drag: .44, rolling: 210, wetGrip: .74, dryGrip: 1.02,
  maxSpeed: 180 / MPS_TO_MPH, width: CYBER_VEHICLES.nebula.width, length: CYBER_VEHICLES.nebula.length, footprint: cyberHull('nebula'), driveFalloffSpeed: 100, brakeDriftAssist: true, steerResponse: 32, steerReturn: 42, steerSlew: 4.8, cornerAssist: 1.42,
};
export type VehicleTuning = typeof TUNE;
/** Base interceptor tire/force controller; traffic applies each response model’s dimensions and powertrain. */
export const POLICE_TUNE: VehicleTuning = {
  ...TUNE, damagePowerLoss: .0035, mass: CYBER_VEHICLES.vortex.mass, wheelbase: CYBER_VEHICLES.vortex.wheelbase, engineForce: 36000, brakeForce: 34000,
  drag: .48, rolling: 250, wetGrip: 1.06, maxSpeed: CYBER_VEHICLES.vortex.speed, steerResponse:18, steerReturn:26, steerSlew:2.4,
  width: POLICE_SIZE.width, length: POLICE_SIZE.length, footprint: cyberHull('vortex'), driveFalloffSpeed: 180,
  brakeDriftAssist: false, cornerAssist: 1.26,
};
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export type View = 'chase' | 'cockpit';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Density = 'low' | 'normal' | 'high' | 'dense';
export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; rear: boolean; nitro?: boolean }
export const neutral = (): Controls => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, rear: false, nitro: false });
