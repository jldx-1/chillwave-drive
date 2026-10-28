import * as THREE from 'three';
import { fade } from '../effects/music-mix';
import type { Preferences } from './storage';
import type { Vehicle } from './vehicle';
import type { Traffic } from './traffic';
interface Siren { source: OscillatorNode; panner: PannerNode; gain: GainNode }
/** Original synthesized driving sounds; licensed recorded engines can replace these voices. */
export class DriveAudio {
  private context?: AudioContext;
  private master?: GainNode; private effects?: GainNode; private cabin?: BiquadFilterNode;
  private engine: { osc: OscillatorNode; gain: GainNode }[] = [];
  private sirens = new Map<number, Siren>();
  private passby: Siren[] = [];
  private noise?: GainNode; private tire?: GainNode; private skid?: GainNode;
  private impactNoise?: AudioBuffer;
  private lastGear = 1;
  private paused = true;
  private suspend?: ReturnType<typeof setTimeout>;
  status = 'Click Start Drive to enable audio';
  private settings?: Preferences;
  async unlock(settings: Preferences): Promise<void> {
    try {
      if (this.suspend) clearTimeout(this.suspend);
      if (!this.context) this.initialize();
      this.paused = false; await this.context!.resume(); this.configure(settings);
      fade(this.master!.gain, 1, this.context!.currentTime, .05);

    } catch { this.status = 'Audio unavailable; driving remains available'; }
  }
  private initialize(): void {
    const ctx = this.context = new AudioContext();
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 4; limiter.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(limiter);
    this.effects = ctx.createGain(); this.cabin = ctx.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 12000;
    this.effects.connect(this.cabin); this.cabin.connect(this.master);
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = i === 0 ? 'sine' : i === 1 ? 'triangle' : 'sawtooth';
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = i < 2 ? 500 : 1100;
      gain.gain.value = 0; osc.connect(filter); filter.connect(gain); gain.connect(this.effects); osc.start(); this.engine.push({ osc, gain });
    }
    for (let i = 0; i < 6; i++) {
      const source = ctx.createOscillator(), panner = ctx.createPanner(), gain = ctx.createGain();
      source.type = 'triangle'; source.frequency.value = 80;
      panner.panningModel = 'HRTF'; panner.refDistance = 3; panner.rolloffFactor = 1.6;
      gain.gain.value = 0; source.connect(gain); gain.connect(panner); panner.connect(this.effects); source.start();
      this.passby.push({ source, panner, gain });
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) { previous = previous * .4 + (Math.random() * 2 - 1) * .6; data[i] = previous; }
    this.impactNoise = buffer;
    for (const [key, cutoff] of [['noise', 5000], ['tire', 1700], ['skid', 850]] as const) {
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = key === 'skid' ? 'bandpass' : 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = key === 'skid' ? 8 : .5;
      const gain = ctx.createGain(); gain.gain.value = 0; source.connect(filter); filter.connect(gain); gain.connect(this.effects); source.start(); this[key] = gain;
    }
  }
  configure(settings: Preferences): void {
    this.settings = { ...settings }; if (!this.context) return;
    const now = this.context.currentTime;
    fade(this.effects!.gain, settings.effectsVolume, now, .1);
  }
  pause(tail = 0): void {
    this.paused = true; if (!this.context) return;
    if (this.suspend) clearTimeout(this.suspend);
    fade(this.master!.gain, 0, this.context.currentTime + tail, .015);
    this.suspend = setTimeout(() => { if (this.paused) void this.context?.suspend(); }, 100 + tail * 1000);
  }
  impact(severity = 15): void {
    const ctx = this.context; if (!ctx || this.paused) return;
    if(this.impactNoise){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.impactNoise;filter.type='lowpass';filter.frequency.value=700+Math.min(2500,severity*90);source.connect(filter);filter.connect(gain);gain.connect(this.effects!);gain.gain.setValueAtTime(Math.min(.5,.08+severity*.012),ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.28);source.start();source.stop(ctx.currentTime+.3);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(100, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + .18);
    g.gain.setValueAtTime(.35, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .2);
    o.connect(g); g.connect(this.effects!); o.start(); o.stop(ctx.currentTime + .21); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  update(player: Vehicle, traffic: Traffic, throttle: number, camera: THREE.PerspectiveCamera, origin: number): void {
    if (!this.context || this.paused) return;
    const ctx = this.context, now = ctx.currentTime, inside = this.settings?.view === 'cockpit';
    this.cabin!.frequency.setTargetAtTime(inside ? 2000 : 11000, now, .2);
    const shifted = this.lastGear !== player.gear; this.lastGear = player.gear;
    const rev = player.rpm / 60;
    if (shifted) for (const voice of this.engine) { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(.002, now, .02); }
    this.engine.forEach(({ osc, gain }, i) => {
      osc.frequency.setTargetAtTime(rev * [1, 2, 3, 4, .5][i], now, .06);
      const bands = [1, .6 + throttle * .3, Math.min(1, player.rpm / 3000), Math.max(0, (player.rpm - 3500) / 3000), 1 - throttle * .65];
      gain.gain.setTargetAtTime(bands[i] * [ .045, .04, .012, .009, .025][i] * (inside ? 1.2 : 1), shifted ? now + .1 : now, .08);
    });
    this.noise!.gain.setTargetAtTime(inside ? .035 : .06, now, .2);
    this.tire!.gain.setTargetAtTime(Math.abs(player.speed) / 78 * (inside ? .05 : .11), now, .15);
    this.skid!.gain.setTargetAtTime(player.slip * .09, now, .08);
    const listener = ctx.listener, direction = new THREE.Vector3(); camera.getWorldDirection(direction);
    if (listener.positionX) {
      listener.positionX.value = camera.position.x; listener.positionY.value = camera.position.y; listener.positionZ.value = camera.position.z;
      listener.forwardX.value = direction.x; listener.forwardY.value = direction.y; listener.forwardZ.value = direction.z;
      listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    }
    const passing = traffic.agents.filter(a => a.kind !== 'police').sort((a, b) => Math.abs(a.s - player.s) - Math.abs(b.s - player.s)).slice(0, 6);
    this.passby.forEach((voice, i) => {
      const a = passing[i];
      voice.gain.gain.setTargetAtTime(a && Math.abs(a.s - player.s) < 90 ? .065 : 0, now, .15);
      if (!a) return;
      // Doppler-style pitch is bounded and driven by actual relative velocity.
      const closing = (a.s > player.s ? 1 : -1) * (player.speed - a.speed * a.direction);
      voice.source.frequency.setTargetAtTime((55 + a.speed * 2) * (343 / (343 - Math.max(-80, Math.min(80, closing)))), now, .1);
      voice.panner.positionX.value = a.x; voice.panner.positionY.value = .7; voice.panner.positionZ.value = -(a.s - origin);
    });
    const police = traffic.agents.filter(a => a.kind === 'police' && a.active);
    for (const [id, voice] of this.sirens) if (!police.some(a => a.id === id)) {
      voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.panner.disconnect(); this.sirens.delete(id);
    }
    for (const a of police) {
      let voice = this.sirens.get(a.id);
      if (!voice) {
        const source = ctx.createOscillator(), panner = ctx.createPanner(), gain = ctx.createGain();
        source.type = 'triangle'; panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
        panner.refDistance = 7; panner.maxDistance = 400; panner.rolloffFactor = 1.1;
        source.connect(gain); gain.gain.value = .1; gain.connect(panner); panner.connect(this.effects!); source.start();
        voice = { source, panner, gain }; this.sirens.set(a.id, voice);
      }
      voice.source.frequency.setTargetAtTime(700 + 380 * (.5 + .5 * Math.sin(now * (a.id % 2 ? 3 : 5))), now, .025);
      voice.panner.positionX.value = a.x; voice.panner.positionY.value = 1.4; voice.panner.positionZ.value = -(a.s - origin);
    }


  }
}
