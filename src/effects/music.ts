import type { MusicStyle } from '../core/types';
import { damp } from '../core/config';
import { MUSIC, arrangementFor, beatPulse, fade, silentMusic, stemLevels, type Arrangement, type MusicFrame, type MusicStatus } from './music-mix';

interface Bank { buffers: AudioBuffer[]; bus: GainNode; gains: GainNode[]; sources: AudioBufferSourceNode[] }
const arrangements: Arrangement[] = ['chillwave', 'vaporwave'];

/** Audio-thread loops share one clock; rendering only changes their mix. */
export class MusicSystem {
  private banks = new Map<Arrangement, Bank>();
  private loading = new Map<Arrangement, Promise<void>>();
  private active = false;
  private disposed = false;
  private epoch = 0;
  private availableAt = 0;
  private style: MusicStyle = 'chillwave';
  private desired: MusicStyle = 'chillwave';
  private targetArrangement?: Arrangement;
  private targets: readonly number[] = [];
  private flow = 0;
  private intensity = 0;
  private frame: MusicFrame = silentMusic();
  private request = 0;
  private status: MusicStatus = 'locked';
  private dry: GainNode;
  private wet: GainNode;
  private reverb: ConvolverNode;

  constructor(private context: AudioContext, destination: AudioNode,
    private onStatus: (status: MusicStatus) => void = () => {},
    private fetchAsset: typeof fetch = (...args) => fetch(...args)) {
    this.dry = context.createGain(); this.dry.gain.value = 0.88; this.dry.connect(destination);
    this.wet = context.createGain(); this.wet.gain.value = 0.18; this.wet.connect(destination);
    this.reverb = context.createConvolver(); this.reverb.connect(this.wet);
    const length = Math.round(context.sampleRate * 1.6);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    // One short stereo room shared by all stems, with no per-frame DSP work.
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3 * 0.2;
    }
    this.reverb.buffer = impulse;
  }
  async prepare(style: MusicStyle): Promise<boolean> {
    this.desired = style;
    const request = ++this.request;
    this.setStatus('loading');
    try {
      await Promise.all((style === 'mixed' ? arrangements : [style]).map(s => this.load(s)));
      if (request !== this.request) return false;
      this.style = style;
      if (this.active) {
        for (const bank of this.banks.values()) this.startBank(bank);
        this.mix(true);
      }
      this.setStatus('ready'); return true;
    } catch {
      if (request === this.request) this.setStatus('unavailable');
      return false; // Existing arrangement and sound effects remain usable.
    }
  }
  start(): void {
    if (this.active || !this.banks.has(this.style === 'mixed' ? 'chillwave' : this.style)) return;
    this.epoch = this.context.currentTime + 0.04; this.active = true;
    for (const bank of this.banks.values()) this.startBank(bank);
    this.setFlow(this.flow, true); this.mix(true);
  }
  setFlow(flow: number, force = false): void {
    this.flow = flow;
    const levels = stemLevels(flow);
    for (let i = 0; i < levels.length; i++) {
      if (!force && levels[i] === this.targets[i]) continue;
      const previous = this.targets[i] ?? 0;
      for (const bank of this.banks.values()) fade(bank.gains[i].gain, levels[i], this.context.currentTime, levels[i] > previous ? 0.85 : 1.8);
    }
    this.targets = levels;
  }
  update(dt: number, audible: boolean): MusicFrame {
    if (this.active) this.mix();
    const playing = audible && this.active && this.context.state === 'running' && this.context.currentTime >= this.epoch;
    this.intensity = damp(this.intensity, playing ? Math.max(0, Math.min(1, this.flow / 100)) : 0, 1.2, dt);
    this.frame.playing = playing;
    this.frame.pulse = playing ? beatPulse(this.elapsed) : 0;
    this.frame.intensity = playing ? this.intensity : 0;
    return this.frame;
  }
  get elapsed(): number { return this.active ? Math.max(0, this.context.currentTime - this.epoch) : 0; }
  get currentStatus(): MusicStatus { return this.status; }
  get requestedStyle(): MusicStyle { return this.desired; }
  dispose(): void {
    this.disposed = true; this.request++; this.active = false;
    for (const bank of this.banks.values()) {
      bank.sources.forEach(s => { s.stop(); s.disconnect(); });
      bank.gains.forEach(g => g.disconnect()); bank.bus.disconnect();
    }
    this.banks.clear(); this.reverb.disconnect(); this.dry.disconnect(); this.wet.disconnect();
  }
  private async load(style: Arrangement): Promise<void> {
    if (this.banks.has(style)) return;
    if (this.loading.has(style)) return this.loading.get(style)!;
    const job = (async () => {
      const buffers = await Promise.all(MUSIC.stems.map(async stem => {
        const response = await this.fetchAsset(`${import.meta.env.BASE_URL}audio/${style}-${stem}.wav`);
        if (!response.ok) throw new Error('Soundtrack asset unavailable');
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        // Catch accidental mismatched or truncated assets before they can drift.
        if (Math.abs(buffer.duration - MUSIC.duration) > 2 / this.context.sampleRate) throw new Error('Soundtrack length mismatch');
        return buffer;
      }));
      if (this.disposed) throw new Error('Music disposed');
      const bus = this.context.createGain(); bus.gain.value = 0; bus.connect(this.dry); bus.connect(this.reverb);
      const gains = buffers.map((_, i) => { const gain = this.context.createGain(); gain.gain.value = this.targets[i] ?? 0; gain.connect(bus); return gain; });
      this.banks.set(style, { buffers, bus, gains, sources: [] });
    })();
    this.loading.set(style, job);
    try { await job; } finally { this.loading.delete(style); }
  }
  private startBank(bank: Bank): void {
    if (bank.sources.length) return;
    const when = Math.max(this.epoch, this.context.currentTime + 0.04);
    const offset = (when - this.epoch) % MUSIC.duration;
    this.availableAt = Math.max(this.availableAt, when);
    for (let i = 0; i < bank.buffers.length; i++) {
      const source = this.context.createBufferSource(); source.buffer = bank.buffers[i];
      source.loop = true; source.loopStart = 0; source.loopEnd = MUSIC.duration;
      source.connect(bank.gains[i]); source.start(when, offset); bank.sources.push(source);
    }
  }
  private mix(force = false): void {
    const target = arrangementFor(this.style, this.elapsed);
    if (!force && target === this.targetArrangement) return;
    this.targetArrangement = target;
    for (const [style, bank] of this.banks) fade(bank.bus.gain, style === target ? 1 : 0, Math.max(this.context.currentTime, this.availableAt), 1.5);
  }
  private setStatus(status: MusicStatus): void { this.status = status; this.onStatus(status); }
}
