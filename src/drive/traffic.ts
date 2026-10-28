import { COLLISION_PROFILES } from './collision-profiles';
import { VEHICLE_CATALOG } from './vehicle-catalog';
import { CYBER_VEHICLES,chooseCivilian,cyberHull,type CyberModel } from './cyber-vehicles';
import { Random, hashSeed } from '../core/random';
import { POLICE_TUNE, LANES, ONCOMING, clamp, damp, neutral, type Controls, type Density } from './config';
import { road, type Route } from './road';
import { Vehicle, steeringLimit, type HitBox } from './vehicle';
import { isFrontalCrash, isSevereVehicleImpact, solveContact, sweptBounds, sweptClearance, type Body2D, type Contact } from './collisions';
import { medianBarriers } from './median';
export type PursuitState = 'patrolling' | 'following' | 'closing' | 'avoiding' | 'changing lanes' | 'flanking' | 'recovering' | 'searching' | 'rejoining' | 'ramming';
export interface Agent extends HitBox {
  model?:CyberModel; emergency?:boolean;trailerAngle?:number;
  id: number; oldX: number; oldS: number; speed: number; desired: number; lane: number; direction: 1 | -1;
  kind: 'sedan' | 'suv' | 'pickup' | 'hatchback' | 'van' | 'truck' | 'sport' | 'police'; targetX: number; cooldown: number;
  state: PursuitState; route: 'main' | 'detour'; near: boolean; impact: number;
  active: boolean; yaw: number; lateral: number; spin: number; damage: number; pursuitTime: number;
  steering?: number; roll?: number; pitch?: number; braking?: boolean; signal?: -1 | 0 | 1; routeId?: number;
}
const capacities = { low: 24, normal: 44, high: 62, dense: 80 };
const masses = { ...Object.fromEntries(Object.entries(VEHICLE_CATALOG).map(([kind, spec]) => [kind, spec.mass])), van: 2600 } as Record<Agent['kind'], number>;
// Pursuit units need a speed reserve above the player's 180 mph highway limit.
const pursuitSpeed=Math.max(...Object.values(CYBER_VEHICLES).filter(s=>s.emergency==='police').map(s=>s.speed));
export class Traffic {
  agents: Agent[] = [];
  level = 0; capture = 0; nearMisses = 0; collisions = 0; pressure = 0; joins = 0;
  private random: Random; private serial = 0;
  private contacts = new Map<string, number>();
  private scoreContacts = new Map<number,number>();
  private ramCooldown = new Map<number,number>();
  private closePasses = new Map<number, { clearance: number; touched: boolean }>();
  private passing = new Map<number, { blocker: number; lane: number }>();
  private policeVehicles = new Map<number, Vehicle>();
  private refusedRoutes = new Map<number, number>();
  constructor(seed: string, readonly density: Density = 'normal') { this.random = new Random(hashSeed(seed)); }
  reset(): void {
    this.agents = []; this.level = 0; this.capture = 0; this.nearMisses = 0; this.collisions = 0; this.pressure = 0; this.joins = 0; this.contacts.clear(); this.scoreContacts.clear(); this.ramCooldown.clear(); this.closePasses.clear(); this.passing.clear(); this.policeVehicles.clear(); this.refusedRoutes.clear();
    for (let i = 0; i < capacities[this.density]; i++) this.spawn(0, i, true);
  }
  private spawn(playerS: number, index: number, initial = false): void {
    const r = this.random, direction = index % 3 === 0 ? -1 : 1;
    const police = index % 13 === 1 && direction === 1;
    const lane = police ? 0 : Math.floor(r.next() * 4), x = (direction === 1 ? LANES : ONCOMING)[lane];
    let s = playerS + (initial ? (police && index === 1 ? 72 : 130 + index * 17) : 800 + r.range(0, 220));
    while (this.agents.some(a => a.direction === direction && a.lane === lane && Math.abs(a.s - s) < 38)) s += 40;
    const patrols:CyberModel[]=this.level>=4?['vortex','phantom','sentinel','barricade']:['vortex','phantom','sentinel'];
    const spec=police?CYBER_VEHICLES[patrols[Math.floor(index/13)%patrols.length]]:chooseCivilian(r.next());
    const {kind,id:model}=spec;
    const desired=police?22:spec.speed*r.range(.88,1.06);
    this.agents.push({ id: this.serial++, x, oldX: x, s, oldS: s, width:spec.width,
      length:spec.length, kind,model,emergency:model==='aegis'&&index%2===0,direction, lane,
      speed: police ? 20 : r.range(18, 30), desired, targetX: x, cooldown: r.range(1, 7),
      state: 'patrolling', route: 'main', near: false, impact: 0, active: false, yaw: direction === 1 ? 0 : Math.PI,
      lateral: 0, spin: 0, damage: 0, pursuitTime: 0, steering: 0, roll: 0, pitch: 0, braking: false, signal: 0 });
  }
  activate(a: Agent): boolean {
    if (a.kind !== 'police' || a.active || this.activePolice.length >= 8) return false;
    a.active = true; a.state = 'closing'; a.cooldown = 0; this.joins++; return true;
  }
  get activePolice(): Agent[] { return this.agents.filter(a => a.kind === 'police' && a.active); }
  /** Fire a directional pulse at the nearest car in a broad lane-sized cone. */
  firePulse(player:Vehicle,direction:1|-1): {status:'hit'|'empty'|'recharging'; target?:Agent} {
    if(player.pulseCooldown>0)return {status:'recharging'};
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
    const candidates=this.agents.map(agent=>{
      const dx=agent.x-player.x,ds=agent.s-player.s;
      return {agent,forward:direction*(ds*cos+dx*sin),side:Math.abs(dx*cos-ds*sin)};
    }).filter(item=>item.forward>2&&item.forward<100&&item.side<15).sort((a,b)=>a.forward-b.forward);
    const target=candidates[0]?.agent;if(!target)return {status:'empty'};
    this.agents=this.agents.filter(a=>a!==target);
    this.policeVehicles.delete(target.id);this.closePasses.delete(target.id);this.scoreContacts.delete(target.id);
    this.ramCooldown.delete(target.id);this.refusedRoutes.delete(target.id);this.passing.delete(target.id);
    this.spawn(player.s,target.id);player.pulseCooldown=5;
    return {status:'hit',target};
  }
  laneSafe(agent: Agent, lane: number): boolean {
    return !this.agents.some(a => a !== agent && a.direction === agent.direction &&
      Math.abs(a.x - (agent.direction === 1 ? LANES : ONCOMING)[lane]) < 2.9 &&
      Math.abs(a.s-agent.s)<(agent.kind==='police'&&agent.active?Math.max(14,agent.speed*.45,Math.abs(a.speed-agent.speed)*.6):Math.max(24,agent.speed*1.3)));
  }
  private navigateRoute(a: Agent, player: Vehicle, pursuing: boolean, speed: number): number {
    if (a.direction !== 1) return speed;
    const entry = road.entryWindow(a.s), playerRoute = road.routeAt(player.s);
    if (a.routeId === undefined && entry && this.refusedRoutes.get(a.id) !== entry.id) {
      const wantsDetour = pursuing ? playerRoute?.id === entry.id && player.x > 14.8 : a.kind !== 'police' && a.id % 9 === 0;
      if (wantsDetour) { a.routeId = entry.id; a.route = 'detour'; this.passing.delete(a.id); }
    }
    if (a.routeId === undefined) return speed;
    const route = road.routeAt(a.routeId * road.interval + road.exitAt) as Route;
    if (a.s > route.rejoin) {
      a.routeId = undefined; a.route = 'main'; a.lane = 3; a.targetX = LANES[3]; return speed;
    }
    if (a.s >= route.exit && a.x < 11.8) {
      // An occupied exit lane is missed, rather than crossing a separated gore later.
      this.refusedRoutes.set(a.id, route.id); a.routeId = undefined; a.route = 'main'; return speed;
    }
    a.route = 'detour'; a.lane = 3;
    if (a.s < route.exit) { a.targetX = LANES[3]; return Math.min(speed, 30); }
    const sample = road.sampleDetour(a.s)!;
    const preview = road.sampleDetour(Math.min(route.rejoin, a.s + Math.max(10, a.speed * .65)))!;
    a.targetX = preview.x;
    let limit = sample.speedLimit;
    const approachingReturn = a.s > route.mergeStart - 80;
    if (approachingReturn) {
      const mergingTraffic = this.agents.some(b => b !== a && b.direction === 1 && b.route !== 'detour' &&
        Math.abs(b.x - LANES[3]) < 2.7 && Math.abs(b.s - a.s) < Math.max(24, a.speed * 1.5));
      if (mergingTraffic && a.s >= route.mergeStart - 15) { a.targetX = Math.max(17.3, sample.x); limit = 0; a.state = 'avoiding'; }
    }
    return Math.min(speed, limit);
  }
  private drivePolice(a: Agent, targetSpeed: number, dt: number): void {
    let vehicle = this.policeVehicles.get(a.id);
    if (!vehicle) {
      const spec=a.model&&CYBER_VEHICLES[a.model];
      const tuning=spec?{...POLICE_TUNE,width:spec.width,length:spec.length,footprint:cyberHull(spec.id),mass:spec.mass,wheelbase:spec.wheelbase,maxSpeed:spec.speed,engineForce:spec.mass*spec.acceleration*1.95,brakeForce:spec.mass*16,steerSlew:POLICE_TUNE.steerSlew*spec.agility}:POLICE_TUNE;
      vehicle=new Vehicle(tuning,-Infinity);this.policeVehicles.set(a.id,vehicle);
    }
    // Agent state also accepts externally applied contact impulses and deterministic test setup.
    vehicle.x = a.x; vehicle.s = a.s; vehicle.yaw = a.yaw; vehicle.spin = a.spin; vehicle.damage = a.damage;
    vehicle.setWorldVelocity(a.lateral, a.speed);
    const controls = this.policeControls(a, vehicle, targetSpeed);
    vehicle.step(dt, controls, true, 1, (x,s,yaw) => road.constrainPolice(x,s,yaw,vehicle!.tuning.footprint,a.route));
    a.x = vehicle.x; a.s = vehicle.s; a.yaw = vehicle.yaw; a.speed = Math.max(0, vehicle.velocityS);
    a.lateral = vehicle.lateral; a.spin = vehicle.spin; a.steering = vehicle.steering;
    a.roll = vehicle.roll; a.pitch = vehicle.pitch; a.braking = controls.brake > .02;
  }
  private policeControls(a: Agent, vehicle: Vehicle, targetSpeed: number): Controls {
    const controls = neutral(), speed = Math.max(0, vehicle.speed), tune = vehicle.tuning;
    const lookahead = Math.max(12, speed * .65);
    const target = road.constrainPolice(a.targetX, a.s + lookahead, 0, tune.footprint, a.route);
    const heading = Math.atan2(target - a.x, lookahead);
    const turn = (heading - vehicle.yaw) * 2.8;
    const desiredSteer = Math.atan(turn * tune.wheelbase / Math.max(4, speed));
    controls.steer = clamp(desiredSteer / steeringLimit(speed, tune.wheelbase), -1, 1);
    const reserve=a.model?CYBER_VEHICLES[a.model].acceleration:9.5;
    const acceleration=clamp((targetSpeed-speed)*2,-10,a.route==='detour'?4.8:Math.abs(controls.steer)>.18?6.8:reserve);
    const resistance = tune.drag * speed * speed + tune.rolling;
    if (targetSpeed < .05 && speed < .05) { controls.brake = 1; controls.throttle = 1; }
    else if (acceleration < -resistance / tune.mass) controls.brake = clamp((-acceleration * tune.mass - resistance) / tune.brakeForce, 0, 1);
    else controls.throttle = clamp((acceleration * tune.mass + resistance) / (tune.engineForce * Math.max(.22, 1 - speed / tune.driveFalloffSpeed) * (1 - vehicle.damage * tune.damagePowerLoss)), 0, 1);
    return controls;
  }
  step(dt: number, player: Vehicle, elapsed: number): { hit: boolean; near: boolean; boost: boolean; touching: boolean; contacts: Contact[]; scoreHits: Contact[]; explosions:{id:number;x:number;s:number}[]; joined: number } {
    const beforeJoins = this.joins;
    let hit = false, near = false, boost = false;
    for (const a of this.agents) {
      a.oldX = a.x; a.oldS = a.s; a.cooldown -= dt; a.impact = Math.max(0, a.impact - dt);
      const police = a.kind === 'police' && a.active, gap = player.s - a.s;
      let targetSpeed = a.desired;
      if (police) {
        a.pursuitTime += dt;
        if (a.impact > 0) { a.state = 'recovering'; targetSpeed = Math.max(16,player.speed*.94); }
        else if (gap > 380) { a.state = 'searching'; targetSpeed = Math.min(pursuitSpeed, Math.max(46,player.speed+28)); }
        else if (gap > 200) { a.state = 'rejoining'; targetSpeed = Math.min(pursuitSpeed, Math.max(42,player.speed+24)); }
        else {
          a.state = gap > 26 ? 'closing' : this.level >= 2 ? 'flanking' : 'following';
          // Line up with room to brake; a clear rear-quarter attack below overrides this cruising gap.
          const followingGap=6+Math.max(0,player.speed)*.12;
          targetSpeed = clamp(player.speed + (gap-followingGap)*.65-Math.max(0,a.speed-player.speed)*1.2, 0, pursuitSpeed);
        }
        if (a.route !== 'detour') {
          const pass = this.passing.get(a.id);
          const blocker = pass && this.agents.find(b => b.id === pass.blocker);
          // Hold the free lane until the whole SUV has passed, instead of chasing
          // the player's lane again on the very next frame.
          if (pass && (!blocker || a.s - blocker.s > (a.length + blocker.length) / 2 + Math.max(12,a.speed*.24))) this.passing.delete(a.id);
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
        if (a.cooldown <= 0 && a.route === 'main' && a.impact <= 0 && (!police||this.passing.get(a.id)?.blocker!==front.id)) {
          const alternatives = [a.lane - 1, a.lane + 1].filter(l => l >= 0 && l < 4 && this.laneSafe(a, l));
          if (alternatives.length) {
            a.lane = alternatives[0]; a.targetX = (a.direction === 1 ? LANES : ONCOMING)[a.lane]; a.cooldown=police?.65:6;
            if (police) { this.passing.set(a.id, { blocker: front.id, lane: a.lane }); a.state = 'changing lanes'; }
          }
        }
      }
      const sameRoad=a.route==='detour' ? road.onDetour(player.x,player.s) && road.sampleDetour(a.s)?.phase==='service'
        : !road.onDetour(player.x,player.s);
      const attack=police && a.pursuitTime>1 && a.impact<=0 && elapsed>=(this.ramCooldown.get(a.id)??0) &&
        gap>0 && gap<90 && player.velocityS>8 && Math.abs(a.yaw)<.16 && Math.abs(a.lateral)<6 && Math.abs(a.x-player.x)<4 && sameRoad && !this.passing.has(a.id) &&
        (!front || frontGap>12+a.speed*1.5);
      if(attack){
        // Aim at a rear quarter with a finite closing speed. The shared contact solver supplies the impact.
        const side=player.x>14?-1:player.x<3?1:a.id%2?1:-1;
        const prediction=clamp(gap/Math.max(15,a.speed),.1,.4);
        const rearX=player.x-Math.sin(player.yaw)*player.tuning.length*.45;
        a.targetX=road.constrainPolice(rearX+player.lateral*prediction+side*.9,a.s,0,a.model?cyberHull(a.model):POLICE_TUNE.footprint,a.route);
        targetSpeed=Math.min(pursuitSpeed,player.velocityS+clamp(10+gap*.16,10,22));
        a.state='ramming';
      } else if (a.direction === 1 && player.s > a.s && player.s - a.s < 10 + a.speed * 1.4 && Math.abs(player.x - a.x) < 2.6)
        targetSpeed = Math.min(targetSpeed, Math.max(0, player.speed + (player.s - a.s - 9) * .5));
      targetSpeed=this.navigateRoute(a,player,police,targetSpeed);
      if(a.model&&police)targetSpeed=Math.min(targetSpeed,CYBER_VEHICLES[a.model].speed);
      if(a.impact>0)targetSpeed*=police?.78:.5;
      const previousLateral = a.lateral, previousSpeed = a.speed, previousYaw = a.yaw;
      a.signal = Math.abs(a.targetX - a.x) > .8 ? Math.sign(a.targetX - a.x) as -1 | 1 : 0;
      a.braking = targetSpeed < a.speed - .4;
      if (a.kind === 'police') this.drivePolice(a, targetSpeed, dt);
      else {
        const spec=a.model&&CYBER_VEHICLES[a.model],agility=spec?spec.agility:1;
        a.speed += clamp(targetSpeed * (1 - a.damage * .003) - a.speed, -9 * dt, (spec?spec.acceleration:3) * dt);
        a.lateral = damp(a.lateral, clamp((a.targetX - a.x) * .9, -2.2*agility, 2.2*agility), a.impact > 0 ? .5 : 2*agility, dt);
        a.spin = damp(a.spin, 0, 3, dt);
        a.x += a.lateral * dt; a.s += a.speed * a.direction * dt;
        const heading = Math.atan2(a.lateral, a.speed * a.direction);
        a.yaw += Math.atan2(Math.sin(heading - a.yaw), Math.cos(heading - a.yaw)) * Math.min(1, dt * 3) + a.spin * dt;
        const wheelbase = spec?spec.wheelbase:a.kind === 'van' ? 3.1 : VEHICLE_CATALOG[a.kind].wheelbase;
        a.steering = Math.atan((a.yaw - previousYaw) / dt * wheelbase / Math.max(4, a.speed));
        a.roll = damp(a.roll ?? 0, clamp((a.lateral - previousLateral) / dt * .006 * a.direction, -.045, .045), 7, dt);
        a.pitch = damp(a.pitch ?? 0, clamp((a.speed - previousSpeed) / dt * .006, -.045, .045), 7, dt);
      }
      if(a.model==='titan')a.trailerAngle=damp(a.trailerAngle??0,clamp(-(a.steering??0)*.18,-.075,.075),2,dt);
      if (a.kind === 'police' && !a.active && player.previous.s <= a.oldS && player.s > a.s && Math.abs(player.x - a.x) < 18) this.activate(a);
    }
    const bodies: Body2D[] = [{ id: -1, x: player.x, s: player.s, oldX: player.previous.x, oldS: player.previous.s,
      vx: player.lateral, vs: player.velocityS, yaw: player.yaw, spin: player.spin,
      hull: player.tuning.footprint, mass: player.tuning.mass * (player.shield > 0 ? 50 : 1), width: player.tuning.width, length: player.tuning.length }, ...this.agents.map(a => ({
      id: a.id, x: a.x, s: a.s, oldX: a.oldX, oldS: a.oldS, vx: a.lateral, vs: a.speed * a.direction,
      yaw: a.yaw, spin: a.spin, hull: a.model?cyberHull(a.model,a.trailerAngle):a.kind==='van'?undefined:COLLISION_PROFILES[a.kind].hull, mass: a.model?CYBER_VEHICLES[a.model].mass:masses[a.kind], width: a.width, length: a.length })),
      ...medianBarriers(player.s, player.simulationTime, player.medianHeld).map(o=>({...o,oldX:o.x,oldS:o.s,vx:0,vs:0,yaw:0,spin:0,mass:1e12}))];
    // Measure the full approach/pass before impulses alter the swept poses. Reward only after separation.
    for (let i=0; i<this.agents.length; i++) {
      const a=this.agents[i], b=bodies[i+1], p=bodies[0];
      if (a.near || Math.abs(a.s-player.s)>22 || Math.abs(a.x-player.x)>7) {
        this.closePasses.delete(a.id); continue;
      }
      if (!this.closePasses.has(a.id) && a.oldS>player.previous.s)
        this.closePasses.set(a.id,{clearance:Infinity,touched:false});
      const pass=this.closePasses.get(a.id);
      if (pass) pass.clearance=Math.min(pass.clearance,sweptClearance(p,b));
    }
    let playerTouched=false, fatal=false;
    const destroyed=new Set<number>();
    // Cheap conservative bounds reject distant pairs before building rotated hulls.
    // Exact bounds remain authoritative for every possible contact.
    const broad=(body:Body2D)=>{const radius=Math.hypot(body.width,body.length);return {
      minX:Math.min(body.x,body.oldX)-radius,maxX:Math.max(body.x,body.oldX)+radius,
      minS:Math.min(body.s,body.oldS)-radius,maxS:Math.max(body.s,body.oldS)+radius};};
    const coarse=bodies.map(broad),bounds:Array<ReturnType<typeof sweptBounds>|undefined>=new Array(bodies.length);
    const impacts: Contact[] = [], scoreHits: Contact[] = [];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (a.id < -1 && b.id < -1 || destroyed.has(a.id) || destroyed.has(b.id)) continue;
      if(a.id===-1&&player.airborne){
        const other=b.id>=0?this.agents[j-1]:undefined;
        const height=other?(other.model?CYBER_VEHICLES[other.model].height:other.kind==='van'?2.45:COLLISION_PROFILES[other.kind].height):1.2;
        if(player.collisionHeight>height+.1)continue;
      }
      const ca=coarse[i],cb=coarse[j];
      if(ca.maxX<cb.minX||cb.maxX<ca.minX||ca.maxS<cb.minS||cb.maxS<ca.minS)continue;
      const aa=bounds[i]??(bounds[i]=sweptBounds(a)),bb=bounds[j]??(bounds[j]=sweptBounds(b));
      if(aa.maxX<bb.minX||bb.maxX<aa.minX||aa.maxS<bb.minS||bb.maxS<aa.minS)continue;
      const shielded = player.shield > 0 && a.id === -1 && b.id >= 0;
      const vx = a.vx, vs = a.vs, spin = a.spin;
      const contact = solveContact(a, b); if (!contact) continue; bounds[i]=undefined;bounds[j]=undefined;coarse[i]=broad(a);coarse[j]=broad(b); if(a.id < -1 || b.id < -1)contact.material='concrete';
      // A powered shield absorbs recoil; traffic still receives the collision impulse.
      if (shielded) { a.vx=vx; a.vs=vs; a.spin=spin; }
      if (contact.material === 'metal' && (a.id === -1 || b.id === -1) && player.shield <= 0 &&
          (isFrontalCrash(contact, player.yaw) || isSevereVehicleImpact(contact))) fatal = true;
      // A hard car-to-car collision can destroy either traffic vehicle too.
      if(isSevereVehicleImpact(contact) && !shielded) {
        if(a.id>=0)destroyed.add(a.id);
        if(b.id>=0)destroyed.add(b.id);
      }
      if (a.id===-1 || b.id===-1) {
        playerTouched=true;
        const other=a.id===-1?b.id:a.id;
        const pass=this.closePasses.get(other);
        if(pass) pass.touched=true;
        const last=this.scoreContacts.get(other)??-Infinity;
        if(elapsed-last>1) {
          scoreHits.push(contact);
          if (shielded) {
            // Clear a lane on either carriageway, choosing the road interior near an edge.
            const side = b.x > 12 ? -1 : b.x < -12 ? 1 : Math.abs(b.x) < 4 ? Math.sign(b.x) || 1
              : Math.abs(b.x-a.x) > .25 ? Math.sign(b.x-a.x) : b.x > 0 ? (b.x < 8.3 ? 1 : -1) : (b.x > -8.3 ? -1 : 1);
            const shove = clamp(6+contact.speed*.12,6,12);
            b.vx=side*clamp(Math.max(side*b.vx,shove),shove,12);
            b.spin=clamp(b.spin+side*.3,-.9,.9);
          }
        }
        this.scoreContacts.set(other,elapsed);
        const cop=this.agents.find(agent=>agent.id===other&&agent.kind==='police'&&agent.active);
        if(cop && contact.speed>.7)this.ramCooldown.set(cop.id,elapsed+1.6);
      }
      if (contact.speed < .7) continue;
      const key = `${a.id}:${b.id}`, last = this.contacts.get(key) ?? -Infinity;
      if (elapsed - last > .25) {
        impacts.push(contact); this.contacts.set(key, elapsed);
        for (const body of [a, b]) {
          if (body.id === -1) { if (player.collide(contact.speed * .75)) { hit = true; this.collisions++; } player.impactSide = contact.nx; }
          else if(body.id>=0) { const agent = this.agents.find(v => v.id === body.id)!; agent.damage = Math.min(100, agent.damage + contact.speed * .6); agent.impact=agent.kind==='police'?.7:1.2; if (a.id === -1 || b.id === -1) this.activate(agent); }
        }
      }
    }
    const speedBeforeContacts = Math.abs(player.speed);
    const p = bodies[0]; player.x = player.airborne && player.collisionHeight>1.3 ? road.constrainAirborne(p.x,p.s) : road.constrainPlayer(p.x, p.s, player.previous.x, player.simulationTime, player.medianHeld); player.s = p.s; player.setWorldVelocity(p.vx, p.vs);
    player.speed = clamp(player.speed, -12, Math.max(85, player.speedLimit, speedBeforeContacts)); player.spin = clamp(p.spin, -.65, .65);
    this.agents.forEach((a, i) => {
      const b = bodies[i + 1];
      a.x = a.kind==='police' ? road.constrainPolice(b.x,b.s,b.yaw,a.model?cyberHull(a.model):POLICE_TUNE.footprint,a.route)
        : a.direction === 1 ? road.constrain(b.x, b.s) : clamp(b.x, -15.45, -1.25);
      a.lateral = a.x!==b.x && b.vx*(b.x-a.x)>0 ? -b.vx*.15 : b.vx;
      a.s = b.s; a.speed = Math.max(0, b.vs * a.direction); a.spin = clamp(b.spin, -.9, .9);
      const pass=this.closePasses.get(a.id);
      if (pass) {
        const playerBounds=sweptBounds({...p,oldX:p.x,oldS:p.s});
        const agentBounds=sweptBounds({...b,x:a.x,oldX:a.x,oldS:b.s});
        if (playerBounds.minS>agentBounds.maxS+.15) {
          a.near=true; this.closePasses.delete(a.id);
          if (!pass.touched && !playerTouched && pass.clearance>=.08 && pass.clearance<=.85 && player.velocityS>12 && player.velocityS-b.vs>2) {
            this.nearMisses++; near=true; boost=player.boostClosePass() || boost;
          }
        } else if (a.s-player.s>30) this.closePasses.delete(a.id);
      }
    });
    const explosions=this.agents.filter(a=>destroyed.has(a.id)).map(a=>({id:a.id,x:a.x,s:a.s}));
    if(explosions.length){
      this.agents=this.agents.filter(a=>!destroyed.has(a.id));
      for(const a of explosions){this.policeVehicles.delete(a.id);this.closePasses.delete(a.id);this.scoreContacts.delete(a.id);this.ramCooldown.delete(a.id);this.refusedRoutes.delete(a.id);this.passing.delete(a.id);this.spawn(player.s,a.id);}
    }
    const active = this.activePolice;
    this.level = active.length ? Math.min(5, 1 + Math.floor(Math.max((this.joins - 1) * .8, active[0].pursuitTime / 100))) : 0;
    const close = active.some(a => Math.hypot(a.s - player.s, a.x - player.x) < 14);
    this.capture = close && Math.abs(player.speed) < 2.5 ? Math.min(5, this.capture + dt) : Math.max(0, this.capture - dt * 1.5);
    this.pressure = active.reduce((n, a) => Math.max(n, clamp(1 - Math.abs(a.s - player.s) / 150, 0, 1)), 0);
    // Active units persist; patrol/traffic recycling occurs beyond the rear view or in haze.
    const removed = this.agents.filter(a => !a.active && (a.s < player.s - 650 || a.s > player.s + 1700));
    this.agents = this.agents.filter(a => !removed.includes(a));
    for (const a of removed) { this.policeVehicles.delete(a.id); this.closePasses.delete(a.id); this.scoreContacts.delete(a.id); this.ramCooldown.delete(a.id); this.refusedRoutes.delete(a.id); this.passing.delete(a.id); this.spawn(player.s, a.id); }
    for (const [key, time] of this.contacts) if (elapsed - time > 5) this.contacts.delete(key);
    for(const [id,time]of this.scoreContacts)if(elapsed-time>5)this.scoreContacts.delete(id);
    if (fatal) player.explode();
    return { hit, near, boost, explosions, touching:playerTouched, contacts: impacts, scoreHits, joined: this.joins - beforeJoins };
  }
}
