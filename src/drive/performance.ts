import type { Quality } from './config';

/** Fixed pixel density for the chosen preset; frame rate never changes image quality. */
export function qualityPixelRatio(quality: Quality, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, { low: 1, medium: 1, high: 1.25, ultra: 1.5 }[quality]);
}
