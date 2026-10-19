import { Random, hashSeed } from '../core/random';
import { POLICE_SIZE, LANES, ONCOMING, clamp, damp, type Density } from './config';
import { road, roadsideObstacles } from './road';
import { Vehicle, type HitBox } from './vehicle';
import { solveContact, type Body2D, type Contact } from './collisions';
export type PursuitState = 'patrolling' | 'following' | 'closing' | 'avoiding' | 'changing lanes' | 'flanking' | 'recovering' | 'searching' | 'rejoining';
export interface Agent extends HitBox {
  id: number; oldX: number; oldS: number; speed: number; desired: number; lane: number; direction: 1 | -1;
  kind: 'sedan' | 'suv' | 'van' | 'truck' | 'sport' | 'police'; targetX: number; cooldown: number;
  state: PursuitState; route: 'main' | 'detour'; near: boolean; impact: number;
  active: boolean; yaw: number; lateral: number; spin: number; damage: number; pursuitTime: number;
}
const capacities = { low: 24, normal: 44, high: 62, dense: 80 };
const masses = { sedan: 1600, suv: 2200, van: 2600, truck: 9500, sport: 1450, police: 1900 };
// Pursuit units need a speed reserve above the player's 78 m/s highway limit.
const pursuitSpeed = 94;
export class Traffic {
  agents: Agent[] = [];
  level = 0; capture = 0; nearMisses = 0; collisions = 0; pressure = 0; joins = 0;
  private random: Random; private serial = 0;
  private contacts = new Map<string, number>();
  private passing = new Map<number, { blocker: number; lane: number }>();
  constructor(seed: string, readonly density: Density = 'normal') { this.random = new Random(hashSeed(seed)); }
  reset(): void {
    this.agents = []; this.level = 0; this.capture = 0; this.nearMisses = 0; this.collisions = 0; this.pressure = 0; this.joins = 0; this.contacts.clear(); this.passing.clear();
    for (let i = 0; i < capacities[this.density]; i++) this.spawn(0, i, true);
  }
  private spawn(playerS: number, index: number, initial = false): void {
    const r = this.random, direction = index % 3 === 0 ? -1 : 1;
    const police = index % 13 === 1 && direction === 1;
    const lane = police ? 0 : Math.floor(r.next() * 4), x = (direction === 1 ? LANES : ONCOMING)[lane];
    let s = playerS + (initial ? (police && index === 1 ? 72 : 130 + index * 17) : 800 + r.range(0, 220));
    while (this.agents.some(a => a.direction === direction && a.lane === lane && Math.abs(a.s - s) < 38)) s += 40;
    const kind = police ? 'police' : (['sedan', 'suv', 'van', 'sport', 'truck'] as const)[Math.floor(r.next() * 5)];
    const desired = police ? 22 : r.range(kind === 'truck' ? 20 : 24, kind === 'sport' ? 42 : 34);
    this.agents.push({ id: this.serial++, x, oldX: x, s, oldS: s, width: kind === 'truck' ? 2.5 : police ? POLICE_SIZE.width : 1.95,
      length: kind === 'truck' ? 9 : kind === 'van' ? 5.5 : police ? POLICE_SIZE.length : 4.6, kind, direction, lane,
      speed: police ? 20 : r.range(18, 30), desired, targetX: x, cooldown: r.range(1, 7),
      state: 'patrolling', route: 'main', near: false, impact: 0, active: false, yaw: direction === 1 ? 0 : Math.PI,
      lateral: 0, spin: 0, damage: 0, pursuitTime: 0 });
  }
  activate(a: Agent): boolean {
    if (a.kind !== 'police' || a.active || this.activePolice.length >= 8) return false;
    a.active = true; a.state = 'closing'; a.cooldown = 0; this.joins++; return true;
  }
  get activePolice(): Agent[] { return this.agents.filter(a => a.kind === 'police' && a.active); }
  laneSafe(agent: Agent, lane: number): boolean {
    return !this.agents.some(a => a !== agent && a.direction === agent.direction &&
      Math.abs(a.x - (agent.direction === 1 ? LANES : ONCOMING)[lane]) < 2.9 &&
      Math.abs(a.s - agent.s) < Math.max(24, agent.speed * 1.3));
  }
  step(dt: number, player: Vehicle, elapsed: number): { hit: boolean; near: boolean; contacts: Contact[]; joined: number } {
    const beforeJoins = this.joins;
    let hit = false, near = false;
    for (const a of this.agents) {
      a.oldX = a.x; a.oldS = a.s; a.cooldown -= dt; a.impact = Math.max(0, a.impact - dt);
      const police = a.kind === 'police' && a.active, gap = player.s - a.s;
      let targetSpeed = a.desired;
      if (police) {
        a.pursuitTime += dt;
        if (a.impact > 0) { a.state = 'recovering'; targetSpeed = Math.max(8, player.speed * .8); }
        else if (gap > 380) { a.state = 'searching'; targetSpeed = Math.min(pursuitSpeed, Math.max(32, player.speed + 16)); }
        else if (gap > 200) { a.state = 'rejoining'; targetSpeed = Math.min(pursuitSpeed, Math.max(30, player.speed + 14)); }
        else {
          a.state = gap > 26 ? 'closing' : this.level >= 4 ? 'flanking' : 'following';
          // Ease down before reaching the player; leave extra braking room at highway speed.
          const followingGap = 10 + Math.max(0, player.speed) * .22;
          targetSpeed = clamp(player.speed + (gap - followingGap) * .5, 0, pursuitSpeed);
        }
        const branch = road.branchCenter(a.s);
        a.route = player.x > 16 && branch !== undefined ? 'detour' : 'main';
        if (a.route === 'detour') { a.targetX = branch!; this.passing.delete(a.id); }
        else {
          const pass = this.passing.get(a.id);
          const blocker = pass && this.agents.find(b => b.id === pass.blocker);
          // Hold the free lane until the whole SUV has passed, instead of chasing
          // the player's lane again on the very next frame.
          if (pass && (!blocker || a.s - blocker.s > (a.length + blocker.length) / 2 + Math.max(18, a.speed * .4))) this.passing.delete(a.id);
          const maneuver = this.passing.get(a.id);
          if (maneuver) { a.lane = maneuver.lane; a.targetX = LANES[maneuver.lane]; a.state = 'changing lanes'; }
          else {
            const desiredX = player.x + (a.state === 'flanking' ? (a.id % 2 ? 2.8 : -2.8) : 0);
            const nextLane = LANES.reduce((best, x, i) => Math.abs(x - desiredX) < Math.abs(LANES[best] - desiredX) ? i : best, 0);
            if (a.cooldown <= 0 && this.laneSafe(a, nextLane)) { a.lane = nextLane; a.targetX = LANES[nextLane]; }
          }
        }
      } else a.state = a.impact > 0 ? 'recovering' : 'patrolling';
      let front: Agent | undefined, frontGap = Infinity;
      for (const b of this.agents) {
        if (a === b || b.direction !== a.direction || (Math.abs(a.x - b.x) > 2.7 && (!police || Math.abs(a.targetX - b.x) > 2.7))) continue;
        const spacing = (b.s - a.s) * a.direction - (a.length + b.length) / 2;
        if (spacing >= -1 && spacing < frontGap) { frontGap = spacing; front = b; }
      }
      if (front && frontGap < 12 + a.speed * 1.5) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, front.speed + (frontGap - 9 - a.speed * .8) * .6));
        if (police) a.state = 'avoiding';
        if (a.cooldown <= 0 && a.route === 'main' && a.impact <= 0) {
          const alternatives = [a.lane - 1, a.lane + 1].filter(l => l >= 0 && l < 4 && this.laneSafe(a, l));
          if (alternatives.length) {
            a.lane = alternatives[0]; a.targetX = (a.direction === 1 ? LANES : ONCOMING)[a.lane]; a.cooldown = police ? 1.5 : 6;
            if (police) { this.passing.set(a.id, { blocker: front.id, lane: a.lane }); a.state = 'changing lanes'; }
          }
        }
      }
      if (a.direction === 1 && player.s > a.s && player.s - a.s < 10 + a.speed * 1.4 && Math.abs(player.x - a.x) < 2.6)
        targetSpeed = Math.min(targetSpeed, Math.max(0, player.speed + (player.s - a.s - 9) * .5));
      if (!police && a.kind !== 'police' && a.direction === 1 && a.id % 9 === 0 && road.branchCenter(a.s) !== undefined) { a.route = 'detour'; a.targetX = road.branchCenter(a.s)!; targetSpeed = Math.min(targetSpeed, 24); }
      else if (!police && a.route === 'detour') { a.route = 'main'; a.targetX = LANES[a.lane]; }
      if (a.impact > 0) targetSpeed *= .5;
      const acceleration = police ? 6.8 - Math.min(1, a.speed / pursuitSpeed) * 2.6 : 3;
      a.speed += clamp(targetSpeed * (1 - a.damage * .003) - a.speed, (police ? -11.5 : -9) * dt, acceleration * dt);
      const lateralLimit = police ? 3.5 : 2.2;
      a.lateral = damp(a.lateral, clamp((a.targetX - a.x) * (police ? 1.3 : .9), -lateralLimit, lateralLimit), a.impact > 0 ? .5 : police ? 3.5 : 2, dt);
      a.spin = damp(a.spin, 0, 3, dt);
      a.x += a.lateral * dt; a.s += a.speed * a.direction * dt;
      const heading = Math.atan2(a.lateral, a.speed * a.direction);
      a.yaw += Math.atan2(Math.sin(heading - a.yaw), Math.cos(heading - a.yaw)) * Math.min(1, dt * 3) + a.spin * dt;
      if (a.kind === 'police' && !a.active && player.previous.s <= a.oldS && player.s > a.s && Math.abs(player.x - a.x) < 18) this.activate(a);
      if (!a.near && a.oldS >= player.previous.s && a.s < player.s) {
        a.near = true;
        if (Math.abs(a.x - player.x) < 3.2 && Math.abs(a.x - player.x) > 2 && player.speed > 22) { this.nearMisses++; near = true; }
      }
    }
    const bodies: Body2D[] = [{ id: -1, x: player.x, s: player.s, oldX: player.previous.x, oldS: player.previous.s,
      vx: player.lateral, vs: player.velocityS, yaw: player.yaw, spin: player.spin,
      mass: 1480, width: 1.95, length: 4.6 }, ...this.agents.map(a => ({
      id: a.id, x: a.x, s: a.s, oldX: a.oldX, oldS: a.oldS, vx: a.lateral, vs: a.speed * a.direction,
      yaw: a.yaw, spin: a.spin, mass: masses[a.kind], width: a.width, length: a.length })),
      ...roadsideObstacles(player.s).map(o=>({...o,oldX:o.x,oldS:o.s,vx:0,vs:0,yaw:0,spin:0,mass:1e12}))];
    const impacts: Contact[] = [];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (Math.abs(a.s - b.s) > (a.length + b.length) * .6 + Math.abs(a.vs - b.vs) * dt || Math.abs(a.x - b.x) > (a.length+b.length)*.6+Math.abs(a.vx-b.vx)*dt) continue;
      const contact = solveContact(a, b); if (!contact) continue; if(a.id < -1 || b.id < -1)contact.material='concrete';
      if (contact.speed < .7) continue;
      const key = `${a.id}:${b.id}`, last = this.contacts.get(key) ?? -Infinity;
      if (elapsed - last > .25) {
        impacts.push(contact); this.contacts.set(key, elapsed);
        for (const body of [a, b]) {
          if (body.id === -1) { if (player.collide(contact.speed * .75)) { hit = true; this.collisions++; } player.impactSide = contact.nx; }
          else if(body.id>=0) { const agent = this.agents.find(v => v.id === body.id)!; agent.damage = Math.min(100, agent.damage + contact.speed * .6); agent.impact = 1.2; if (a.id === -1 || b.id === -1) this.activate(agent); }
        }
      }
    }
    const p = bodies[0]; player.x = road.constrain(p.x, p.s); player.s = p.s; player.setWorldVelocity(p.vx, p.vs);
    player.speed = clamp(player.speed, -12, 85); player.spin = clamp(p.spin, -1.2, 1.2);
    this.agents.forEach((a, i) => {
      const b = bodies[i + 1]; a.x = a.direction === 1 ? road.constrain(b.x, b.s) : clamp(b.x, -15.45, -1.25);
      if (a.x !== b.x) { a.lateral = -b.vx * .2; a.speed *= .98; } else a.lateral = b.vx;
      a.s = b.s; a.speed = Math.max(0, b.vs * a.direction); a.spin = clamp(b.spin, -.9, .9);
    });
    const active = this.activePolice;
    this.level = active.length ? Math.min(5, 1 + Math.floor(Math.max((this.joins - 1) * .8, active[0].pursuitTime / 100))) : 0;
    const close = active.some(a => Math.hypot(a.s - player.s, a.x - player.x) < 14);
    this.capture = close && Math.abs(player.speed) < 2.5 ? Math.min(5, this.capture + dt) : Math.max(0, this.capture - dt * 1.5);
    this.pressure = active.reduce((n, a) => Math.max(n, clamp(1 - Math.abs(a.s - player.s) / 150, 0, 1)), 0);
    // Active units persist; patrol/traffic recycling occurs beyond the rear view or in haze.
    const removed = this.agents.filter(a => !a.active && (a.s < player.s - 650 || a.s > player.s + 1700));
    this.agents = this.agents.filter(a => !removed.includes(a));
    for (const a of removed) this.spawn(player.s, a.id);
    for (const [key, time] of this.contacts) if (elapsed - time > 5) this.contacts.delete(key);
    return { hit, near, contacts: impacts, joined: this.joins - beforeJoins };
  }
}
