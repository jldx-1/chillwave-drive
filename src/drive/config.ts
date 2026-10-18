export const STEP = 1 / 60;
export const LANES = [2.9, 6.5, 10.1, 13.7];
export const ONCOMING = [-2.9, -6.5, -10.1, -13.7];
export const POLICE_SIZE = { width: 2.06, length: 5.35, wheelRadius: .405 } as const;
export const TUNE = {
  mass: 1480, wheelbase: 2.7, engineForce: 10300, brakeForce: 17800,
  drag: .44, rolling: 210, wetGrip: .74, dryGrip: 1.02,
  maxSpeed: 78, width: 1.95, length: 4.6, steerResponse: 18, steerReturn: 26, steerSlew: 2.4, cornerAssist: 1.3,
};
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export type View = 'chase' | 'cockpit';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Density = 'low' | 'normal' | 'high' | 'dense';
export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean; rear: boolean }
export const neutral = (): Controls => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, rear: false });
