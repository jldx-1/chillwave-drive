export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
