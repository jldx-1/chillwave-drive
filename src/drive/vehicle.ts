import { solveContact } from './collisions';
import type { CollisionHull } from './collision-profiles';
import { TUNE, clamp, damp, type Controls, type VehicleTuning } from './config';
import { road } from './road';
export interface Pose { x: number; s: number; yaw: number }
export interface HitBox { x: number; s: number; width: number; length: number; yaw?:number; hull?:CollisionHull }
/** Query the same swept oriented shapes used by the actual contact solver. */
export function sweptHit(a: Pose, b: Pose, oldBox: HitBox, box: HitBox): boolean {
  return !!solveContact(
    {id:0,x:b.x,s:b.s,oldX:a.x,oldS:a.s,vx:b.x-a.x,vs:b.s-a.s,yaw:b.yaw,spin:0,mass:TUNE.mass,width:TUNE.width,length:TUNE.length,hull:TUNE.footprint},
    {id:1,x:box.x,s:box.s,oldX:oldBox.x,oldS:oldBox.s,vx:box.x-oldBox.x,vs:box.s-oldBox.s,yaw:box.yaw??0,spin:0,mass:TUNE.mass,width:box.width,length:box.length,hull:box.hull}
  );
}
/** Wheel lock tapers progressively for small, controllable highway corrections. */
export const steeringLimit = (speed: number, wheelbase = TUNE.wheelbase): number => Math.min(.5 / (1 + Math.abs(speed) / 12 + (speed / 35) ** 2), Math.atan(10.8 * wheelbase / Math.max(1, speed ** 2)));
/** Assisted bicycle handling, with a shared wet/dry traction budget and momentum heading. */
export class Vehicle {
  constructor(readonly tuning: VehicleTuning = TUNE, readonly minimumS = -20) {}
  x = 6.5; s = 0; yaw = 0; speed = 0; lateral = 0; steering = 0; yawRate = 0; driftAmount = 0;
  boostPulse = 0;
  damage = 0; rpm = 850; gear = 1; slip = 0; acceleration = 0;
  spin = 0; impact = 0; impactSide = 0; barrierHit = 0;
  roll = 0; pitch = 0; headlights = true; distance = 0; topSpeed = 0;
  previous: Pose = { x: 6.5, s: 0, yaw: 0 };
  private hitCooldown = 0;
  private boostCooldown = 0;
  private braking = false;
  private travelYaw = 0;
  private travelRate = 0;
  private driftDirection = 0;
  private brakeToStop = false;
  get slipAngle(): number { return Math.atan2(Math.sin(this.yaw - this.travelYaw), Math.cos(this.yaw - this.travelYaw)); }
  get velocityS(): number { return this.speed * Math.cos(this.travelYaw); }
  /** Contacts preserve the actual world velocity, including sideways impacts. */
  setWorldVelocity(vx: number, vs: number): void {
    const sign = Math.sign(vx * Math.sin(this.yaw) + vs * Math.cos(this.yaw)) || 1;
    this.speed = Math.hypot(vx, vs) * sign; this.lateral = vx;
    if (Math.abs(this.speed) > .01) this.travelYaw = Math.atan2(vx * sign, vs * sign);
  }
  reset(): void { Object.assign(this, new Vehicle(this.tuning, this.minimumS)); }
  /** A small, non-stacking reward preserves the current momentum heading and ordinary speed cap. */
  boostClosePass(): boolean {
    if (this.boostCooldown > 0 || this.braking || this.speed < 12 || this.speed >= this.tuning.maxSpeed) return false;
    const scale = Math.min(this.tuning.maxSpeed, this.speed + 4) / this.speed;
    this.setWorldVelocity(this.lateral * scale, this.velocityS * scale);
    this.boostCooldown = 1.25;this.boostPulse=.32;
    return true;
  }
  step(dt: number, input: Controls, wet = true, sensitivity = 1,
    constrain: (x:number, s:number, yaw:number) => number = (x,s) => road.constrain(x,s)): void {
    this.barrierHit=0;
    this.previous = { x: this.x, s: this.s, yaw: this.yaw };
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.boostPulse=Math.max(0,this.boostPulse-dt);
    this.braking = input.brake > 0 || input.handbrake;
    if(this.braking)this.boostPulse=0;
    this.impact = damp(this.impact, 0, 5, dt);
    this.spin = damp(this.spin, 0, Math.abs(input.steer) > .02 ? 8 : 5, dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const speed = this.speed, pace = Math.abs(speed), grip = (wet ? this.tuning.wetGrip : this.tuning.dryGrip) * 9.81;
    const steerInput = clamp(input.steer, -1, 1);
    const breakaway = this.tuning.brakeDriftAssist && speed > 8 && Math.abs(steerInput) > .25 && (input.brake > .25 || input.handbrake);
    if (breakaway && (this.driftAmount < .08 || input.handbrake && this.driftDirection*this.slipAngle<.015)) this.driftDirection = Math.sign(steerInput);
    const countersteering = this.driftAmount > .02 && this.driftDirection * steerInput < -.15;
    const handbrakeCounter=input.handbrake && countersteering && this.tuning.brakeDriftAssist;
    const driftTarget = breakaway && (!countersteering || input.handbrake) ? clamp((speed - 8) / 6, 0, 1) * (wet || input.handbrake ? 1 : .82) : 0;
    this.driftAmount = damp(this.driftAmount, driftTarget, driftTarget > this.driftAmount ? 6 : countersteering ? 2 : 2.4, dt);
    if (pace < 3) this.driftAmount = damp(this.driftAmount, 0, 12, dt);
    const limit = Math.min(.5, steeringLimit(speed, this.tuning.wheelbase) * (1 + this.driftAmount * .85));
    let targetSteer = steerInput * limit * clamp(sensitivity, .5, 1.5);
    targetSteer = clamp(targetSteer, -limit, limit);
    const centering = Math.abs(targetSteer) < Math.abs(this.steering);
    const reversing = targetSteer * this.steering < 0;
    const response = (centering || reversing ? this.tuning.steerReturn : this.tuning.steerResponse) * Math.sqrt(clamp(sensitivity, .5, 1.5));
    // Reversing a held handbrake slide gives the front wheels the new command on this fixed step.
    if(handbrakeCounter && reversing)this.steering=0;
    const requested = damp(this.steering, targetSteer, response, dt);
    const slew = this.tuning.steerSlew * (centering || reversing ? 1.4 : 1) / (1 + pace / 60);
    this.steering += clamp(requested - this.steering, -slew * dt, slew * dt);

    if (!input.brake) this.brakeToStop = false;
    if (input.brake && speed > .02) this.brakeToStop = true;
    let drive = 0, braking = false;
    if (input.brake > 0 && input.throttle > 0) {
      drive = -Math.sign(speed) * this.tuning.brakeForce * Math.max(input.brake, input.throttle); braking = true;
    } else if (input.brake > 0) {
      if (speed > .02 || this.brakeToStop) { drive = -Math.sign(speed) * this.tuning.brakeForce * input.brake; braking = true; }
      else drive = -3800 * input.brake;
    } else if (input.throttle > 0) {
      if (speed < -.02) { drive = this.tuning.brakeForce * input.throttle; braking = true; }
      else drive = input.throttle * this.tuning.engineForce * (1 - this.damage * this.tuning.damagePowerLoss) * Math.max(.22, 1 - pace / this.tuning.driveFalloffSpeed);
    }
    if (input.handbrake) { drive -= Math.sign(speed) * this.tuning.mass * grip * .36; braking = true; }
    const plantedSteering = !input.brake && !input.handbrake && this.driftAmount < .05;
    // Reserve tire capacity as steering is requested, before the body has finished turning.
    const steeringDemand = Math.abs(speed * speed / this.tuning.wheelbase * Math.tan(this.steering));
    const reserve = plantedSteering ? Math.min(.7, steeringDemand / grip * .75) : 0;
    const cornerUse = clamp(Math.max(Math.abs(this.travelRate * speed) / grip, reserve), 0, .92);
    const traction = grip * Math.sqrt(1 - cornerUse ** 2) * (braking ? 1 : .83);
    const resistance = Math.sign(speed) * (this.tuning.drag * speed ** 2 + this.tuning.rolling) / this.tuning.mass;
    const longitudinal = clamp(drive / this.tuning.mass, -traction, traction);
    this.speed = clamp(speed + (longitudinal - resistance) * dt, -9, this.tuning.maxSpeed);
    if ((braking || !drive) && Math.sign(this.speed) !== Math.sign(speed)) this.speed = 0;
    if (!drive && Math.abs(this.speed) < .08) this.speed = 0;
    this.acceleration = (this.speed - speed) / dt;

    const desiredRate = this.speed / this.tuning.wheelbase * Math.tan(this.steering);
    const longitudinalUse = clamp(Math.abs(longitudinal) / grip, 0, .98);
    const lateralGrip = grip * Math.sqrt(1 - longitudinalUse ** 2) * (input.handbrake ? handbrakeCounter ? .95 : .48 : 1) * (plantedSteering || handbrakeCounter ? this.tuning.cornerAssist : 1);
    const maxRate = lateralGrip / Math.max(2.5, Math.abs(this.speed));
    const cornerRate = clamp(desiredRate, -maxRate, maxRate);
    // Rear breakaway rotates the body independently of the centre-of-mass trajectory.
    // Countersteering reduces the desired slip, rather than instantly reversing a slide.
    const steerAlongSlide = this.driftDirection * steerInput;
    const desiredSlip = handbrakeCounter ? steerInput*this.driftAmount*.62 : this.driftDirection * this.driftAmount * clamp(.14 + steerAlongSlide * (input.handbrake ? .48 : .40), 0, .62);
    const yawAuthority = handbrakeCounter ? 4.5 : countersteering ? 2.2 : 1.35;
    const slideRate = this.travelRate + clamp((desiredSlip - this.slipAngle) * (handbrakeCounter ? 12 : countersteering ? 7 : 4.5), -yawAuthority, yawAuthority);
    const targetRate = Math.abs(steerInput)<.02 ? cornerRate : cornerRate * (1 - this.driftAmount) + slideRate * this.driftAmount;
    this.yawRate = damp(this.yawRate, targetRate, handbrakeCounter ? 30 : countersteering ? 12 : this.driftAmount > .05 ? (input.handbrake ? 6 : 8) : 18, dt);
    if (pace < .25) this.yawRate = damp(this.yawRate, 0, 14, dt);
    this.yaw = clamp(this.yaw + (this.yawRate + this.spin) * dt, -1.2, 1.2);
    const headingError = this.slipAngle;
    const tracking = (input.handbrake ? 1.7 : this.driftAmount > .05 ? (wet ? 6.5 : 9.5) : (wet ? 15 : 18)) * (1 - this.driftAmount * .88);
    const requestedTurn=handbrakeCounter ? cornerRate*dt : headingError*(1-Math.exp(-dt*tracking));
    const travelTurn = clamp(requestedTurn, -maxRate * dt, maxRate * dt);
    this.travelRate = travelTurn / dt; this.travelYaw += travelTurn;
    const demand = Math.abs(desiredRate * this.speed);
    const slipDemand = clamp((demand - lateralGrip) / 12 + Math.abs(headingError) * 2 + (input.handbrake && pace > 2 ? .55 : 0) + this.driftAmount * .65, 0, 1);
    this.slip = damp(this.slip, slipDemand, 5, dt);
    this.lateral = Math.sin(this.travelYaw) * this.speed;
    this.x += this.lateral * dt; this.s = Math.max(this.minimumS, this.s + this.velocityS * dt);
    const constrained = constrain(this.x, this.s, this.yaw);
    if (constrained !== this.x) {
      this.impactSide = Math.sign(this.lateral);
      if (Math.abs(this.lateral) > 1 && this.collide(Math.abs(this.lateral) * .55)) this.barrierHit=Math.abs(this.lateral)*.55;
      const vs = this.velocityS;
      this.x = constrained; this.setWorldVelocity(-this.lateral * .18, vs * (1 - .3 * dt));
      this.spin += Math.sign(this.lateral) * Math.min(.25, Math.abs(this.lateral) * .04);
      this.yaw = damp(this.yaw, 0, 8, dt); this.yawRate = damp(this.yawRate, 0, 8, dt);
    }
    this.distance = Math.max(this.distance, this.s);
    this.topSpeed = Math.max(this.topSpeed, Math.abs(this.speed) * 3.6);
    this.gear = Math.min(6, Math.max(1, Math.floor(Math.abs(this.speed) / 13) + 1));
    this.rpm = damp(this.rpm, 850 + (Math.abs(this.speed) % 13) / 13 * 5300 + input.throttle * 650, 8, dt);
    this.roll = damp(this.roll, clamp(this.travelRate * this.speed * .006, -.045, .045), 7, dt);
    this.pitch = damp(this.pitch, clamp(this.acceleration * .006, -.045, .045), 7, dt);
  }
  collide(relativeSpeed: number): boolean {
    if (this.hitCooldown > 0) return false;
    this.damage = clamp(this.damage + Math.max(2, relativeSpeed * 1.25), 0, 100);
    this.impact = Math.min(1, relativeSpeed / 25); this.hitCooldown = .35; return true;
  }
  pose(alpha: number): Pose {
    return { x: this.previous.x + (this.x - this.previous.x) * alpha, s: this.previous.s + (this.s - this.previous.s) * alpha,
      yaw: this.previous.yaw + (this.yaw - this.previous.yaw) * alpha };
  }
}
