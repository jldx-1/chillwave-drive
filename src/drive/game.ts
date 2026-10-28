import { STEP, neutral, type Controls } from './config';
import { jumpRamps } from './jump-ramps';
import { Vehicle } from './vehicle';
import { Traffic } from './traffic';
import { DriveInput } from './input';
import { DriveScene } from './scene';
import { DriveCamera } from './camera';
import { DriveAudio } from './audio';
import type { CyberModel } from './cyber-vehicles';
import { YouTubeRadio } from './youtube-radio';
import { DriveUI, type Mode } from './ui';
import { Records, type Result } from './storage';
import { road } from './road';
import { DriveScore } from './score';
import { PowerUps } from './powerups';
import { EXPLOSION_DURATION } from './crashes';
import { EnvironmentCollisions } from './environment-collisions';
export class DriveGame {
  private records = new Records();
  private vehicle = new Vehicle();
  private score = new DriveScore();
  private powerups = new PowerUps();
  private environment = new EnvironmentCollisions();
  private explosionTime = 0;
  private crashResultPending = false;
  private traffic = new Traffic('SUNSET');
  private camera = new DriveCamera();
  private audio = new DriveAudio();
  private radio:YouTubeRadio;
  private ui: DriveUI;
  private world: DriveScene;
  private input: DriveInput;
  private state: Mode = 'menu';
  private elapsed = 0; private accumulator = 0; private last = 0; private clock = 0;
  private inDetour = false; private detours = 0; private saved = false;
  private lastLevel = 0; private achievement = 0;
  private hudElapsed = 0; private audioElapsed = 0;
  private pinnedSeed = new URLSearchParams(location.search).get('seed');
  constructor(root: HTMLElement) {
    this.ui = new DriveUI(root, this.records, a => this.action(a), () => this.configure());
    this.radio=new YouTubeRadio(root,()=>this.action('mute'));
    this.radio.configure(this.records.settings);
    this.input = new DriveInput(key => this.command(key));
    try { this.world = new DriveScene(this.ui.canvas); } catch (error) { this.ui.error(); throw error; }
    void this.world.ready.then(() => {
      document.querySelector<HTMLButtonElement>('.start-button')!.disabled = false; this.ui.loading(false);
    }).catch(() => this.ui.error('The vehicles could not load. Please reload to try again.'));
    this.world.configure(this.records.settings.quality); this.traffic.reset();
    const resize = () => { this.world.resize(innerWidth, innerHeight); this.camera.resize(innerWidth, innerHeight); }; resize(); window.addEventListener('resize', resize);
    window.addEventListener('blur', () => { if (this.state === 'playing'&&!document.activeElement?.closest('.radio-card')) this.pause(); });
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); this.last = 0; });
    this.ui.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (this.state === 'playing') this.pause(); this.ui.error(); });
    // QA observations and camera probes; ordinary gameplay has no simulation shortcuts.
    if (new URLSearchParams(location.search).has('qa')) Object.defineProperty(window, '__drive', { value: { previewFleet:(id:CyberModel,angle:number,lod?:0|1|2)=>this.world.previewFleet(this.camera.camera,id,angle,lod),previewCity:(distance:number,rear:boolean,windowDistance?:number,probe?:{occluder?:number;sun?:boolean})=>this.world.previewCity(this.camera.camera,distance,rear,windowDistance,probe), advance: (seconds: number) => this.advanceQA(seconds), setCityNeon:(enabled:boolean)=>this.world.setCityNeon(enabled), streamAt: (distance:number) => { this.world.stream(distance);return this.world.sampleResources(this.camera.camera); }, inspect: () => ({ radio:this.radio.diagnostics,controls: this.input.sample(), state: this.state, x: this.vehicle.x, s: this.vehicle.s, speed: this.vehicle.speed, lateral: this.vehicle.lateral, yaw: this.vehicle.yaw, steering: this.vehicle.steering, yawRate:this.vehicle.yawRate, cameraY:this.camera.camera.position.y, cameraFov:this.camera.camera.fov, slip: this.vehicle.slip, slipAngle: this.vehicle.slipAngle, drift: this.vehicle.driftAmount, velocityS: this.vehicle.velocityS, damage: this.vehicle.damage, exploded: this.vehicle.exploded, shield: this.vehicle.shield, turbo: this.vehicle.turbo, nitro:this.vehicle.nitro, nitroFuel:this.vehicle.nitroFuel, nitroReady:this.vehicle.nitroReady, nitroCooldown:this.vehicle.nitroCooldown, jumpHeight:this.vehicle.jumpHeight, airborne:this.vehicle.airborne, pulseCooldown:this.vehicle.pulseCooldown, ramps:jumpRamps(this.vehicle.s), pickups: this.powerups.nearby(this.vehicle.s), view: this.records.settings.view, elapsed: this.elapsed, capture: this.traffic.capture, joins: this.traffic.joins, level: this.traffic.level, nearMisses: this.traffic.nearMisses, score:this.score.value, multiplier:this.score.multiplier, scoreHits:this.score.hits, agents: this.traffic.agents.map(a => ({ id: a.id, s: a.s, x: a.x, direction: a.direction, kind: a.kind, model:a.model,active: a.active, yaw: a.yaw, state: a.state })), ...this.world.diagnostics }) } });
    requestAnimationFrame(t => this.frame(t));
  }
  private configure(): void { this.world?.configure(this.records.settings.quality); this.audio.configure(this.records.settings);this.radio.configure(this.records.settings); }
  private command(key: string): void {
    if (key === 'Escape') {
      if (this.ui.panel && this.ui.panel !== 'pause' && this.ui.panel !== 'over') this.action('close');
      else if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume();
    }
    if (key === 'KeyC' && !this.ui.panel) this.action('camera');
    if (key === 'KeyV' && this.state === 'playing') this.camera.reset();
    if (key === 'KeyF') this.vehicle.headlights = !this.vehicle.headlights;
    if (key === 'KeyM') this.action('mute');
    if (key === 'KeyQ') this.action('blast-front');
    if (key === 'KeyE') this.action('blast-rear');
    if (key === 'KeyR' && this.state === 'over') this.start();
    if (key === 'Enter' && !this.ui.panel && this.state === 'menu') this.start();
  }
  private action(action: string): void {
    if (action === 'start' || action === 'restart') this.start();
    else if (action === 'resume') this.resume();
    else if (action === 'pause') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
    else if (action === 'menu') { this.save(); this.state = 'menu'; this.explosionTime = 0; this.crashResultPending = false; document.body.classList.remove('crashed'); this.audio.pause(); this.input.clear(); this.ui.setMode('menu'); this.vehicle.reset(); this.camera.reset(); }
    else if (action === 'camera') { this.records.settings.view = this.records.settings.view === 'chase' ? 'cockpit' : 'chase'; this.records.save(); this.camera.reset(); }
    else if (action === 'mute') { this.records.settings.musicEnabled=!['playing','buffering','loading'].includes(this.radio.diagnostics.state);this.records.save();this.configure();this.radio.play(this.records.settings); }
    else if((action==='blast-front'||action==='blast-rear')&&this.state==='playing') {
      const direction=action==='blast-front'?1:-1,result=this.traffic.firePulse(this.vehicle,direction);
      if(result.status==='hit'&&result.target){this.world.explodeTraffic(result.target.x,result.target.s);this.audio.impact(35);this.ui.notify('TARGET DESTROYED · PULSE RECHARGING');}
      else this.ui.notify(result.status==='recharging'?'PULSE RECHARGING':`NO CAR ${direction===1?'AHEAD':'BEHIND'} IN RANGE`);
      this.ui.update(this.vehicle,this.traffic,this.clock,this.score);
    }
    else if (['settings', 'controls', 'garage'].includes(action)) { if (this.state === 'playing') this.pause(); this.ui.open(action); }
    else if (action === 'close') { this.ui.close(); if (this.state === 'paused') this.ui.open('pause'); }
  }
  private result(): Result { return { distance: this.vehicle.distance, topSpeed: this.vehicle.topSpeed, time: this.elapsed, nearMisses: this.traffic.nearMisses, level: this.traffic.level, detours: this.detours, score:this.score.value, hits:this.score.hits }; }
  private save(): void { if (!this.saved && this.elapsed > 0) { this.records.finish(this.result()); this.saved = true; } }
  private start(): void {
    if (!this.world.assetsLoaded) return;
    this.save(); this.vehicle.reset(); this.score.reset(); this.powerups.reset(); this.environment.reset(); this.explosionTime = 0; this.crashResultPending = false; this.camera.reset(); this.input.clear(); this.elapsed = 0; this.accumulator = 0;
    this.saved = false; this.inDetour = false; this.detours = 0; this.lastLevel = 0; this.achievement = 0; this.hudElapsed = 0; this.audioElapsed = 1/60;
    const seed = this.pinnedSeed || Math.random().toString(36).slice(2, 8);
    this.world.reset(seed); this.traffic = new Traffic(seed, this.records.settings.density); this.traffic.reset();
    document.body.classList.remove('crashed'); this.state = 'playing'; this.ui.setMode('playing'); this.ui.update(this.vehicle,this.traffic,this.clock,this.score); this.last = 0; void this.audio.unlock(this.records.settings);this.radio.play(this.records.settings);
    this.ui.notify('KEEP DRIVING. THE SUNSET CAN WAIT.');
  }
  private pause(): void { this.vehicle.stopNitro();this.state = 'paused'; this.ui.setMode('paused'); this.ui.open('pause'); this.input.clear(); this.accumulator = 0; this.audio.pause(); }
  private resume(): void { document.body.classList.remove('crashed'); this.state = 'playing'; this.ui.setMode('playing'); this.input.clear(); this.last = 0; this.audioElapsed = 1/60; void this.audio.unlock(this.records.settings); }
  private finish(reason: string): void {
    if (!this.vehicle.exploded) this.save();
    this.state = 'over'; this.ui.setMode('over');
    this.crashResultPending = this.vehicle.exploded;
    if (!this.crashResultPending) this.ui.open('over', this.result(), reason);
    document.body.classList.toggle('crashed', this.vehicle.exploded);
    this.audio.pause(this.vehicle.exploded ? .35 : 0); this.input.clear();
  }
  private step(input: Controls): void {
    const previousDamage = this.vehicle.damage;
    this.elapsed += STEP; this.vehicle.step(STEP, input, true, this.records.settings.sensitivity);
    const environmentHits=this.environment.step(this.vehicle);
    for(const impact of environmentHits){
      if(impact.kind==='sign')this.world.breakSign(impact.id);
      this.world.impact({a:-1,b:-3,x:impact.x,s:impact.s,nx:0,ns:1,speed:impact.speed,impulse:0,material:impact.kind==='sign'?'metal':'concrete'});
      this.audio.impact(impact.speed);
    }
    if(this.vehicle.landingImpact>4)this.audio.impact(this.vehicle.landingImpact);
    const collected = this.powerups.collect(this.vehicle);
    const event = this.traffic.step(STEP, this.vehicle, this.elapsed);
    for(const blast of event.explosions)this.world.explodeTraffic(blast.x,blast.s);
    if(!event.hit&&event.explosions.some(blast=>Math.abs(blast.s-this.vehicle.s)<100))this.audio.impact(45);
    this.score.advance(this.vehicle.distance);
    let lost=0;
    for(const contact of event.scoreHits)lost+=this.score.collide(contact.speed);
    if(event.touching)this.score.breakStreak();
    if(this.vehicle.barrierHit>0)lost+=this.score.collide(this.vehicle.barrierHit);
    if (this.vehicle.exploded) {
      this.world.explode(this.vehicle); this.explosionTime = EXPLOSION_DURATION;
      this.audio.impact(80); this.finish('HIGH-SPEED COLLISION · CAR DESTROYED');
      this.ui.notify('HIGH-SPEED COLLISION · CAR DESTROYED');
      this.ui.update(this.vehicle, this.traffic, this.clock, this.score);
      return;
    }
    if (this.vehicle.damage > previousDamage && !event.hit) { this.audio.impact(this.vehicle.impact*25); this.world.impact({a:-1,b:-2,x:this.vehicle.x,s:this.vehicle.s,nx:this.vehicle.impactSide,ns:0,speed:this.vehicle.impact*25,impulse:100,material:'concrete'}); }
    for (const contact of event.contacts) if (Math.abs(contact.s-this.vehicle.s)<100) this.world.impact(contact);
    if (event.joined) this.ui.notify('PATROL ALERTED · POLICE PURSUIT');
    if (event.hit) this.audio.impact(Math.max(...event.contacts.map(c=>c.speed),5));
    if (event.scoreHits.length || this.vehicle.barrierHit>0) this.ui.notify(lost ? 'COLLISION · −'+lost+' POINTS · MULTIPLIER RESET' : 'COLLISION · MULTIPLIER RESET');
    if (event.near) this.ui.notify(event.boost ? 'CLOSE PASS · SPEED BOOST' : 'CLOSE PASS · KEEP YOUR LINE');
    if (this.traffic.level > this.lastLevel) { this.lastLevel = this.traffic.level; this.ui.notify(`PURSUIT LEVEL ${this.lastLevel} · PATROLS ENGAGED`); }
    const detour = road.onDetour(this.vehicle.x, this.vehicle.s);
    if (detour) this.inDetour = true;
    if (this.inDetour && !road.routeAt(this.vehicle.s)) { this.inDetour = false; this.detours++; this.ui.notify('SIDE STREET COMPLETE · BACK ON THE EXPRESSWAY'); }
    if (this.vehicle.distance >= 5000 && this.achievement === 0) { this.achievement++; this.ui.notify('LONG WAY HOME · FIVE KILOMETERS'); }
    for (const kind of collected) this.ui.notify(kind === 'shield' ? 'SHIELD · 8s OF DAMAGE PROTECTION' : 'TURBO · 6s OF EXTRA SPEED · HOLD W');
    if (this.traffic.capture >= 5) this.finish('CAUGHT BY THE AFTERGLOW · CAPTURED');
  }
  /** QA fast stepping uses the actual input and fixed-step simulation, never fabricated poses. */
  private advanceQA(seconds: number): void {
    const steps=Math.min(36000,Math.max(0,Math.round(seconds/STEP)));
    for(let i=0;i<steps&&this.state==='playing';i++){
      const input=this.input.sample();this.step(input);this.clock+=STEP;
      if(i%120===0)this.world.update(0,this.clock,this.vehicle,this.vehicle.pose(1),this.traffic.agents,false,true,1,this.records.settings.view,this.powerups.nearby(this.vehicle.s));
      this.camera.update(STEP,this.vehicle,this.vehicle.pose(1),this.world.origin,this.records.settings.view,input.rear,this.records.settings.reducedMotion,this.world.player.eye);
    }
    this.world.update(0,this.clock,this.vehicle,this.vehicle.pose(1),this.traffic.agents,false,this.records.settings.reducedMotion,1,this.records.settings.view,this.powerups.nearby(this.vehicle.s));
    this.ui.update(this.vehicle,this.traffic,this.clock,this.score);
  }
  private frame(now: number): void {
    requestAnimationFrame(t => this.frame(t));
    const wallDt = this.last ? Math.max(0, (now - this.last) / 1000) : 0;
    const dt = Math.min(.1, wallDt); this.last = now;
    if (document.hidden) return;
    const stateAtStart = this.state;
    let input = neutral();
    if (this.state === 'playing') {
      input = this.input.sample(); this.accumulator += dt;
      while (this.accumulator >= STEP && this.state === 'playing') { this.step(input); this.accumulator -= STEP; }
    }
    if (this.state === 'playing' || this.state === 'menu' || this.explosionTime > 0) {
      const effectsDt = this.state === 'over' ? (stateAtStart === 'playing' ? 0 : wallDt) : dt;
      this.clock += this.state === 'over' ? effectsDt : dt;
      const pose = this.state === 'playing' ? this.vehicle.pose(Math.max(0, this.accumulator / STEP)) : { x: this.vehicle.x, s: this.vehicle.s, yaw: this.vehicle.yaw };
      this.world.update(dt, this.clock, this.vehicle, pose, this.state === 'menu' ? [] : this.traffic.agents, input.brake > 0, this.records.settings.reducedMotion, this.state === 'playing' ? Math.max(0, this.accumulator / STEP) : 1,this.records.settings.view,this.state === 'menu' ? [] : this.powerups.nearby(this.vehicle.s),effectsDt);
      if (this.state === 'menu') {
        const startButton=document.querySelector<HTMLButtonElement>('.start-button')!;startButton.disabled=!this.world.assetsLoaded;
        this.camera.camera.position.set(12.3, 2.7, 7.6); this.camera.camera.lookAt(5.5, .95, -3.8); this.camera.camera.fov = 54; this.camera.camera.updateProjectionMatrix();
      } else {
        this.camera.update(dt, this.vehicle, pose, this.world.origin, this.vehicle.exploded ? 'chase' : this.records.settings.view, input.rear, this.records.settings.reducedMotion, this.world.player.eye);
        this.hudElapsed += dt; this.audioElapsed += dt;
        if (this.audioElapsed >= 1/60) { this.audioElapsed = 0; this.audio.update(this.vehicle, this.traffic, input.throttle, this.camera.camera, this.world.origin); }
        if (this.hudElapsed >= 1/30) { this.hudElapsed = 0; this.ui.update(this.vehicle, this.traffic, this.clock,this.score); }
      }
      this.world.render(this.camera.camera, dt, this.state === 'playing' && this.records.settings.view === 'cockpit');
      this.explosionTime = Math.max(0, this.explosionTime - effectsDt);
      if (this.crashResultPending && this.explosionTime === 0) {
        this.crashResultPending = false; this.save(); this.ui.open('over', this.result(), 'HEAD-ON COLLISION · CAR DESTROYED');
      }
    }
  }
}
