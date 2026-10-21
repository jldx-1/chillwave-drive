import * as THREE from 'three';
import { Random } from '../core/random';
import { road, roadsideObstacles } from './road';
import { CITY_CHUNK, GROUND_HALF_WIDTH, type CityChunkSpec, type CityParcel } from './world-layout';
import { UrbanBatch } from './world-geometry';
import { CityMaterials } from './world-materials';
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function frontage(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  const front = p.x - p.side * (p.width / 2 + .04), rotation = -p.side * Math.PI / 2;
  for (let offset = -p.depth / 2 + 3; offset < p.depth / 2 - 1; offset += 5.5) {
    b.box(m.dark, front, 2.05, z + offset, .14, 3.8, 4.7);
    b.panel(m.glass, front - p.side * .09, 2.1, z + offset, 4.1, 3.2, rotation);
    b.box(m.steel, front - p.side * .14, 2.1, z + offset, .09, 3.3, .08);
    b.box(m.concrete, front - p.side * .14, .3, z + offset, .26, .45, 4.9);
    // Recessed glazed door, vertical pull, shaded reveal and a shallow fabric canopy.
    b.panel(m.dark, front - p.side * .12, 1.45, z + offset + 1.1, .95, 2.7, rotation);
    b.box(m.steel, front - p.side * .17, 1.38, z + offset + .75, .06, .55, .045);
    b.box(m.dark, front - p.side * .8, 3.85, z + offset, 1.8, .13, 4.8);
    b.box(m.steel, front - p.side * 1.66, 3.73, z + offset, .08, .24, 4.8);
    b.box(m.concrete, front - p.side * .18, 2.15, z + offset - 2.5, .45, 4.25, .33);
    b.panel(m.sign, front - p.side * .13, 1.55, z + offset - 1.1, 1.15, 1.7, rotation, m.signRects[(p.sign + 5) % 16]);
  }
  b.panel(m.sign, front - p.side * .13, 4.55, z, Math.min(12, p.depth - 3), 1.05, rotation, m.signRects[p.sign % 16]);
}
function rooftop(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number, height: number, width = p.width, depth = p.depth): void {
  b.box(m.dark, p.x, height + .18, z, width + .35, .36, depth + .35);
  b.box(m.concrete, p.x + width * .15, height + 1.4, z - depth * .15, width * .27, 2.5, depth * .31);
  for (let i = 0; i < 3; i++) {
    const x = p.x - width * .28 + i * 2.3;
    b.box(m.steel, x, height + .7, z + depth * .21, 1.6, .85, 2);
    b.cylinder(m.dark, x, height + 1.16, z + depth * .21, .55, .12, 10);
  }
  if (p.seed % 3 === 0) { b.cylinder(m.steel, p.x - width * .25, height + 4.5, z - depth * .15, .065, 9); b.box(m.light, p.x - width * .25, height + 9, z - depth * .15, .14, .15, .14); }
}
function parking(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  b.box(m.road, p.x, .025, z, p.width, .05, p.depth);
  for (let dz = -p.depth / 2 + 1; dz < p.depth / 2; dz += 2.8) for (const side of [-1, 1]) {
    b.box(m.white, p.x + side * (p.width / 2 - 2.5), .061, z + dz, 4.5, .025, .085);
  }
  b.box(m.white, p.x, .061, z, .12, .025, 6);
}
function fuel(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  parking(b, m, p, z);
  const outer = p.x + p.side * p.width * .28;
  b.box(m.concrete, outer, 2, z, p.width * .34, 4, p.depth - 2);
  b.panel(m.glass, outer - p.side * (p.width * .17 + .03), 2, z, p.depth - 4, 2.8, -p.side * Math.PI / 2);
  const canopyX = p.x - p.side * 3;
  b.box(m.white, canopyX, 5.3, z, 11.5, .48, p.depth - 2);
  b.box(m.dark, canopyX, 5.58, z, 11.7, .13, p.depth - 1.8);
  for (const dz of [-6, 6]) {
    b.cylinder(m.steel, canopyX, 2.7, z + dz, .15, 5.2);
    b.box(m.concrete, canopyX, .18, z + dz, 2.5, .28, 4.5);
    for (const dx of [-.7, .7]) {
      b.box(m.white, canopyX + dx, 1.2, z + dz, .8, 1.9, .6);
      b.box(m.dark, canopyX + dx - p.side * .42, 1.5, z + dz, .055, .35, .38);
      b.beam(m.dark, vec(canopyX + dx - p.side * .45, 1.4, z + dz + .2), vec(canopyX + dx - p.side * .8, .65, z + dz + .35), .035);
    }
    b.box(m.light, canopyX, 5.02, z + dz, 6, .05, .18);
  }
  b.panel(m.sign, canopyX - p.side * 5.82, 5.3, z, 8, .7, -p.side * Math.PI / 2, m.signRects[15]);
  b.box(m.dark, p.x - p.side * (p.width / 2 + 1), 3, z + p.depth / 2 - 1, .4, 6, .4);
  b.panel(m.sign, p.x - p.side * (p.width / 2 + 1.1), 5, z + p.depth / 2 - 1, 2.6, 2.2, -p.side * Math.PI / 2, m.signRects[15]);
}
function warehouse(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  b.box(m.concrete, p.x, p.height / 2, z, p.width, p.height, p.depth);
  const face = p.x - p.side * (p.width / 2 + .06);
  for (let dz = -p.depth / 2 + 3.5; dz < p.depth / 2; dz += 6.5) {
    b.box(m.dark, face, 2.2, z + dz, .18, 4.3, 4.5);
    b.box(m.steel, face - p.side * .12, 2.25, z + dz, .05, 3.9, 4.15);
    for (let y = .8; y < 4; y += .45) b.box(m.dark, face - p.side * .16, y, z + dz, .025, .035, 4.15);
    b.box(m.dark, face - p.side * .8, .65, z + dz, 1.6, 1.3, 4.9);
    for (const offset of [-2.55, 2.55]) b.cylinder(m.amber, face - p.side * 1.5, .65, z + dz + offset, .075, 1.3);
  }
  for (let dy = 5; dy < p.height; dy += 2.8) b.box(m.dark, face - p.side * .05, dy, z, .1, .13, p.depth);
  b.panel(m.sign, face - p.side * .16, p.height - 2, z, Math.min(14, p.depth - 2), 1.6, -p.side * Math.PI / 2, m.signRects[12 + p.seed % 3]);
  rooftop(b, m, p, z, p.height);
  // Service enclosure with posts and three thin rails, avoiding the road reserve.
  for (let dz = -p.depth / 2; dz <= p.depth / 2; dz += 3) b.cylinder(m.steel, p.x + p.side * (p.width / 2 + 1), 1.15, z + dz, .04, 2.3, 5);
  for (const y of [.35, 1.1, 2.2]) b.box(m.steel, p.x + p.side * (p.width / 2 + 1), y, z, .035, .04, p.depth);
}
function garage(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  for (let y = .15; y < p.height; y += 3.2) {
    b.box(m.concrete, p.x, y, z, p.width, .35, p.depth);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m.concrete, p.x + sx * (p.width / 2 - .5), y + 1.6, z + sz * (p.depth / 2 - .5), .8, 3.2, .8);
    if (y > 1) b.box(m.concrete, p.x - p.side * (p.width / 2 - .2), y + .7, z, .32, 1.1, p.depth);
    b.box(m.dark, p.x, y + .1, z, p.width - 1, .05, p.depth - 1);
    for (let dz = -p.depth / 2 + 2; dz < p.depth / 2; dz += 5) b.box(m.light, p.x, y + 2.95, z + dz, 5, .04, .12);
  }
  b.box(m.concrete, p.x, p.height + .1, z, p.width + .5, .4, p.depth + .5);
  b.panel(m.sign, p.x - p.side * (p.width / 2 + .04), 4.5, z, 9, 1.6, -p.side * Math.PI / 2, m.signRects[4]);
}
function building(b: UrbanBatch, m: CityMaterials, p: CityParcel, start: number): void {
  const z = -(p.s - start), h = p.height, w = p.width, d = p.depth;
  b.box(m.pavement, p.x, -.03, z, w + 2.5, .18, d + 2.5);
  if (p.style === 'fuel') { fuel(b, m, p, z); return; }
  if (p.style === 'warehouse') { warehouse(b, m, p, z); return; }
  if (p.style === 'garage') { garage(b, m, p, z); return; }
  const facade = m.facades[p.style === 'masonry' ? 2 : p.style === 'residential' ? 1 : p.style === 'rounded' ? 3 : 0];
  const podium = p.row === 0 ? 5.8 : 4;
  b.box(m.concrete, p.x, podium / 2, z, w, podium, d);
  if (p.style === 'rounded') {
    b.rounded(facade, p.x, podium, z, w - 1.5, d - 1.5, h - podium, 4.5);
    for (let y = podium; y < h; y += 4.1) b.rounded(m.steel, p.x, y, z, w - 1.2, d - 1.2, .12, 4.6);
    b.rounded(m.concrete, p.x, h, z, w - .8, d - .8, .45, 4.6);
  } else if (p.style === 'stepped') {
    const tiers = 3 + p.seed % 2;
    for (let tier = 0; tier < tiers; tier++) {
      const th = (h - podium) / tiers, tw = w - tier * 2.5, td = d - tier * 2;
      b.box(facade, p.x, podium + tier * th + th / 2, z, tw, th, td);
      b.box(m.concrete, p.x, podium + tier * th, z, tw + .7, .35, td + .7);
      if (tier) for (const dz of [-1, 1]) b.box(m.landscape, p.x, podium + tier * th + .6, z + dz * (td / 2 + .35), tw * .75, .8, .6);
    }
  } else {
    b.box(facade, p.x, podium + (h - podium) / 2, z, w - .5, h - podium, d - .5);
    for (let y = podium; y < h; y += p.style === 'curtain' ? 12 : 3.6) b.box(p.style === 'curtain' ? m.steel : m.concrete, p.x, y, z, w + .15, .16, d + .15);
    if (p.style === 'curtain') for (let dz = -d / 2 + 3; dz < d / 2; dz += 5) b.box(m.steel, p.x - p.side * (w / 2 + .05), (h + podium) / 2, z + dz, .35, h - podium, .2);
    if (p.style === 'residential') for (let y = 7; y < h - 3; y += 6.6) for (let dz = -d / 2 + 3; dz < d / 2; dz += 7) {
      b.box(m.concrete, p.x - p.side * (w / 2 + .7), y, z + dz, 1.7, .18, 4.8);
      b.box(m.steel, p.x - p.side * (w / 2 + 1.45), y + .65, z + dz, .055, .06, 4.8);
      for (const offset of [-2.35, 0, 2.35]) b.box(m.steel, p.x - p.side * (w / 2 + 1.45), y + .35, z + dz + offset, .06, .7, .06);
    }
    if (p.style === 'masonry') for (let dz = -d / 2; dz <= d / 2; dz += 6) b.box(m.masonry, p.x - p.side * w / 2, (h + podium) / 2, z + dz, .5, h - podium, .65);
  }
  rooftop(b, m, p, z, h, p.style === 'stepped' ? w - 7.5 : w - 1, p.style === 'stepped' ? d - 6 : d - 1);
  if (p.row === 0) frontage(b, m, p, z);
  else b.panel(m.glass, p.x - p.side * (w / 2 + .02), 2.3, z, 3, 4, -p.side * Math.PI / 2);
}
function tree(b: UrbanBatch, m: CityMaterials, x: number, z: number, seed: number): void {
  b.box(m.concrete, x, .12, z, 1.9, .3, 1.9); b.box(m.terrain, x, .3, z, 1.65, .08, 1.65);
  b.cylinder(m.bark, x, 2.3, z, .105, 4.5, 8);
  b.beam(m.bark, vec(x, 2.1, z), vec(x - .9, 3.8, z + .35), .055);
  b.beam(m.bark, vec(x, 2.9, z), vec(x + .8, 4.4, z - .2), .045);
  for (let i = 0; i < 3; i++) b.panel(m.leaf, x, 4.15, z, 5.1, 5.1, seed + i * Math.PI / 3);

}
function streetLamp(b: UrbanBatch, m: CityMaterials, x: number, z: number, side: number, highway = false): void {
  const h = highway ? 10 : 6.3, reach = highway ? 2.7 : 1;
  b.cylinder(m.dark, x, h / 2, z, highway ? .085 : .065, h);
  b.beam(m.dark, vec(x, h, z), vec(x - side * reach, h + .1, z), .07);
  b.box(m.light, x - side * reach, h + .05, z, highway ? 1 : .65, .08, .32);
}
function highway(b: UrbanBatch, m: CityMaterials, spec: CityChunkSpec, asphalt: THREE.Material): void {
  const start = spec.start;
  const samples = Array.from({ length: 31 }, (_, i) => ({ x: 0, z: -i * 4, tx: 0, tz: -1, s: start + i * 4, width: 33 }));
  b.ribbon(asphalt, samples, 0);
  b.box(m.concrete, 0, .42, -60, .65, .84, 120); b.box(m.amber, 0, .87, -60, .16, .035, 120);
  for (const side of [-1, 1]) {
    b.paint(m.roadAmber, vec(side*.65,0,0),vec(side*.65,0,-120),.12);
    for (let ds = 0; ds < 120; ds += 12) for (const x of [4.7, 8.3, 11.9]) b.paint(m.roadWhite,vec(side*x,0,-ds),vec(side*x,0,-ds-4),.12);
    for (let ds = 0; ds < 120; ds += 4) {
      const branch = road.sampleDetour(start + ds + 2), opening = side === 1 && branch && branch.x - branch.width / (2*branch.tangentS) < 16.5;
      if (!opening) {
        b.box(m.concrete, side * 16.7, .27, -ds - 2, .36, .54, 4.02);
        b.box(m.steel, side * 16.9, .88, -ds - 2, .08, .23, 4.02);
        if (ds % 12 === 0) b.box(m.dark, side * 16.9, .59, -ds, .12, 1.1, .12);
      }
    }
    for (const ds of [12, 48, 84]) {
      const outer = side === -1 ? 17.9 : Math.max(17.9, ...(road.corridorAt(start + ds).map(v => v[1] + .4)));
      streetLamp(b, m, side * outer, -ds, side, true);
    }
  }
  // Continuous sampled ramp, with the same normal as the graph's lane tangent.
  const branchSamples: { x: number; z: number; tx: number; tz: number; s: number; width: number }[] = [];
  for (let ds = 0; ds <= 120; ds += 2) {
    const p = road.sampleDetour(start + ds); if (p) branchSamples.push({ x: p.x, z: -ds, tx: p.tangentX, tz: -p.tangentS, s: p.s, width: p.width });
  }
  b.ribbon(asphalt, branchSamples, 0, 16.5);
  // The separated ramp has a planted median over continuous soil, rather than bare empty space.
  const verge = branchSamples.filter(p => p.x > 23).map(p => ({ ...p, x: (17.3 + p.x - 4.2) / 2, width: p.x - 4.2 - 17.3, tx: 0, tz: -1 }));
  b.ribbon(m.landscape, verge, -.035);
  for (let i = 1; i < branchSamples.length; i++) {
    const a = branchSamples[i - 1], c = branchSamples[i], nx = -a.tz, nz = a.tx;
    const normal = (side: number, offset: number, y: number) => vec(a.x + nx * offset * side, y, a.z + nz * offset * side);
    const next = (side: number, offset: number, y: number) => vec(c.x - c.tz * offset * side, y, c.z + c.tx * offset * side);
    b.paint(m.roadWhite, normal(1, 3.25, 0), next(1, 3.25, 0), .09);
    if (a.x > 21) {
      b.paint(m.roadAmber, normal(-1, 3.25, 0), next(-1, 3.25, 0), .09);
      for (const side of [-1, 1]) { b.beam(m.steel, normal(side, 3.85, .83), next(side, 3.85, .83), .07, 5); if (i % 4 === 0) b.beam(m.dark, normal(side, 3.85, .1), normal(side, 3.85, 1.03), .05, 5); }
    }
    if (Math.floor(a.s) % 12 < 4) b.paint(m.roadWhite, normal(0, 0, 0), next(0, 0, 0), .08);
    if (a.x > 17.8 && a.x < 20 && i % 3 === 0) b.paint(m.roadWhite, vec(14.9, 0, a.z), normal(-1, 3.4, 0), .12);
  }
  for (const o of roadsideObstacles(start + 60).filter(v => Math.floor(v.s / 120) === spec.id)) {
    const z = -(o.s - start); b.box(m.concrete, o.x, .45, z, o.width, .9, o.length); b.box(m.amber, o.x, 1.1, z, o.width, .45, .12);
  }
  if (spec.id % 3 === 1) {
    const route = road.routeAt(start + 90), sx = route ? 13 : 7;
    b.cylinder(m.steel, 17.8, 4.7, -96, .13, 9.4); b.box(m.steel, 7, 9.2, -96, 22, .2, .2);
    b.panel(m.sign, sx, 8.1, -95.8, route ? 6 : 9, 1.8, 0, m.signRects[route ? 18 : 16]);
  }
}
export function buildCityChunk(spec: CityChunkSpec, m: CityMaterials, asphalt: THREE.Material): THREE.Group {
  const b = new UrbanBatch(), r = new Random(spec.id * 771 + 381);
  b.box(m.terrain, 0, -.29, -60, GROUND_HALF_WIDTH * 2, .42, CITY_CHUNK);
  highway(b, m, spec, asphalt);
  for (const side of [-1, 1] as const) {
    const edge = spec.front[side === -1 ? 0 : 1];
    b.box(m.pavement, side * (edge - 1.8), .02, -60, 3.2, .18, 120);
    b.box(m.concrete, side * (edge - 3.35), .08, -60, .18, .25, 120);
    for (const row of [0, 1, 2]) {
      const streetX = side * (edge + 38 + row * 50);
      b.box(m.road, streetX, -.035, -60, 9, .07, 120);
      b.box(m.pavement, streetX + side * 5.1, .03, -60, 1.2, .18, 120);
      for (let ds = 2; ds < 120; ds += 12) b.box(m.white, streetX, .012, -ds, .08, .025, 3);
    }
    if (spec.id % 2 === 0 && !spec.overpasses.length) {
      const x = side * (edge + 200), width = 400;
      b.box(m.road, x, -.035, -2.5, width, .07, 5);
      b.box(m.pavement, x, .035, -6.2, width, .18, 2.4);
      for (let dx = edge + 6; dx < edge + 390; dx += 12) b.box(m.white, side * dx, .012, -2.5, 3, .025, .08);
      // Painted crossing at the neighbourhood street, outside the expressway barrier.
      for (let j = 0; j < 7; j++) b.box(m.white, side * (edge + 38), .015, -j * .65 - .25, 6, .025, .26);
    }
    for (const ds of [16, 56, 96]) {
      tree(b, m, side * (edge - 1.8), -ds, r.next() * 5);
      streetLamp(b, m, side * (edge - 2.7), -ds - 10, side);
      b.box(m.dark, side * (edge - 1.4), .6, -ds - 5, .5, 1.1, .5);
      // Bus stop shelter: structural frame, a glazed back and seating.
      if ((spec.id + ds) % 7 === 0) { const x = side * (edge - 1.6), z = -ds + 6; b.box(m.dark, x, 2.7, z, 2.6, .12, 5); b.box(m.glass, x + side * 1.1, 1.45, z, .07, 2.5, 4.7); for (const dz of [-2.3, 2.3]) b.cylinder(m.steel, x + side, 1.4, z + dz, .04, 2.7); b.box(m.dark, x + side * .5, .55, z, .65, .16, 3.5); }
    }
  }
  for (const p of spec.parcels) building(b, m, p, spec.start);
  for (const p of spec.overpasses) {
    const z = -(p.s - spec.start), top = p.underside + p.thickness;
    b.box(m.concrete, p.x, p.underside + p.thickness / 2, z, p.width, p.thickness, p.length);
    b.box(m.road, p.x, top + .04, z, p.width, .08, p.length - 1.5);
    for (const dz of [-1, 1]) { b.box(m.concrete, p.x, top + .6, z + dz * (p.length / 2 - .2), p.width, 1.2, .3); b.box(m.steel, p.x, top + 1.3, z + dz * (p.length / 2 - .2), p.width, .08, .08); }
    // Approaches descend through a reserved cross-street slot to the neighbourhood grid.
    for (const side of [-1, 1]) {
      const span = 105, first = p.width / 2, center = side * (first + span / 2);
      const slope = -side * Math.atan(top / span);
      const g = new THREE.BoxGeometry(span, 1.25, p.length); g.rotateZ(slope); g.translate(center, top / 2 - .625, z); b.add(m.concrete, g);
      const approach = new THREE.BoxGeometry(span, .08, p.length - 1.5); approach.rotateZ(slope); approach.translate(center, top / 2 + .04, z); b.add(m.road, approach);
      for (const dz of [-1, 1]) b.beam(m.steel, vec(side * first, top + .9, z + dz * (p.length / 2 - .2)), vec(side * (first + span), .9, z + dz * (p.length / 2 - .2)), .08);
      for (let dx = 0; dx < span; dx += 12) { const y = top * (1 - dx / span); b.box(m.concrete, side * (first + dx), y / 2, z, .9, Math.max(.2, y), 2); }
      const corridor = road.corridorAt(p.s), supportX = side < 0 ? -21.5 : Math.max(21.5, ...corridor.map(c => c[1] + 2));
      b.box(m.concrete, supportX, p.underside / 2, z, 1.4, p.underside, 4);
      b.box(m.light, side * 9, p.underside - .05, z, .3, .05, 5);
    }
    for (let dx = -p.width / 2 + 3; dx < p.width / 2; dx += 12) b.box(m.white, dx, top + .09, z, 4, .025, .12);
  }
  const group = b.build(); group.name = `city-chunk-${spec.id}`; group.userData.parcels = spec.parcels.length; group.userData.district = spec.district; return group;
}
