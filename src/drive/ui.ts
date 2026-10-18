import { drawNavigation } from './minimap';
import type { Preferences, Records, Result } from './storage';
import type { Vehicle } from './vehicle';
import type { Traffic } from './traffic';
import { road } from './road';
export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export class DriveUI {
  readonly canvas: HTMLCanvasElement;
  panel = '';
  private overlay: HTMLElement;
  private toast: HTMLElement;
  private map: HTMLCanvasElement;
  private toastUntil = 0;
  constructor(root: HTMLElement, private records: Records, action: (name: string) => void, change: () => void) {
    root.innerHTML = `
      <canvas id="world" tabindex="0" aria-label="Chillwave Drive interactive 3D highway"></canvas>
      <div class="screen-shade"></div><div id="windshield" aria-hidden="true">${Array.from({ length: 32 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 23) % 83}%;--drop:${2 + i % 4}px"></i>`).join('')}</div>
      <header class="header"><a class="brand" href="./" aria-label="Chillwave Drive home"><span class="brand-icon">≋</span><span>CHILLWAVE<span class="brand-sub">D R I V E</span></span></a><div class="header-right"><span class="weather">☂ &nbsp; RAIN / 18°C</span><button data-action="mute" aria-label="Toggle music">♫</button><button data-action="pause" id="pause-button" aria-label="Pause drive">Ⅱ</button></div></header>
      <main id="main-menu"><div class="eyebrow"><span class="status-dot"></span> AN ENDLESS DRIVING EXPERIENCE</div><h1>CHASE THE<br><em>AFTERGLOW.</em></h1><p>One highway. An endless sunset.<br>A city that never ends. Keep driving.</p><button class="start-button" data-action="start" disabled>START DRIVE <span>↗</span></button><nav><button data-action="garage">GARAGE</button><button data-action="controls">CONTROLS</button><button data-action="settings">SETTINGS</button></nav><div class="record"><span>PERSONAL BEST</span><strong id="menu-best">0.00 <small>KM</small></strong></div></main>
      <div class="menu-caption"><span>01 / SUNSET EXPRESSWAY</span><strong>THE LONG WAY HOME.</strong><span>RAIN ON THE WINDSHIELD. CHILLWAVE ON THE RADIO.</span></div>
      <footer class="menu-footer"><span>WASD TO DRIVE &nbsp; / &nbsp; C TO CHANGE VIEW</span><span>ORIGINAL SOUNDTRACK &nbsp; · &nbsp; NO DESTINATION</span><span>CHILLWAVE DRIVE / 01</span></footer>
      <section id="hud" aria-label="Driving instruments" hidden>
        <div class="distance-block"><span class="eyebrow">DISTANCE SURVIVED</span><strong><b id="distance">0.00</b> <small>KM</small></strong><span id="route-name">SUNSET EXPRESSWAY</span></div>
        <div class="pursuit"><span class="eyebrow">POLICE PATROLS</span><div id="pursuit-level">◆ ◇ ◇ ◇ ◇</div><span id="police-state">POLICE CLOSING</span><div class="capture-track"><span id="capture"></span></div></div>
        <div class="speedometer"><div class="speed-ring"><span id="gear">D1</span><strong id="speed">0</strong><small>KM/H</small><div class="rev-track"><span id="rpm"></span></div></div><span id="view-label">CHASE CAMERA</span></div>
        <div class="vehicle-health"><span>VEHICLE INTEGRITY <b id="integrity">100%</b></span><div><span id="health-bar"></span></div><small id="drive-hint">W ACCELERATE · S BRAKE · SPACE HANDBRAKE</small></div>
        <div class="navigation"><canvas id="minimap" width="220" height="180" aria-label="Nearby traffic and route map"></canvas><span id="navigation-label">N &nbsp; ↑ &nbsp; SUNSET EXPRESSWAY</span><small>C CAMERA &nbsp; V LOOK BACK &nbsp; F LIGHTS</small></div>
        <div class="touch-controls"><div><button data-key="KeyA" aria-label="Steer left">◀</button><button data-key="KeyD" aria-label="Steer right">▶</button></div><div><button data-action="camera" aria-label="Change camera">C</button><button data-key="KeyS" aria-label="Brake">BRAKE</button><button data-key="KeyW" aria-label="Accelerate">GO</button></div></div>
      </section><div id="toast" role="status"></div><div id="overlay" hidden></div><div id="fatal" role="alert" hidden>WebGL is unavailable. Enable hardware acceleration and reload in a modern browser.</div>`;
    this.canvas = root.querySelector('#world')!; this.overlay = root.querySelector('#overlay')!; this.toast = root.querySelector('#toast')!; this.map = root.querySelector('#minimap')!;
    root.addEventListener('click', e => { const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (button) action(button.dataset.action!); });
    root.addEventListener('input', e => {
      const input = e.target as HTMLInputElement, key = input.dataset.setting as keyof Preferences;
      if (!key) return;
      const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      Object.assign(this.records.settings, { [key]: value }); this.records.save(); change();
    });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || this.overlay.hidden) return;
      const controls = [...this.overlay.querySelectorAll<HTMLElement>('button,select,input,a[href]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    this.setMode('menu');
  }
  setMode(mode: Mode): void {
    document.body.dataset.state = mode;
    document.getElementById('main-menu')!.hidden = mode !== 'menu';
    document.getElementById('hud')!.hidden = mode === 'menu';
    document.querySelectorAll<HTMLElement>('.menu-caption,.menu-footer').forEach(e => e.hidden = mode !== 'menu');
    document.getElementById('pause-button')!.hidden = mode === 'menu';
    document.getElementById('menu-best')!.innerHTML = `${(this.records.best / 1000).toFixed(2)} <small>KM</small>`;
    this.close();
  }
  close(): void { this.overlay.hidden = true; this.overlay.innerHTML = ''; this.panel = ''; this.canvas.focus(); }
  open(panel: string, result?: Result, reason = ''): void {
    this.panel = panel; const s = this.records.settings;
    let content = '';
    if (panel === 'pause') content = `<div class="eyebrow">TAKE A BREATHER</div><h2>THE NIGHT<br>CAN WAIT.</h2><p>Your car, the rain, and the city will be right here.</p><button class="primary-button" data-action="resume">RESUME DRIVE ↗</button><button data-action="restart">RESTART DRIVE</button><button data-action="settings">AUDIO & GRAPHICS</button><button data-action="menu">MAIN MENU</button>`;
    if (panel === 'controls') content = `<div class="eyebrow">GET BEHIND THE WHEEL</div><h2>DRIVE YOUR<br>OWN WAY.</h2><dl><dt>W / ↑</dt><dd>Accelerate</dd><dt>S / ↓</dt><dd>Brake / reverse · release and press again after stopping</dd><dt>A / D</dt><dd>Steer · ease off at high speed</dd><dt>SPACE</dt><dd>Handbrake · reduced rear grip</dd><dt>C</dt><dd>Switch cockpit / chase view</dd><dt>V</dt><dd>Hold to look behind</dd><dt>F / M</dt><dd>Headlights / music mute</dd><dt>ESC / R</dt><dd>Pause / restart after failure</dd></dl><p>To drift at speed, hold a steering direction and brake. Release the brake, countersteer and ease onto the accelerator to catch the slide.</p><p>Four lanes flow toward the sunset. Police patrol the highway. Passing a patrol triggers pursuit. Service loops branch right and rejoin the highway. Keep moving to avoid capture.</p><button class="primary-button" data-action="close">LET’S GO ↗</button>`;
    if (panel === 'garage') content = `<div class="eyebrow">YOUR GARAGE / 01</div><h2>AFTERGLOW<br>GT.</h2><p>A cyan 911 GT3 with sculpted coupe bodywork, oval headlights and a fixed rear wing. 1,480 kg. Six-speed automatic. Wet-road grip and speed-sensitive steering.</p><div class="garage-specs"><span>COLOUR <b>METALLIC CYAN</b></span><span>DRIVETRAIN <b>RWD / AUTO</b></span><span>CONDITIONS <b>WET ASPHALT</b></span></div><p class="muted">Porsche 911 GT3 model by ChevroletSS, CC-BY 4.0. Adapted for Chillwave Drive. <a href="./CREDITS.md" target="_blank" rel="noopener">Asset credits and licenses</a>.</p><button class="primary-button" data-action="close">BACK TO THE CITY ↗</button>`;
    if (panel === 'settings') content = `<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>YOUR DRIVE.<br>YOUR MOOD.</h2>
      <label>Graphics quality<select aria-label="Graphics quality" data-setting="quality">${['low', 'medium', 'high', 'ultra'].map(v => `<option ${s.quality === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Traffic density <small>Next drive</small><select aria-label="Traffic density" data-setting="density">${['low', 'normal', 'high', 'dense'].map(v => `<option ${s.density === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Steering sensitivity<input aria-label="Steering sensitivity" data-setting="sensitivity" type="range" min="0.5" max="1.5" step="0.05" value="${s.sensitivity}"></label>
      <label>Sound effects volume<input aria-label="Sound effects volume" data-setting="effectsVolume" type="range" min="0" max="1" step="0.01" value="${s.effectsVolume}"></label>
      <label>Music enabled<input aria-label="Music enabled" data-setting="musicEnabled" type="checkbox" ${s.musicEnabled ? 'checked' : ''}></label>
      <label>Music volume<input aria-label="Music volume" data-setting="musicVolume" type="range" min="0" max="1" step="0.01" value="${s.musicVolume}"></label>
      <label>Music style<select aria-label="Music style" data-setting="musicStyle">${['chillwave', 'vaporwave', 'mixed'].map(v => `<option ${s.musicStyle === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Reduced motion<input aria-label="Reduced motion" data-setting="reducedMotion" type="checkbox" ${s.reducedMotion ? 'checked' : ''}></label><p class="muted">Music and sound effects are original. <a href="./audio/LICENSE.txt" target="_blank" rel="noopener">Audio license</a>. Settings save on this device.</p><button class="primary-button" data-action="close">ALL SET ↗</button>`;
    if (panel === 'over' && result) content = `<div class="eyebrow">${reason}</div><h2>WHAT A<br>DRIVE.</h2><div class="result-distance">${(result.distance / 1000).toFixed(2)} <small>KM</small></div><div class="results"><span>TOP SPEED <b>${Math.round(result.topSpeed)} KM/H</b></span><span>AVERAGE SPEED <b>${Math.round(result.distance / Math.max(1, result.time) * 3.6)} KM/H</b></span><span>TIME SURVIVED <b>${Math.floor(result.time / 60)}:${String(Math.floor(result.time % 60)).padStart(2, '0')}</b></span><span>NEAR MISSES <b>${result.nearMisses}</b></span><span>PURSUIT LEVEL <b>${result.level} / 5</b></span><span>PERSONAL BEST <b>${(this.records.best / 1000).toFixed(2)} KM</b></span></div><button class="primary-button" data-action="restart">DRIVE AGAIN ↗</button><button data-action="menu">MAIN MENU</button>`;
    this.overlay.innerHTML = `<section class="panel" role="dialog" aria-modal="true" aria-label="${panel}">${content}</section>`;
    this.overlay.hidden = false; this.overlay.querySelector<HTMLElement>('button,select')?.focus();
  }
  notify(text: string): void { this.toast.textContent = text; this.toastUntil = performance.now() + 3200; this.toast.classList.add('visible'); }
  update(player: Vehicle, traffic: Traffic, time = 0): void {
    const write = (id: string, value: string) => { const e = document.getElementById(id)!; if (e.textContent !== value) e.textContent = value; };
    write('speed', String(Math.round(Math.abs(player.speed) * 3.6))); write('gear', player.speed < -.2 ? 'R' : `D${player.gear}`);
    write('distance', (player.distance / 1000).toFixed(2)); write('integrity', `${Math.round(100 - player.damage)}%`);
    write('pursuit-level', Array.from({ length: 5 }, (_, i) => i < traffic.level ? '◆' : '◇').join(' '));
    const nearest = traffic.agents.filter(a => a.kind === 'police' && a.active).sort((a, b) => Math.abs(a.s - player.s) - Math.abs(b.s - player.s))[0];
    document.querySelector<HTMLElement>('.pursuit>.eyebrow')!.textContent = traffic.level ? 'PURSUIT ACTIVE' : 'CRUISING / POLICE PATROLS';
    write('police-state', !traffic.level ? 'OVERTAKING A PATROL ALERTS POLICE' : traffic.capture > 0 ? `CAPTURE IN ${(5 - traffic.capture).toFixed(1)}s · KEEP MOVING` : `POLICE ${nearest?.state.toUpperCase() ?? 'PURSUING'}`);
    const detour = road.onDetour(player.x, player.s); write('route-name', detour ? 'SERVICE LOOP · REJOINS AHEAD' : 'SUNSET EXPRESSWAY');
    write('navigation-label', road.routeAt(player.s) ? '↗ SERVICE LOOP · MERGES AHEAD' : `N ↑ SUNSET EXPRESSWAY`);
    const view = this.records.settings.view; document.body.dataset.view = view; write('view-label', `${view.toUpperCase()} CAMERA`);
    document.getElementById('rpm')!.style.width = `${player.rpm / 7000 * 100}%`;
    document.getElementById('health-bar')!.style.width = `${100 - player.damage}%`;
    document.getElementById('capture')!.style.width = `${traffic.capture / 5 * 100}%`;
    document.getElementById('drive-hint')!.textContent = player.damage > 70 ? 'CRITICAL DAMAGE · DRIVE CAREFULLY' : 'W ACCELERATE · S BRAKE · SPACE HANDBRAKE';
    if (performance.now() > this.toastUntil) this.toast.classList.remove('visible');
    drawNavigation(this.map.getContext('2d')!, player, traffic, time);
  }
  error(): void { document.getElementById('fatal')!.hidden = false; }
}
