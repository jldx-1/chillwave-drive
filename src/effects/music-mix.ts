import { clamp } from '../core/config';
import type { MusicStyle } from '../core/types';
import manifest from '../audio/manifest.json';

export const MUSIC = { ...manifest, stems: ['atmosphere', 'bass', 'melody', 'lift'] as const };
export type Arrangement = 'chillwave' | 'vaporwave';
export type MusicStatus = 'locked' | 'loading' | 'ready' | 'unavailable';
export interface MusicFrame { pulse: number; intensity: number; playing: boolean }
export const silentMusic = (): MusicFrame => ({ pulse: 0, intensity: 0, playing: false });

export function stemLevels(flow: number): readonly number[] {
  const level = clamp(flow, 0, 100);
  return [0.9, level >= 25 ? 0.8 : 0, level >= 50 ? 0.72 : 0, level >= 75 ? 0.62 : 0];
}
export function arrangementFor(style: MusicStyle, elapsed: number): Arrangement {
  return style === 'mixed' ? (Math.floor(Math.max(0, elapsed) / MUSIC.duration) % 2 ? 'vaporwave' : 'chillwave') : style;
}
export function beatPulse(elapsed: number): number {
  const beats = Math.max(0, elapsed) * MUSIC.beats / MUSIC.duration;
  return Math.exp(-(beats - Math.floor(beats)) * 7);
}
// Preserve the instantaneous envelope when a new setting interrupts a fade.
export function fade(param: AudioParam, target: number, now: number, seconds: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
  param.setTargetAtTime(target, now, seconds);
}
