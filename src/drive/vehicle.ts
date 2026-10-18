import { TUNE, clamp, damp, type Controls } from './config';
import { road } from './road';
export interface Pose { x: number; s: number; yaw: number }
export interface HitBox { x: number; s: number; width: number; length: number }
/** Segment/AABB sweep in relative coordinates, including motion of both vehicles. */
export function sweptHit(a: Pose, b: Pose, oldBox: HitBox, box: HitBox): boolean {
  const px = a.x - oldBox.x, ps = a.s - oldBox.s;
  const dx = b.x - box.x - px, ds = b.s - box.s - ps;
  const bounds = [(TUNE.width + box.width) / 2, (TUNE.length + box.length) / 2];
  let enter = 0, leave = 1;
  for (const [p, d, half] of [[px, dx, bounds[0]], [ps, ds, bounds[1]]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(p) > half) return false; continue; }
    const t1 = (-half - p) / d, t2 = (half - p) / d;
    enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}
/** Wheel lock tapers progressively for small, controllable highway corrections. */
export const steeringLimit = (speed: number): number => Math.min(.5 / (1 + Math.abs(speed) / 12 + (speed / 35) ** 2), Math.atan(10.8 * TUNE.wheelbase / Math.max(1, speed ** 2)));
/** Assisted bicycle handling, with a shared wet/dry traction budget and momentum heading. */
export class Vehicle {
  x = 6.5; s = 0; yaw = 0; speed = 0; lateral = 0; steering = 0; yawRate = 0; driftAmount = 0;
  damage = 0; rpm = 850; gear = 1; slip = 0; acceleration = 0;
  spin = 0; impact = 0; impactSide = 0; alignment = 0;
  roll = 0; pitch = 0; headlights = true; distance = 0; topSpeed = 0;
  previous: Pose = { x: 6.5, s: 0, yaw: 0 };
  private hitCooldown = 0;
  private travelYaw = 0;
  private travelRate = 0;
  private driftDirection = 0;
  private handsOff = 0;
  private brakeToStop = false;
  get slipAngle(): number { return Math.atan2(Math.sin(this.yaw - this.travelYaw), Math.cos(this.yaw - this.travelYaw)); }
  get velocityS(): number { return this.speed * Math.cos(this.travelYaw); }
  /** Contacts preserve the actual world velocity, including sideways impacts. */
  setWorldVelocity(vx: number, vs: number): void {
    const sign = Math.sign(vx * Math.sin(this.yaw) + vs * Math.cos(this.yaw)) || 1;
    this.speed = Math.hypot(vx, vs) * sign; this.lateral = vx;
    if (Math.abs(this.speed) > .01) this.travelYaw = Math.atan2(vx * sign, vs * sign);
  }
  reset(): void { Object.assign(this, new Vehicle()); }
  step(dt: number, input: Controls, wet = true, sensitivity = 1): void {
    this.previous = { x: this.x, s: this.s, yaw: this.yaw };
    this.impact = damp(this.impact, 0, 5, dt);
    this.spin = damp(this.spin, 0, 3.5, dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const speed = this.speed, pace = Math.abs(speed), grip = (wet ? TUNE.wetGrip : TUNE.dryGrip) * 9.81;
    const steerInput = clamp(input.steer, -1, 1);
    const breakaway = speed > 8 && Math.abs(steerInput) > .25 && (input.brake > .25 || input.handbrake);
    if (breakaway && this.driftAmount < .08) this.driftDirection = Math.sign(steerInput);
    const countersteering = this.driftAmount > .02 && this.driftDirection * steerInput < -.15;
    const driftTarget = breakaway && !countersteering ? clamp((speed - 8) / 6, 0, 1) * (wet || input.handbrake ? 1 : .82) : 0;
    this.driftAmount = damp(this.driftAmount, driftTarget, driftTarget > this.driftAmount ? 6 : countersteering ? 2 : 2.4, dt);
    if (pace < 3) this.driftAmount = damp(this.driftAmount, 0, 12, dt);
    const limit = Math.min(.5, steeringLimit(speed) * (1 + this.driftAmount * .85));
    this.handsOff = Math.abs(steerInput) < .02 ? this.handsOff + dt : 0;
    let targetSteer = steerInput * limit * clamp(sensitivity, .5, 1.5) + this.alignment;
    // A gentle, visible countersteer settles a keyboard lane change. It never pulls the car into a lane.
    if (this.handsOff > .1 && pace > 5 && !input.handbrake && this.driftAmount < .05 && Math.abs(this.slipAngle) < .07 && Math.abs(this.spin) < .08) {
      const settlingRate = clamp(-this.yaw * 2.4, -.4, .4);
      targetSteer += Math.atan(settlingRate * TUNE.wheelbase / speed);
    }
    targetSteer = clamp(targetSteer, -limit, limit);
    const centering = Math.abs(targetSteer) < Math.abs(this.steering);
    const reversing = targetSteer * this.steering < 0;
    const response = (centering || reversing ? TUNE.steerReturn : TUNE.steerResponse) * Math.sqrt(clamp(sensitivity, .5, 1.5));
    const requested = damp(this.steering, targetSteer, response, dt);
    const slew = TUNE.steerSlew * (centering || reversing ? 1.4 : 1) / (1 + pace / 60);
    this.steering += clamp(requested - this.steering, -slew * dt, slew * dt);

    if (!input.brake) this.brakeToStop = false;
    if (input.brake && speed > .02) this.brakeToStop = true;
    let drive = 0, braking = false;
    if (input.brake > 0 && input.throttle > 0) {
      drive = -Math.sign(speed) * TUNE.brakeForce * Math.max(input.brake, input.throttle); braking = true;
    } else if (input.brake > 0) {
      if (speed > .02 || this.brakeToStop) { drive = -Math.sign(speed) * TUNE.brakeForce * input.brake; braking = true; }
      else drive = -3800 * input.brake;
    } else if (input.throttle > 0) {
      if (speed < -.02) { drive = TUNE.brakeForce * input.throttle; braking = true; }
      else drive = input.throttle * TUNE.engineForce * (1 - this.damage * .0035) * Math.max(.22, 1 - pace / 100);
    }
    if (input.handbrake) { drive -= Math.sign(speed) * TUNE.mass * grip * .36; braking = true; }
    const plantedSteering = !input.brake && !input.handbrake && this.driftAmount < .05;
    // Reserve tire capacity as steering is requested, before the body has finished turning.
    const steeringDemand = Math.abs(speed * speed / TUNE.wheelbase * Math.tan(this.steering));
    const reserve = plantedSteering ? Math.min(.7, steeringDemand / grip * .75) : 0;
    const cornerUse = clamp(Math.max(Math.abs(this.travelRate * speed) / grip, reserve), 0, .92);
    const traction = grip * Math.sqrt(1 - cornerUse ** 2) * (braking ? 1 : .83);
    const resistance = Math.sign(speed) * (TUNE.drag * speed ** 2 + TUNE.rolling) / TUNE.mass;
    const longitudinal = clamp(drive / TUNE.mass, -traction, traction);
    this.speed = clamp(speed + (longitudinal - resistance) * dt, -9, TUNE.maxSpeed);
    if ((braking || !drive) && Math.sign(this.speed) !== Math.sign(speed)) this.speed = 0;
    if (!drive && Math.abs(this.speed) < .08) this.speed = 0;
    this.acceleration = (this.speed - speed) / dt;

    const desiredRate = this.speed / TUNE.wheelbase * Math.tan(this.steering);
    const longitudinalUse = clamp(Math.abs(longitudinal) / grip, 0, .98);
    const lateralGrip = grip * Math.sqrt(1 - longitudinalUse ** 2) * (input.handbrake ? .48 : 1) * (plantedSteering ? TUNE.cornerAssist : 1);
    const maxRate = lateralGrip / Math.max(2.5, Math.abs(this.speed));
    const cornerRate = clamp(desiredRate, -maxRate, maxRate);
    // Rear breakaway rotates the body independently of the centre-of-mass trajectory.
    // Countersteering reduces the desired slip, rather than instantly reversing a slide.
    const steerAlongSlide = this.driftDirection * steerInput;
    const desiredSlip = this.driftDirection * this.driftAmount * clamp(.14 + steerAlongSlide * (input.handbrake ? .48 : .40), 0, .62);
    const yawAuthority = countersteering ? 2.2 : 1.35;
    const slideRate = this.travelRate + clamp((desiredSlip - this.slipAngle) * (countersteering ? 7 : 4.5), -yawAuthority, yawAuthority);
    const targetRate = cornerRate * (1 - this.driftAmount) + slideRate * this.driftAmount;
    this.yawRate = damp(this.yawRate, targetRate, countersteering ? 12 : this.driftAmount > .05 ? (input.handbrake ? 6 : 8) : 18, dt);
    if (pace < .25) this.yawRate = damp(this.yawRate, 0, 14, dt);
    this.yaw = clamp(this.yaw + (this.yawRate + this.spin) * dt, -1.2, 1.2);
    const headingError = this.slipAngle;
    const tracking = (input.handbrake ? 1.7 : this.driftAmount > .05 ? (wet ? 6.5 : 9.5) : (wet ? 15 : 18)) * (1 - this.driftAmount * .88);
    const travelTurn = clamp(headingError * (1 - Math.exp(-dt * tracking)), -maxRate * dt, maxRate * dt);
    this.travelRate = travelTurn / dt; this.travelYaw += travelTurn;
    const demand = Math.abs(desiredRate * this.speed);
    const slipDemand = clamp((demand - lateralGrip) / 12 + Math.abs(headingError) * 2 + (input.handbrake && pace > 2 ? .55 : 0) + this.driftAmount * .65, 0, 1);
    this.slip = damp(this.slip, slipDemand, 5, dt);
    this.lateral = Math.sin(this.travelYaw) * this.speed;
    this.x += this.lateral * dt; this.s = Math.max(-20, this.s + this.velocityS * dt);
    const constrained = road.constrain(this.x, this.s);
    if (constrained !== this.x) {
      this.impactSide = Math.sign(this.lateral);
      if (Math.abs(this.lateral) > 1) this.collide(Math.abs(this.lateral) * .55);
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
    this.impact = Math.min(1, relativeSpeed / 25); this.alignment = Math.sin(this.damage) * this.damage * .0006; this.hitCooldown = .35; return true;
  }
  pose(alpha: number): Pose {
    return { x: this.previous.x + (this.x - this.previous.x) * alpha, s: this.previous.s + (this.s - this.previous.s) * alpha,
      yaw: this.previous.yaw + (this.yaw - this.previous.yaw) * alpha };
  }
}
