import type { Density, Quality, View } from './config';
import { RADIO_VIDEO_URL,youtubeVideoId,youtubeVideoURL } from './youtube-source';
export interface Preferences { view: View; quality: Quality; density: Density; sensitivity: number; musicVolume: number; effectsVolume: number; musicVideoUrl:string;musicEnabled: boolean; reducedMotion: boolean }
export const preferences: Preferences = { view: 'chase', quality: 'medium', density: 'normal', sensitivity: 1, musicVolume: .36, effectsVolume: .5, musicVideoUrl:RADIO_VIDEO_URL,musicEnabled: true, reducedMotion: false };
export interface Result { distance: number; topSpeed: number; time: number; nearMisses: number; level: number; detours: number; score?:number; hits?:number }
export class Records {
  settings = { ...preferences };
  best = 0; runs = 0; bestScore=0;
  available = true;
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem'>, mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    if (mobile) { this.settings.quality = 'low'; this.settings.density = 'low'; }
    try {
      if (!this.storage) this.storage = window.localStorage;
      const storage = this.storage;
      const saved = JSON.parse(storage.getItem('chillwave-drive:settings:v1') || '{}');
      const video=typeof saved.musicVideoUrl==='string'?youtubeVideoId(saved.musicVideoUrl):undefined;
      if(video)this.settings.musicVideoUrl=youtubeVideoURL(video);
      for (const [key, allowed] of Object.entries({ view: ['chase', 'cockpit'], quality: ['low', 'medium', 'high', 'ultra'], density: ['low', 'normal', 'high', 'dense'] })) {
        if (allowed.includes(saved[key])) Object.assign(this.settings, { [key]: saved[key] });
      }
      for (const key of ['musicVolume', 'effectsVolume', 'sensitivity'] as const) {
        if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) this.settings[key] = Math.max(key === 'sensitivity' ? .5 : 0, Math.min(key === 'sensitivity' ? 1.5 : 1, saved[key]));
      }
      for (const key of ['musicEnabled', 'reducedMotion'] as const) if (typeof saved[key] === 'boolean') this.settings[key] = saved[key];
      const record = JSON.parse(storage.getItem('chillwave-drive:record:v1') || '{}');
      this.best = typeof record.best === 'number' && Number.isFinite(record.best) ? Math.max(0, record.best) : 0;
      this.bestScore=typeof record.bestScore==='number'&&Number.isFinite(record.bestScore)?Math.max(0,record.bestScore):0;
      this.runs = typeof record.runs === 'number' && Number.isFinite(record.runs) ? Math.max(0, record.runs) : 0;
    } catch { this.available = false; }
  }
  save(): void { try { this.storage?.setItem('chillwave-drive:settings:v1', JSON.stringify(this.settings)); } catch { this.available = false; } }
  finish(result: Result): void {
    this.best = Math.max(this.best, result.distance); this.bestScore=Math.max(this.bestScore,result.score??0); this.runs++;
    try { this.storage?.setItem('chillwave-drive:record:v1', JSON.stringify({ best: this.best, runs: this.runs, bestScore:this.bestScore })); } catch { this.available = false; }
  }
}
