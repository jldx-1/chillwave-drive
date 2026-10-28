import { drawNavigation } from './minimap';
import type { Preferences, Records, Result } from './storage';
import { NITRO_DURATION,type Vehicle } from './vehicle';
import type { Traffic } from './traffic';
import { road } from './road';
import { KPH_TO_MPH, MPS_TO_MPH } from './units';
import type { DriveScore } from './score';
import { youtubeVideoId,youtubeVideoURL } from './youtube-source';
export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export class DriveUI {
  readonly canvas: HTMLCanvasElement;
  panel = '';
  private overlay: HTMLElement;
  private toast: HTMLElement;
  private map: HTMLCanvasElement;
  private toastUntil = 0;
  private elements = new Map<string, HTMLElement>();
  constructor(root: HTMLElement, private records: Records, action: (name: string) => void, change: () => void) {
    root.innerHTML = `
      <canvas id="world" tabindex="0" aria-label="Chillwave Drive interactive 3D highway"></canvas>
      <div class="screen-shade"></div><div id="windshield" aria-hidden="true">${Array.from({ length: 32 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 23) % 83}%;--drop:${2 + i % 4}px"></i>`).join('')}</div>
      <header class="header"><a class="brand" href="./" aria-label="Chillwave Drive home"><span class="brand-icon">≋</span><span>CHILLWAVE<span class="brand-sub">D R I V E</span></span></a><div class="header-right"><span class="weather">☂ &nbsp; RAIN / 18°C</span><button data-action="mute" aria-label="Toggle music">♫</button><button data-action="pause" id="pause-button" aria-label="Pause drive">Ⅱ</button></div></header>
      <main id="main-menu"><div class="eyebrow"><span class="status-dot"></span> AN ENDLESS DRIVING EXPERIENCE</div><h1>CHASE THE<br><em>AFTERGLOW.</em></h1><p>One highway. A neon night.<br>A city that never ends. Keep driving.</p><button class="start-button" data-action="start" disabled>START DRIVE <span>↗</span></button><small id="load-status" role="status">Preparing your drive…</small><nav><button data-action="garage">GARAGE</button><button data-action="controls">CONTROLS</button><button data-action="settings">SETTINGS</button></nav><div class="record"><span>PERSONAL BEST</span><strong id="menu-best">0.00 <small>KM</small></strong></div><div class="score-record">HIGH SCORE <b id="menu-score">0</b></div></main>
      <div class="menu-caption"><span>01 / SUNSET EXPRESSWAY</span><strong>THE LONG WAY HOME.</strong><span>RAIN ON THE WINDSHIELD. CHILLWAVE ON THE RADIO.</span></div>
      <footer class="menu-footer"><span>WASD TO DRIVE &nbsp; / &nbsp; C TO CHANGE VIEW</span><span>YOUTUBE RADIO &nbsp; · &nbsp; NO DESTINATION</span><span>CHILLWAVE DRIVE / 01</span></footer>
      <section id="hud" aria-label="Driving instruments" hidden>
        <div class="distance-block"><span class="eyebrow">DISTANCE SURVIVED</span><strong><b id="distance">0.00</b> <small>KM</small></strong><span id="route-name">SUNSET EXPRESSWAY</span><div class="drive-score" aria-label="Driving score"><span>SCORE</span><strong id="score">0</strong><span id="score-multiplier">CLEAN ×1.0</span></div></div>
        <div class="powerups" aria-label="Power-ups"><span id="shield-status">◇ SHIELD · FIND A GREEN PICKUP</span><span id="turbo-status">ϟ TURBO · FIND AN AMBER PICKUP</span><span id="pulse-status">✦ PULSE · Q FRONT / E REAR · READY</span></div>
        <div class="pursuit"><span class="eyebrow">POLICE PATROLS</span><div id="pursuit-level">◆ ◇ ◇ ◇ ◇</div><span id="police-state">POLICE CLOSING</span><div class="capture-track"><span id="capture"></span></div></div>
        <div class="speedometer"><div class="speed-ring"><span id="gear">D1</span><strong id="speed">0</strong><small>MPH</small><div class="rev-track"><span id="rpm"></span></div></div><span id="nitro-status" aria-label="Nitro status">NITRO · HOLD SHIFT · 100%</span><span id="view-label">CHASE CAMERA</span></div>
        <div class="vehicle-health"><span>BODY CONDITION <b id="integrity">100%</b></span><div><span id="health-bar"></span></div><small id="drive-hint">W ACCELERATE · S BRAKE · SPACE HANDBRAKE</small></div>
        <div class="navigation"><canvas id="minimap" width="220" height="180" aria-label="Nearby traffic and route map"></canvas><span id="navigation-label">N &nbsp; ↑ &nbsp; SUNSET EXPRESSWAY</span><small>C CAMERA &nbsp; V LOOK BACK &nbsp; F LIGHTS</small></div>
        <div class="touch-controls" aria-label="Touch driving controls"><div class="touch-steering" data-steering-pad role="group" aria-label="Slide your thumb to steer"><button data-key="KeyA" aria-label="Steer left">◀</button><button data-key="KeyD" aria-label="Steer right">▶</button></div><div class="touch-pedals"><button data-key="Space" aria-label="Handbrake">DRIFT</button><button data-action="camera" aria-label="Change camera">CAM</button><button data-key="KeyS" aria-label="Brake">BRAKE</button><button data-key="KeyW" aria-label="Accelerate">GO</button></div><div class="touch-weapons"><button data-action="blast-front" aria-label="Blast car ahead">▲ FRONT</button><button data-action="blast-rear" aria-label="Blast car behind">▼ REAR</button><button data-nitro data-key="ShiftLeft" aria-label="Hold for nitro boost">NITRO</button></div></div>
      </section><div id="toast" role="status"></div><div id="overlay" hidden></div><div id="fatal" role="alert" hidden>WebGL is unavailable. Enable hardware acceleration and reload in a modern browser.</div>`;
    this.canvas = root.querySelector('#world')!; this.overlay = root.querySelector('#overlay')!; this.toast = root.querySelector('#toast')!; this.map = root.querySelector('#minimap')!;
    root.addEventListener('click', e => { const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (button) action(button.dataset.action!); });
    root.addEventListener('input', e => {
      const input = e.target as HTMLInputElement, key = input.dataset.setting as keyof Preferences;
      if (!key) return;
      if(key==='musicVideoUrl'){input.setCustomValidity('');return;}
      const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      Object.assign(this.records.settings, { [key]: value }); this.records.save(); change();
    });
    root.addEventListener('change',e=>{
      const input=e.target as HTMLInputElement;if(input.dataset.setting!=='musicVideoUrl')return;
      const id=youtubeVideoId(input.value);
      if(!id){input.setCustomValidity('Enter a YouTube video or livestream link.');input.reportValidity();return;}
      input.setCustomValidity('');this.records.settings.musicVideoUrl=youtubeVideoURL(id);input.value=this.records.settings.musicVideoUrl;this.records.save();change();
    });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || this.overlay.hidden) return;
      const controls = [...this.overlay.querySelectorAll<HTMLElement>('button,select,input,a[href]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    root.querySelectorAll<HTMLElement>('[id]').forEach(element => this.elements.set(element.id, element));
    this.setMode('menu');
  }
  setMode(mode: Mode): void {
    document.body.dataset.state = mode;
    document.getElementById('main-menu')!.hidden = mode !== 'menu';
    document.getElementById('hud')!.hidden = mode === 'menu';
    document.querySelectorAll<HTMLElement>('.menu-caption,.menu-footer').forEach(e => e.hidden = mode !== 'menu');
    document.getElementById('pause-button')!.hidden = mode === 'menu';
    document.getElementById('menu-best')!.innerHTML = `${(this.records.best / 1000).toFixed(2)} <small>KM</small>`;
    document.getElementById('menu-score')!.textContent=this.records.bestScore.toLocaleString('en-US');
    this.close();
  }
  close(): void { this.overlay.hidden = true; this.overlay.innerHTML = ''; this.panel = ''; this.canvas.focus(); }
  open(panel: string, result?: Result, reason = ''): void {
    this.panel = panel; const s = this.records.settings;
    let content = '';
    if (panel === 'pause') content = `<div class="eyebrow">TAKE A BREATHER</div><h2>THE NIGHT<br>CAN WAIT.</h2><p>Your car, the rain, and the city will be right here.</p><button class="primary-button" data-action="resume">RESUME DRIVE ↗</button><button data-action="restart">RESTART DRIVE</button><button data-action="settings">AUDIO & GRAPHICS</button><button data-action="menu">MAIN MENU</button>`;
    if (panel === 'controls') content = `<div class="eyebrow">GET BEHIND THE WHEEL</div><h2>DRIVE YOUR<br>OWN WAY.</h2><dl><dt>W / ↑</dt><dd>Accelerate</dd><dt>S / ↓</dt><dd>Brake / reverse · release and press again after stopping</dd><dt>A / D</dt><dd>Steer · ease off at high speed</dd><dt>SPACE</dt><dd>Handbrake · reduced rear grip</dd><dt>C</dt><dd>Switch cockpit / chase view</dd><dt>V</dt><dd>Hold to look behind</dd><dt>SHIFT</dt><dd>Hold for nitro · release to stop; 3-second tank, 10-second refill</dd><dt>Q / E</dt><dd>Blast the nearest car ahead / behind (5 second recharge)</dd><dt>F / M</dt><dd>Headlights / music mute</dd><dt>ESC / R</dt><dd>Pause / restart after failure</dd></dl><p>To drift at speed, hold a steering direction and brake. Release the brake, countersteer and ease onto the accelerator to catch the slide.</p><p>Four lanes flow through the neon city. Police patrol the highway. Passing a patrol triggers pursuit. Marked exits branch right into varied northbound side streets and rejoin the highway. Police aim for your rear quarter to slow you for arrest. Keep moving to avoid capture.</p><p>On phones, hold GO with one thumb and slide your other thumb across the steering pad. Use BRAKE to slow down, DRIFT to handbrake, CAM to change the view, FRONT / REAR to blast traffic, and NITRO for a speed boost. You can hold multiple controls together.</p><p>Clean driving increases your score multiplier every 250 m, up to ×3. Collisions deduct points and reset the multiplier. Clean close passes give a small speed boost.</p><p>Drive through green pickups for 8 seconds of shield protection, or amber pickups for 6 seconds of turbo (hold accelerate). Powers activate automatically; collecting another refreshes its timer. Shields prevent damage and explosions, preserve your momentum, and shove traffic out of your lane. Impacts still cost points.</p><p>Hit a glowing ramp at 40 mph or faster to launch over traffic. Your pulse can reach cars up to 100 metres ahead or behind.</p><p>Median crossover gates open and close on a timer. Green means open, amber warns of closing, and red means blocked. Cross to the oncoming lanes at your own risk: a hard front-bumper impact explodes your car and ends the drive.</p><button class="primary-button" data-action="close">LET’S GO ↗</button>`;
    if (panel === 'garage') content = `<div class="eyebrow">YOUR GARAGE / 01</div><h2>AFTERGLOW<br>GT.</h2><p>A cyan NEBULA XR with a low canopy, sculpted rear shoulders, cyan boomerang headlights and a fixed rear wing. 1,480 kg. Six-speed automatic. Wet-road grip and speed-sensitive steering.</p><div class="garage-specs"><span>COLOUR <b>METALLIC CYAN</b></span><span>DRIVETRAIN <b>RWD / AUTO</b></span><span>CONDITIONS <b>WET ASPHALT</b></span></div><p class="muted">Original NEBULA XR geometry, one of 15 futuristic vehicle prefabs authored for Chillwave Drive. <a href="./CREDITS.md" target="_blank" rel="noopener">Asset credits and licenses</a>.</p><button class="primary-button" data-action="close">BACK TO THE CITY ↗</button>`;
    if (panel === 'settings') content = `<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>YOUR DRIVE.<br>YOUR MOOD.</h2>
      <p class="muted">Graphics stay at your selected quality. Choose a lower preset for better performance or a higher preset for more detail.</p><label>Graphics quality<select aria-label="Graphics quality" data-setting="quality">${['low', 'medium', 'high', 'ultra'].map(v => `<option ${s.quality === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Traffic density <small>Next drive</small><select aria-label="Traffic density" data-setting="density">${['low', 'normal', 'high', 'dense'].map(v => `<option ${s.density === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Steering sensitivity<input aria-label="Steering sensitivity" data-setting="sensitivity" type="range" min="0.5" max="1.5" step="0.05" value="${s.sensitivity}"></label>
      <label>Sound effects volume<input aria-label="Sound effects volume" data-setting="effectsVolume" type="range" min="0" max="1" step="0.01" value="${s.effectsVolume}"></label>
      <label>Music enabled<input aria-label="Music enabled" data-setting="musicEnabled" type="checkbox" ${s.musicEnabled ? 'checked' : ''}></label>
      <label>YouTube video link<input aria-label="YouTube video link" data-setting="musicVideoUrl" type="url" maxlength="250" value="${s.musicVideoUrl}"></label>
      <label>Music volume<input aria-label="Music volume" data-setting="musicVolume" type="range" min="0" max="1" step="0.01" value="${s.musicVolume}"></label>
      <label>Reduced motion<input aria-label="Reduced motion" data-setting="reducedMotion" type="checkbox" ${s.reducedMotion ? 'checked' : ''}></label><p class="muted">Music plays through the YouTube radio player. Internet access is required; use the video’s Play button if playback is blocked. Sound effects are original. Settings save on this device.</p><button class="primary-button" data-action="close">ALL SET ↗</button>`;
    if (panel === 'over' && result) content = `<div class="eyebrow">${reason}</div><h2>WHAT A<br>DRIVE.</h2><div class="result-distance">${(result.distance / 1000).toFixed(2)} <small>KM</small></div><div class="results"><span>SCORE <b>${(result.score??0).toLocaleString('en-US')} POINTS</b></span><span>HIGH SCORE <b>${this.records.bestScore.toLocaleString('en-US')}</b></span><span>COLLISIONS <b>${result.hits??0}</b></span><span>TOP SPEED <b>${Math.round(result.topSpeed * KPH_TO_MPH)} MPH</b></span><span>AVERAGE SPEED <b>${Math.round(result.distance / Math.max(1, result.time) * MPS_TO_MPH)} MPH</b></span><span>TIME SURVIVED <b>${Math.floor(result.time / 60)}:${String(Math.floor(result.time % 60)).padStart(2, '0')}</b></span><span>NEAR MISSES <b>${result.nearMisses}</b></span><span>PURSUIT LEVEL <b>${result.level} / 5</b></span><span>PERSONAL BEST <b>${(this.records.best / 1000).toFixed(2)} KM</b></span></div><button class="primary-button" data-action="restart">DRIVE AGAIN ↗</button><button data-action="menu">MAIN MENU</button>`;
    this.overlay.innerHTML = `<section class="panel" role="dialog" aria-modal="true" aria-label="${panel}">${content}</section>`;
    this.overlay.hidden = false; this.overlay.querySelector<HTMLElement>('button,select')?.focus({ preventScroll: true });
  }
  notify(text: string): void { this.toast.textContent = text; this.toastUntil = performance.now() + 3200; this.toast.classList.add('visible'); }
  update(player: Vehicle, traffic: Traffic, time = 0, score?:DriveScore): void {
    const write = (id: string, value: string) => { const e = this.elements.get(id)!; if (e.textContent !== value) e.textContent = value; };
    write('score',(score?.value??0).toLocaleString('en-US'));write('score-multiplier','CLEAN ×'+(score?.multiplier??1).toFixed(1));
    write('speed', String(Math.round(Math.abs(player.speed) * MPS_TO_MPH)));
    const charge=Math.round(player.nitroFuel/NITRO_DURATION*100),nitroLabel=player.nitro>0?`NITRO · ACTIVE · ${charge}%`:!player.nitroReady?`NITRO · RECHARGING ${player.nitroCooldown.toFixed(1)}s`:`NITRO · HOLD SHIFT · ${charge}%`;
    write('nitro-status',nitroLabel);
    const nitroButton=document.querySelector<HTMLElement>('[data-nitro]');
    if(nitroButton){nitroButton.textContent=player.nitro>0?`BOOST ${charge}%`:!player.nitroReady?`${Math.ceil(player.nitroCooldown)}s`:`NITRO ${charge}%`;nitroButton.setAttribute('aria-label',player.nitro>0?`Nitro active, ${charge} percent; release to stop`:!player.nitroReady?`Nitro recharging, ${Math.ceil(player.nitroCooldown)} seconds`:'Hold for nitro boost');}
    write('gear', player.speed < -.2 ? 'R' : `D${player.gear}`);
    write('distance', (player.distance / 1000).toFixed(2)); write('integrity', `${Math.round(100 - player.damage)}%`);
    write('shield-status', player.shield > 0 ? `◇ SHIELD · ${player.shield.toFixed(1)}s · DAMAGE PROTECTION` : '◇ SHIELD · FIND A GREEN PICKUP');
    write('turbo-status', player.turbo > 0 ? `ϟ TURBO · ${player.turbo.toFixed(1)}s · HOLD W / GO` : 'ϟ TURBO · FIND AN AMBER PICKUP');
    write('pulse-status',player.pulseCooldown>0?`✦ PULSE · RECHARGING ${player.pulseCooldown.toFixed(1)}s`:'✦ PULSE · Q FRONT / E REAR · READY');
    this.elements.get('shield-status')!.classList.toggle('active', player.shield > 0);
    this.elements.get('turbo-status')!.classList.toggle('active', player.turbo > 0);
    write('pursuit-level', Array.from({ length: 5 }, (_, i) => i < traffic.level ? '◆' : '◇').join(' '));
    const nearest = traffic.agents.filter(a => a.kind === 'police' && a.active).sort((a, b) => Math.abs(a.s - player.s) - Math.abs(b.s - player.s))[0];
    const pursuitLabel = this.elements.get('pursuit-level')!.previousElementSibling!;
    const pursuitTitle = traffic.level ? 'PURSUIT ACTIVE' : 'CRUISING / POLICE PATROLS';
    if (pursuitLabel.textContent !== pursuitTitle) pursuitLabel.textContent = pursuitTitle;
    write('police-state', !traffic.level ? 'OVERTAKING A PATROL ALERTS POLICE' : traffic.capture > 0 ? `CAPTURE IN ${(5 - traffic.capture).toFixed(1)}s · KEEP MOVING` : `POLICE ${nearest?.state.toUpperCase() ?? 'PURSUING'}`);
    const detour = road.onDetour(player.x, player.s); write('route-name', player.x < 0 ? 'ONCOMING LANES · WATCH FOR HEAD-ON TRAFFIC' : detour ? `${road.routeAt(player.s)?.name ?? 'SIDE STREET'} · REJOINS AHEAD` : 'SUNSET EXPRESSWAY');
    const route = road.routeAt(player.s) ?? road.entryWindow(player.s);
    write('navigation-label', route ? `↗ ${route.name} · ${player.s < route.exit ? 'EXIT AHEAD' : 'MERGES AHEAD'}` : 'N ↑ SUNSET EXPRESSWAY');
    const view = this.records.settings.view; document.body.dataset.view = view; write('view-label', `${view.toUpperCase()} CAMERA`);
    this.elements.get('rpm')!.style.width = `${player.rpm / 7000 * 100}%`;
    this.elements.get('health-bar')!.style.width = `${100 - player.damage}%`;
    this.elements.get('capture')!.style.width = `${traffic.capture / 5 * 100}%`;
    this.elements.get('drive-hint')!.textContent = player.damage > 70 ? 'HEAVY BODY DAMAGE · KEEP DRIVING' : 'W ACCELERATE · S BRAKE · SPACE HANDBRAKE';
    if (performance.now() > this.toastUntil) this.toast.classList.remove('visible');
    drawNavigation(this.map.getContext('2d')!, player, traffic, time);
  }
  loading(active: boolean): void { document.getElementById('load-status')!.hidden = !active; }
  error(message?: string): void { const fatal = document.getElementById('fatal')!; if (message) fatal.textContent = message; fatal.hidden = false; }
}
