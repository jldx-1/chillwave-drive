import { STEP, neutral, type Controls } from './config';
import { Vehicle } from './vehicle';
import { Traffic } from './traffic';
import { DriveInput } from './input';
import { DriveScene } from './scene';
import { DriveCamera } from './camera';
import { DriveAudio } from './audio';
import { DriveUI, type Mode } from './ui';
import { Records, type Result } from './storage';
import { road } from './road';
export class DriveGame {
  private records = new Records();
  private vehicle = new Vehicle();
  private traffic = new Traffic('SUNSET');
  private camera = new DriveCamera();
  private audio = new DriveAudio();
  private ui: DriveUI;
  private world: DriveScene;
  private input: DriveInput;
  private state: Mode = 'menu';
  private elapsed = 0; private accumulator = 0; private last = 0; private clock = 0;
  private inDetour = false; private detours = 0; private saved = false;
  private lastLevel = 0; private idleTime = 0; private achievement = 0;
  private pinnedSeed = new URLSearchParams(location.search).get('seed');
  constructor(root: HTMLElement) {
    this.ui = new DriveUI(root, this.records, a => this.action(a), () => this.configure());
    this.input = new DriveInput(key => this.command(key));
    try { this.world = new DriveScene(this.ui.canvas); } catch (error) { this.ui.error(); throw error; }
    void this.world.player.ready.then(()=>{document.querySelector<HTMLButtonElement>('.start-button')!.disabled=false;});
    this.world.configure(this.records.settings.quality); this.traffic.reset();
    const resize = () => { this.world.resize(innerWidth, innerHeight); this.camera.resize(innerWidth, innerHeight); }; resize(); window.addEventListener('resize', resize);
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); this.last = 0; });
    this.ui.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (this.state === 'playing') this.pause(); this.ui.error(); });
    // Read-only QA observations; the normal build has no simulation shortcuts.
    if (new URLSearchParams(location.search).has('qa')) Object.defineProperty(window, '__drive', { value: { advance: (seconds: number) => this.advanceQA(seconds), streamAt: (distance:number) => { this.world.stream(distance);this.world.render(this.camera.camera,0,false);return this.world.diagnostics; }, inspect: () => ({ state: this.state, x: this.vehicle.x, s: this.vehicle.s, speed: this.vehicle.speed, lateral: this.vehicle.lateral, yaw: this.vehicle.yaw, steering: this.vehicle.steering, slip: this.vehicle.slip, slipAngle: this.vehicle.slipAngle, drift: this.vehicle.driftAmount, velocityS: this.vehicle.velocityS, damage: this.vehicle.damage, view: this.records.settings.view, elapsed: this.elapsed, capture: this.traffic.capture, joins: this.traffic.joins, level: this.traffic.level, agents: this.traffic.agents.map(a => ({ id: a.id, s: a.s, x: a.x, direction: a.direction, kind: a.kind, active: a.active, yaw: a.yaw, state: a.state })), ...this.world.diagnostics }) } });
    requestAnimationFrame(t => this.frame(t));
  }
  private configure(): void { this.world?.configure(this.records.settings.quality); this.audio.configure(this.records.settings); }
  private command(key: string): void {
    if (key === 'Escape') {
      if (this.ui.panel && this.ui.panel !== 'pause' && this.ui.panel !== 'over') this.action('close');
      else if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume();
    }
    if (key === 'KeyC' && !this.ui.panel) this.action('camera');
    if (key === 'KeyV' && this.state === 'playing') this.camera.reset();
    if (key === 'KeyF') this.vehicle.headlights = !this.vehicle.headlights;
    if (key === 'KeyM') this.action('mute');
    if (key === 'KeyR' && this.state === 'over') this.start();
    if (key === 'Enter' && !this.ui.panel && this.state === 'menu') this.start();
  }
  private action(action: string): void {
    if (action === 'start' || action === 'restart') this.start();
    else if (action === 'resume') this.resume();
    else if (action === 'pause') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
    else if (action === 'menu') { this.save(); this.state = 'menu'; this.audio.pause(); this.input.clear(); this.ui.setMode('menu'); this.vehicle.reset(); this.camera.reset(); }
    else if (action === 'camera') { this.records.settings.view = this.records.settings.view === 'chase' ? 'cockpit' : 'chase'; this.records.save(); this.camera.reset(); }
    else if (action === 'mute') { this.records.settings.musicEnabled = !this.records.settings.musicEnabled; this.records.save(); this.configure(); this.ui.notify(this.records.settings.musicEnabled ? 'SOUNDTRACK ON' : 'SOUNDTRACK MUTED'); }
    else if (['settings', 'controls', 'garage'].includes(action)) { if (this.state === 'playing') this.pause(); this.ui.open(action); }
    else if (action === 'close') { this.ui.close(); if (this.state === 'paused') this.ui.open('pause'); }
  }
  private result(): Result { return { distance: this.vehicle.distance, topSpeed: this.vehicle.topSpeed, time: this.elapsed, nearMisses: this.traffic.nearMisses, level: this.traffic.level, detours: this.detours }; }
  private save(): void { if (!this.saved && this.elapsed > 0) { this.records.finish(this.result()); this.saved = true; } }
  private start(): void {
    this.save(); this.vehicle.reset(); this.camera.reset(); this.input.clear(); this.elapsed = 0; this.accumulator = 0;
    this.saved = false; this.inDetour = false; this.detours = 0; this.lastLevel = 0; this.idleTime = 0; this.achievement = 0;
    const seed = this.pinnedSeed || Math.random().toString(36).slice(2, 8);
    this.world.reset(seed); this.traffic = new Traffic(seed, this.records.settings.density); this.traffic.reset();
    this.state = 'playing'; this.ui.setMode('playing'); this.last = 0; void this.audio.unlock(this.records.settings);
    this.ui.notify('KEEP DRIVING. THE SUNSET CAN WAIT.');
  }
  private pause(): void { this.state = 'paused'; this.ui.setMode('paused'); this.ui.open('pause'); this.input.clear(); this.accumulator = 0; this.audio.pause(); }
  private resume(): void { this.state = 'playing'; this.ui.setMode('playing'); this.input.clear(); this.last = 0; void this.audio.unlock(this.records.settings); }
  private finish(reason: string): void { this.save(); this.state = 'over'; this.ui.setMode('over'); this.ui.open('over', this.result(), reason); this.audio.pause(); this.input.clear(); }
  private step(input: Controls): void {
    const previousDamage = this.vehicle.damage;
    this.elapsed += STEP; this.vehicle.step(STEP, input, true, this.records.settings.sensitivity);
    const event = this.traffic.step(STEP, this.vehicle, this.elapsed);
    if (this.vehicle.damage > previousDamage && !event.hit) { this.audio.impact(this.vehicle.impact*25); this.world.impact({a:-1,b:-2,x:this.vehicle.x,s:this.vehicle.s,nx:this.vehicle.impactSide,ns:0,speed:this.vehicle.impact*25,impulse:100,material:'concrete'}); }
    for (const contact of event.contacts) if (Math.abs(contact.s-this.vehicle.s)<100) this.world.impact(contact);
    if (event.joined) this.ui.notify('PATROL ALERTED · POLICE PURSUIT');
    if (event.hit) { this.audio.impact(Math.max(...event.contacts.map(c=>c.speed),5)); this.ui.notify('COLLISION · VEHICLE DAMAGE'); }
    if (event.near) this.ui.notify('CLOSE CALL · KEEP YOUR LINE');
    if (this.traffic.level > this.lastLevel) { this.lastLevel = this.traffic.level; this.ui.notify(`PURSUIT LEVEL ${this.lastLevel} · PATROLS ENGAGED`); }
    const detour = road.onDetour(this.vehicle.x, this.vehicle.s);
    if (detour) this.inDetour = true;
    if (this.inDetour && !road.routeAt(this.vehicle.s)) { this.inDetour = false; this.detours++; this.ui.notify('SERVICE LOOP COMPLETE · BACK ON THE EXPRESSWAY'); }
    if (this.vehicle.distance >= 5000 && this.achievement === 0) { this.achievement++; this.ui.notify('LONG WAY HOME · FIVE KILOMETERS'); }
    this.idleTime = this.vehicle.damage > 80 && Math.abs(this.vehicle.speed) < 1 ? this.idleTime + STEP : 0;
    if (this.vehicle.damage >= 100) this.finish('VEHICLE DISABLED');
    else if (this.traffic.capture >= 5) this.finish('CAUGHT BY THE AFTERGLOW · CAPTURED');
    else if (this.idleTime > 15) this.finish('VEHICLE IMMOBILIZED');
  }
  /** QA fast stepping uses the actual input and fixed-step simulation, never fabricated poses. */
  private advanceQA(seconds: number): void {
    const steps=Math.min(36000,Math.max(0,Math.round(seconds/STEP)));
    for(let i=0;i<steps&&this.state==='playing';i++){
      this.step(this.input.sample());this.clock+=STEP;
      if(i%120===0)this.world.update(0,this.clock,this.vehicle,this.vehicle.pose(1),this.traffic.agents,false,true,1);
    }
    this.ui.update(this.vehicle,this.traffic,this.clock);
  }
  private frame(now: number): void {
    requestAnimationFrame(t => this.frame(t));
    const dt = this.last ? Math.min(.1, (now - this.last) / 1000) : 0; this.last = now;
    if (document.hidden) return;
    let input = neutral();
    if (this.state === 'playing') {
      input = this.input.sample(); this.accumulator += dt;
      while (this.accumulator >= STEP && this.state === 'playing') { this.step(input); this.accumulator -= STEP; }
    }
    if (this.state === 'playing' || this.state === 'menu') {
      this.clock += dt;
      const pose = this.state === 'playing' ? this.vehicle.pose(Math.max(0, this.accumulator / STEP)) : { x: this.vehicle.x, s: this.vehicle.s, yaw: this.vehicle.yaw };
      this.world.update(dt, this.clock, this.vehicle, pose, this.state === 'menu' ? [] : this.traffic.agents, input.brake > 0, this.records.settings.reducedMotion, this.state === 'playing' ? Math.max(0, this.accumulator / STEP) : 1);
      if (this.state === 'menu') {
        const startButton=document.querySelector<HTMLButtonElement>('.start-button')!;startButton.disabled=!this.world.player.assetReady&&!this.world.player.assetFailed;
        this.camera.camera.position.set(12.3, 2.7, 7.6); this.camera.camera.lookAt(5.5, .95, -3.8); this.camera.camera.fov = 54; this.camera.camera.updateProjectionMatrix();
      } else {
        this.camera.update(dt, this.vehicle, pose, this.world.origin, this.records.settings.view, input.rear, this.records.settings.reducedMotion, this.world.player.eye);
        this.audio.update(this.vehicle, this.traffic, input.throttle, this.camera.camera, this.world.origin); this.ui.update(this.vehicle, this.traffic, this.clock);
      }
      this.world.render(this.camera.camera, dt, this.state === 'playing' && this.records.settings.view === 'cockpit');
    }
  }
}
