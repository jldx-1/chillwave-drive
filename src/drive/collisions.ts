/** Planar rigid-body contacts. World s increases toward the horizon; yaw turns toward +x. */
export interface Body2D {
  id: number; x: number; s: number; oldX: number; oldS: number;
  vx: number; vs: number; yaw: number; spin: number; mass: number; width: number; length: number;
}
export interface Contact { a: number; b: number; x: number; s: number; nx: number; ns: number; speed: number; impulse: number; material: 'metal' | 'concrete' }
const dot = (ax: number, as: number, bx: number, bs: number) => ax * bx + as * bs;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const axes = (b: Body2D): [number, number][] => [[Math.cos(b.yaw), -Math.sin(b.yaw)], [Math.sin(b.yaw), Math.cos(b.yaw)]];
function radius(b: Body2D, nx: number, ns: number): number {
  const [right, forward] = axes(b);
  return Math.abs(dot(...right, nx, ns)) * b.width / 2 + Math.abs(dot(...forward, nx, ns)) * b.length / 2;
}
export function solveContact(a: Body2D, b: Body2D, restitution = .12): Contact | undefined {
  let penetration = Infinity, nx = 0, ns = 0, overlapping = true, previouslyOverlapping = true;
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    const delta = dot(b.x - a.x, b.s - a.s, ax, az), overlap = radius(a, ax, az) + radius(b, ax, az) - Math.abs(delta);
    if (overlap < 0) overlapping = false;
    if (Math.abs(dot(b.oldX-a.oldX,b.oldS-a.oldS,ax,az)) > radius(a,ax,az)+radius(b,ax,az)) previouslyOverlapping=false;
    if (overlap < penetration) { penetration = overlap; const sign = Math.sign(delta) || 1; nx = ax * sign; ns = az * sign; }
  }
  if (!overlapping || !previouslyOverlapping) {
    // Continuous relative sweep. Conservative bounds include each oriented body.
    let enter = 0, leave = 1, ex = 0, es = 0;
    for (const [ax, az] of [[1, 0], [0, 1]]) {
      const p = dot(b.oldX - a.oldX, b.oldS - a.oldS, ax, az);
      const d = dot((b.x - b.oldX) - (a.x - a.oldX), (b.s - b.oldS) - (a.s - a.oldS), ax, az);
      const half = radius(a, ax, az) + radius(b, ax, az);
      if (Math.abs(d) < 1e-8) { if (Math.abs(p) > half) return; continue; }
      const t1 = (-half - p) / d, t2 = (half - p) / d, start = Math.min(t1, t2);
      if (start > enter) { enter = start; const sign = Math.sign(p + d * start) || 1; ex = ax * sign; es = az * sign; }
      leave = Math.min(leave, Math.max(t1, t2)); if (enter > leave) return;
    }
    if (enter < 0 || enter > 1 || (!ex && !es)) return;
    a.x = a.oldX + (a.x - a.oldX) * enter; a.s = a.oldS + (a.s - a.oldS) * enter;
    b.x = b.oldX + (b.x - b.oldX) * enter; b.s = b.oldS + (b.s - b.oldS) * enter;
    nx = ex; ns = es; penetration = .01;
  }
  const ia = 1 / a.mass, ib = 1 / b.mass;
  const inertiaA = a.mass * (a.width ** 2 + a.length ** 2) / 12, inertiaB = b.mass * (b.width ** 2 + b.length ** 2) / 12;
  const rxA = clamp((b.x - a.x) / 2, -a.width * .45, a.width * .45), rsA = clamp((b.s - a.s) / 2, -a.length * .45, a.length * .45);
  const rxB = -rxA, rsB = -rsA;
  const rvx = b.vx + b.spin * rsB - a.vx - a.spin * rsA, rvs = b.vs - b.spin * rxB - a.vs + a.spin * rxA;
  const normalSpeed = dot(rvx, rvs, nx, ns), leverA = rsA * nx - rxA * ns, leverB = rsB * nx - rxB * ns;
  const denominator = ia + ib + leverA ** 2 / inertiaA + leverB ** 2 / inertiaB;
  const impulse = Math.max(0, -(1 + restitution) * normalSpeed / denominator);
  const tx = -ns, ts = nx, tangentA = rsA*tx-rxA*ts, tangentB = rsB*tx-rxB*ts;
  const tangentSpeed = dot(rvx,rvs,tx,ts) + impulse*(leverA*tangentA/inertiaA+leverB*tangentB/inertiaB);
  const friction = clamp(-tangentSpeed/(ia+ib+tangentA**2/inertiaA+tangentB**2/inertiaB),-impulse*.35,impulse*.35);
  const jx = nx * impulse + tx * friction, js = ns * impulse + ts * friction;
  a.vx -= jx * ia; a.vs -= js * ia; b.vx += jx * ib; b.vs += js * ib;
  a.spin -= (rsA * jx - rxA * js) / inertiaA; b.spin += (rsB * jx - rxB * js) / inertiaB;
  const correction = Math.max(0, penetration - .002) * .85 / (ia + ib);
  a.x -= nx * correction * ia; a.s -= ns * correction * ia; b.x += nx * correction * ib; b.s += ns * correction * ib;
  return { a: a.id, b: b.id, x: (a.x + b.x) / 2, s: (a.s + b.s) / 2, nx, ns, speed: Math.max(0, -normalSpeed), impulse, material: 'metal' };
}
