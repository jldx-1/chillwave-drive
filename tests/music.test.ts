import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MUSIC, arrangementFor, beatPulse, stemLevels } from '../src/effects/music-mix';
import { MusicSystem } from '../src/effects/music';

class Param {
  value = 0;
  targets: { value: number; time: number; decay: number }[] = [];
  cancelAndHoldAtTime() { return this; }
  setTargetAtTime(value: number, time: number, decay: number) { this.value = value; this.targets.push({ value, time, decay }); return this; }
}
class Gain {
  gain = new Param();
  connect() { return this; }
  disconnect() {}
}
class Source {
  buffer?: AudioBuffer;
  loop = false; loopStart = 0; loopEnd = 0;
  started?: [number, number]; stopped = false;
  start(time: number, offset: number) { this.started = [time, offset]; }
  stop() { this.stopped = true; }
  connect() {}
  disconnect() {}
}
function context() {
  const sources: Source[] = [], gains: Gain[] = [];
  const clock = {
    currentTime: 0, sampleRate: 48000, state: 'running', sources, gains,
    createGain: () => { const g = new Gain(); gains.push(g); return g; },
    createConvolver: () => ({ connect() {}, disconnect() {}, buffer: null }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    decodeAudioData: async () => ({ duration: MUSIC.duration }),
    createBufferSource: () => { const s = new Source(); sources.push(s); return s; },
  };
  return clock;
}
const loader = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) as Response;
function setup() { const clock = context(); return { clock, music: new MusicSystem(clock as unknown as AudioContext, new Gain() as unknown as AudioNode, () => {}, loader) }; }

describe('adaptive soundtrack', () => {
  it('uses exact intensity boundaries and never removes the ambient foundation', () => {
    expect(stemLevels(0)).toEqual([.9, 0, 0, 0]); expect(stemLevels(24.99)).toEqual(stemLevels(0));
    expect(stemLevels(25)).toEqual([.9, .8, 0, 0]); expect(stemLevels(49.99)).toEqual(stemLevels(25));
    expect(stemLevels(50)).toEqual([.9, .8, .72, 0]); expect(stemLevels(74.99)).toEqual(stemLevels(50));
    expect(stemLevels(75)).toEqual([.9, .8, .72, .62]); expect(stemLevels(100)).toEqual(stemLevels(999));
  });
  it('shares a fixed musical clock across beats, loops and Mixed arrangements', () => {
    expect(arrangementFor('mixed', 0)).toBe('chillwave');
    expect(arrangementFor('mixed', MUSIC.duration + .1)).toBe('vaporwave');
    expect(arrangementFor('mixed', MUSIC.duration * 2 + .1)).toBe('chillwave');
    expect(arrangementFor('vaporwave', 0)).toBe('vaporwave');
    expect(beatPulse(0)).toBe(1); expect(beatPulse(MUSIC.duration)).toBeCloseTo(1);
    expect(beatPulse(MUSIC.duration / MUSIC.beats / 2)).toBeLessThan(.05);
  });
  it('starts four native loops simultaneously and fades stems without restarting sources', async () => {
    const { music, clock } = setup(); await music.prepare('chillwave'); music.start();
    expect(clock.sources).toHaveLength(4);
    expect(clock.sources.every(s => s.loop && s.loopEnd === MUSIC.duration)).toBe(true);
    expect(clock.sources.map(s => s.started)).toEqual(Array(4).fill([.04, 0]));
    music.setFlow(90); const rising = clock.gains.flatMap(g => g.gain.targets).filter(t => t.decay === .85);
    expect(rising.length).toBeGreaterThanOrEqual(4);
    const initialFalls = clock.gains.flatMap(g => g.gain.targets).filter(t => t.decay === 1.8 && t.value === 0).length;
    music.setFlow(0); const falling = clock.gains.flatMap(g => g.gain.targets).filter(t => t.decay === 1.8 && t.value === 0);
    expect(falling.length - initialFalls).toBe(3); expect(clock.sources).toHaveLength(4);
    const calls = clock.gains.flatMap(g => g.gain.targets).length; music.setFlow(0);
    expect(clock.gains.flatMap(g => g.gain.targets)).toHaveLength(calls);
  });
  it('joins a new arrangement at the current phase and crossfades both buses', async () => {
    const { music, clock } = setup(); await music.prepare('chillwave'); music.start();
    clock.currentTime = 7; await music.prepare('vaporwave');
    expect(clock.sources).toHaveLength(8);
    for (const source of clock.sources.slice(4)) { expect(source.started![0]).toBeCloseTo(7.04); expect(source.started![1]).toBeCloseTo(7); }
    const buses = clock.gains.filter(g => g.gain.targets.some(t => t.decay === 1.5));
    expect(buses).toHaveLength(2); expect(buses.map(g => g.gain.value)).toEqual([0, 1]);
    for (const bus of buses) expect(bus.gain.targets.at(-1)!.time).toBeCloseTo(7.04);
    await music.prepare('mixed'); music.start(); expect(clock.sources).toHaveLength(8);
    clock.currentTime = MUSIC.duration + .05; music.update(.1, true);
    expect(buses.map(g => g.gain.value)).toEqual([0, 1]);
  });
  it('freezes beat position when the audio clock is suspended and respects visual gating', async () => {
    const { music, clock } = setup(); await music.prepare('chillwave'); music.start(); clock.currentTime = 4; music.setFlow(90);
    const position = music.elapsed; expect(music.update(.1, true).playing).toBe(true);
    clock.state = 'suspended'; const frame = music.update(10, true);
    expect(music.elapsed).toBe(position); expect(frame).toEqual({ pulse: 0, intensity: 0, playing: false });
    clock.state = 'running'; expect(music.update(.1, true).playing).toBe(true); expect(music.update(.1, false).pulse).toBe(0);
  });
  it('keeps the previous arrangement on a load failure and can retry', async () => {
    const clock = context(); let failed = false;
    const music = new MusicSystem(clock as unknown as AudioContext, new Gain() as unknown as AudioNode, () => {}, async () => failed ? ({ ok: false }) as Response : loader());
    await music.prepare('chillwave'); music.start(); failed = true;
    expect(await music.prepare('vaporwave')).toBe(false); expect(music.currentStatus).toBe('unavailable'); expect(clock.sources).toHaveLength(4);
    failed = false; expect(await music.prepare('vaporwave')).toBe(true); expect(clock.sources).toHaveLength(8);
    music.dispose(); expect(clock.sources.every(s => s.stopped)).toBe(true);
  });
  it('ships eight equal-length PCM loops with safe levels and no spliced silence', () => {
    for (const style of ['chillwave', 'vaporwave']) for (const stem of MUSIC.stems) {
      const file = readFileSync(new URL(`../public/audio/${style}-${stem}.wav`, import.meta.url));
      expect(file.toString('ascii', 0, 4)).toBe('RIFF'); expect(file.readUInt32LE(24)).toBe(MUSIC.sampleRate);
      expect(file.readUInt32LE(40)).toBe(MUSIC.frames * 2);
      let energy = 0, peak = 0;
      for (let i = 44; i < file.length; i += 2) { const sample = file.readInt16LE(i) / 32768; energy += sample ** 2; peak = Math.max(peak, Math.abs(sample)); }
      expect(peak).toBeLessThan(.8); expect(energy / MUSIC.frames).toBeGreaterThan(.00001);
      expect(Math.abs(file.readInt16LE(44) - file.readInt16LE(file.length - 2)) / 32768).toBeLessThan(.035);
    }
  });
});
