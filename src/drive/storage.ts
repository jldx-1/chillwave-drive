import type { Density, Quality, View } from './config';
import type { MusicStyle } from '../core/types';
export interface Preferences { view: View; quality: Quality; density: Density; sensitivity: number; musicVolume: number; effectsVolume: number; musicStyle: MusicStyle; musicEnabled: boolean; reducedMotion: boolean }
export const preferences: Preferences = { view: 'chase', quality: 'high', density: 'normal', sensitivity: 1, musicVolume: .36, effectsVolume: .5, musicStyle: 'chillwave', musicEnabled: true, reducedMotion: false };
export interface Result { distance: number; topSpeed: number; time: number; nearMisses: number; level: number; detours: number }
export class Records {
  settings = { ...preferences };
  best = 0; runs = 0;
  available = true;
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try {
      if (!this.storage) this.storage = window.localStorage;
      const storage = this.storage;
      const saved = JSON.parse(storage.getItem('chillwave-drive:settings:v1') || '{}');
      for (const [key, allowed] of Object.entries({ view: ['chase', 'cockpit'], quality: ['low', 'medium', 'high', 'ultra'], density: ['low', 'normal', 'high', 'dense'], musicStyle: ['chillwave', 'vaporwave', 'mixed'] })) {
        if (allowed.includes(saved[key])) Object.assign(this.settings, { [key]: saved[key] });
      }
      for (const key of ['musicVolume', 'effectsVolume', 'sensitivity'] as const) {
        if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) this.settings[key] = Math.max(key === 'sensitivity' ? .5 : 0, Math.min(key === 'sensitivity' ? 1.5 : 1, saved[key]));
      }
      for (const key of ['musicEnabled', 'reducedMotion'] as const) if (typeof saved[key] === 'boolean') this.settings[key] = saved[key];
      const record = JSON.parse(storage.getItem('chillwave-drive:record:v1') || '{}');
      this.best = typeof record.best === 'number' && Number.isFinite(record.best) ? Math.max(0, record.best) : 0;
      this.runs = typeof record.runs === 'number' && Number.isFinite(record.runs) ? Math.max(0, record.runs) : 0;
    } catch { this.available = false; }
  }
  save(): void { try { this.storage?.setItem('chillwave-drive:settings:v1', JSON.stringify(this.settings)); } catch { this.available = false; } }
  finish(result: Result): void {
    this.best = Math.max(this.best, result.distance); this.runs++;
    try { this.storage?.setItem('chillwave-drive:record:v1', JSON.stringify({ best: this.best, runs: this.runs })); } catch { this.available = false; }
  }
}
