import * as THREE from 'three';
import { Random } from '../core/random';
import { road } from './road';
import { jumpRamps } from './jump-ramps';
import { roadSignForChunk } from './environment-collisions';
import { medianGate } from './median';
import { CITY_CHUNK, CITY_ROW_SPACING, GROUND_HALF_WIDTH, type CityChunkSpec, type CityParcel } from './world-layout';
import { UrbanBatch } from './world-geometry';
import { buildTower } from './city-buildings';
import { buildCatalogBuilding, type BuildingBatches } from './catalog-buildings';
import { streetLamp, skybridge, bridgeForChunk, streetscape } from './city-infrastructure';
import { tree, palm } from './vegetation';
import { CityMaterials } from './world-materials';
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
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
/** Architecture, displays and LED trims share a handful of chunk-batched materials. */
function nightFrontage(b: UrbanBatch, m: CityMaterials, p: CityParcel, z: number): void {
  const glow = p.seed % 3 === 0 ? m.pink : p.seed % 3 === 1 ? m.cyan : m.violet;
  const face = p.x - p.side * (p.width / 2 + .2), frontZ = z + p.depth / 2 + .2;
  b.box(glow, p.x, 5.9, frontZ, p.width + .2, .16, .16);
  b.box(glow, face, 5.9, z, .16, .16, p.depth);
  if (p.height < 28) { b.box(glow, p.x, p.height + .3, frontZ, p.width, .14, .16); return; }
  const w = p.style === 'stepped' ? p.width - 8 : p.width - 1;
  const d = p.style === 'stepped' ? p.depth - 6.5 : p.depth - 1;
  b.box(glow, p.x, p.height + .45, z + d / 2, w, .22, .2);
  if (p.style === 'curtain' || p.style === 'masonry' || p.style === 'residential') {
    for (const side of [-1, 1]) b.box(glow, p.x + side * (p.width / 2 - .2), (p.height + 7) / 2, frontZ, .14, p.height - 7, .14);
    for (let y = 20; y < p.height; y += 28) b.box(glow, face, y, z, .15, .14, p.depth);
  }
  if (p.row === 1 && p.seed % 2 === 0) {
    b.cylinder(m.dark, p.x, p.height + 10, z, .16, 20);
    b.cylinder(glow, p.x, p.height + 13, z, .09, 15);
  }
  if (p.row !== 0) return;
  // Road-facing portrait/palm wall, and a forward-facing display readable while driving.
  const ad = p.side === -1 ? (p.seed % 3 === 0 ? 2 : 0) : (p.seed % 3 === 0 ? 2 : 1);
  const adW = Math.min(20, p.width - 3), adH = ad === 1 ? adW / 2 : adW * 1.12;
  const adY = 10 + adH / 2;
  b.box(m.dark, p.x, adY, frontZ + .05, adW + .8, adH + .8, .4);
  b.panel(m.ad, p.x, adY, frontZ + .28, adW, adH, 0, m.adRects[ad]);
  for (const signSide of [-1, 1]) b.box(glow, p.x + signSide * (adW / 2 + .25), adY, frontZ + .3, .14, adH + .6, .14);
  if (p.seed % 2 === 0) {
    b.panel(m.ad, face - p.side * .08, 29, z, Math.min(17, p.depth - 3), 26, -p.side * Math.PI / 2, m.adRects[p.side === -1 ? 0 : 2]);
    b.box(glow, face - p.side * .12, 15.75, z, .2, .2, Math.min(17.5, p.depth - 2.5));
  }
  b.box(m.dark, face - p.side * 1.3, 22, frontZ + .5, 4.1, 14.5, .5);
  b.panel(m.ad, face - p.side * 1.3, 22, frontZ + .78, 3.7, 14, 0, m.adRects[3 + p.seed % 2]);
}
function building(b:UrbanBatch,m:CityMaterials,p:CityParcel,start:number): void {
  const z=-(p.s-start);
  if(p.style==='fuel'){fuel(b,m,p,z);nightFrontage(b,m,p,z);}
  else if(p.style==='warehouse'){warehouse(b,m,p,z);nightFrontage(b,m,p,z);}
  else if(p.style==='garage'){garage(b,m,p,z);nightFrontage(b,m,p,z);}
  else buildTower(b,m,p,start);
}
function highway(b: UrbanBatch, m: CityMaterials, spec: CityChunkSpec, asphalt: THREE.Material): void {
  const start = spec.start;
  const samples = Array.from({ length: 31 }, (_, i) => ({ x: 0, z: -i * 4, tx: 0, tz: -1, s: start + i * 4, width: 33 }));
  b.ribbon(asphalt, samples, 0);
  const gate = medianGate(start, 0);
  for (let ds = 0; ds < 120; ds += 4) {
    const at = start + ds + 2;
    if (at >= gate.start && at < gate.end) continue;
    b.tapered(m.concrete,0,0,-ds-2,.65,4,.84,.65);
    b.box(m.dark,0,.13,-ds-2,.65,.12,3.94);
    b.box(m.amber, 0, .87, -ds - 2, .16, .035, 4);
  }
  for (const side of [-1, 1]) {
    b.paint(m.roadAmber, vec(side*.65,0,0),vec(side*.65,0,-120),.12);
    for (let ds = 0; ds < 120; ds += 12) for (const x of [4.7, 8.3, 11.9]) b.paint(m.roadWhite,vec(side*x,0,-ds),vec(side*x,0,-ds-4),.12);
    for (let ds = 0; ds < 120; ds += 4) {
      const branch = road.sampleDetour(start + ds + 2), opening = side === 1 && branch && branch.x - branch.width / (2*branch.tangentS) < 16.5;
      if (!opening) {
        b.tapered(m.concrete,side*16.7,0,-ds-2,.38,3.96,.54,.65);
        b.box(m.steel, side * 16.9, .88, -ds - 2, .08, .23, 4.02);
        if(ds%12===0) b.box(ds%24===0?m.pink:m.cyan,side*16.48,.46,-ds-2,.08,.08,1.7);
        if(ds%12===4) b.box(m.amber,side*16.46,.5,-ds-2,.08,.1,.28);
        if (ds % 12 === 0) b.box(m.dark, side * 16.9, .59, -ds, .12, 1.1, .12);
      }
    }
    b.paint(m.roadWhite,vec(side*15.7,0,0),vec(side*15.7,0,-120),.09);
    for(const ds of [22,78]) {
      b.box(m.dark,side*16.1,.013,-ds,.48,.018,1.4);
      for(let i=0;i<7;i++) b.box(m.steel,side*16.1,.027,-ds-.6+i*.2,.42,.018,.045);
    }
    // Inset LEDs remain outside the wheel lanes and use the road paint's stable depth bias.
    for (let ds = 2; ds < 120; ds += 12) b.paint(m.cyan, vec(side * 15.4,0,-ds),vec(side * 15.4,0,-ds-2.8),.1);
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
  // The middle of each exit is a city street, with a raised outer sidewalk.
  const sidewalk = branchSamples.filter(p => road.sampleDetour(p.s)?.phase === 'service')
    .map(p => ({ ...p, x: p.x - p.tz * 4.55, z: p.z + p.tx * 4.55, width: 1.8 }));
  b.ribbon(m.concrete, sidewalk, .09);
  // The separated ramp has a planted median over continuous soil, rather than bare empty space.
  const verge = branchSamples.filter(p => p.x > 23).map(p => ({ ...p, x: (17.3 + p.x - 4.2) / 2, width: p.x - 4.2 - 17.3, tx: 0, tz: -1 }));
  b.ribbon(m.landscape, verge, -.035);
  for (let i = 1; i < branchSamples.length; i++) {
    const a = branchSamples[i - 1], c = branchSamples[i], nx = -a.tz, nz = a.tx;
    const normal = (side: number, offset: number, y: number) => vec(a.x + nx * offset * side, y, a.z + nz * offset * side);
    const next = (side: number, offset: number, y: number) => vec(c.x - c.tz * offset * side, y, c.z + c.tx * offset * side);
    b.paint(m.roadWhite, normal(1, 3.25, 0), next(1, 3.25, 0), .09);
    const street = road.sampleDetour(a.s)?.phase === 'service';
    if (a.x > 21) {
      b.paint(m.roadAmber, normal(-1, 3.25, 0), next(-1, 3.25, 0), .09);
      if (!street) for (const side of [-1, 1]) { b.beam(m.steel, normal(side, 3.85, .83), next(side, 3.85, .83), .07, 5); if (i % 4 === 0) b.beam(m.dark, normal(side, 3.85, .1), normal(side, 3.85, 1.03), .05, 5); }
    }
    if (street && Math.floor(a.s) % 80 === 0) {
      for (let stripe = 0; stripe < 6; stripe++) {
        const z = -stripe * .65;
        b.paint(m.roadWhite, vec(a.x - 3, .018, a.z + z), vec(a.x + 3, .018, a.z + z), .23);
      }
    }
    if (Math.floor(a.s) % 12 < 4) b.paint(m.roadWhite, normal(0, 0, 0), next(0, 0, 0), .08);
    if (a.x > 17.8 && a.x < 20 && i % 3 === 0) b.paint(m.roadWhite, vec(14.9, 0, a.z), normal(-1, 3.4, 0), .12);
  }
  for(const ramp of jumpRamps(start+60).filter(r=>Math.floor(r.s/120)===spec.id)) {
    const z=-(ramp.s-start),angle=Math.atan2(ramp.height,ramp.length);
    const deck=new THREE.BoxGeometry(ramp.width,.18,Math.hypot(ramp.length,ramp.height));
    deck.rotateX(angle);deck.translate(ramp.x,ramp.height/2,z+ramp.length/2);b.add(m.steel,deck);
    for(const side of [-1,1])b.beam(m.cyan,vec(ramp.x+side*(ramp.width/2-.12),.12,z+ramp.length),vec(ramp.x+side*(ramp.width/2-.12),ramp.height+.12,z),.055,6);
    for(let i=1;i<=3;i++){
      const t=i/4;b.beam(m.amber,vec(ramp.x-.8,ramp.height*t+.13,z+ramp.length*(1-t)),vec(ramp.x+.8,ramp.height*t+.13,z+ramp.length*(1-t)),.045,6);
    }
  }
  if (spec.id % 3 === 1) {
    b.cylinder(m.steel, 17.8, 4.7, -96, .13, 9.4); b.box(m.steel, 7, 9.2, -96, 22, .2, .2);
  }
}
export function buildCityChunk(spec: CityChunkSpec, m: CityMaterials, asphalt: THREE.Material): THREE.Group {
  const b = new UrbanBatch(), r = new Random(spec.id * 771 + 381);
  const details=Array.from({length:3},()=>({relief:new UrbanBatch(),street:new UrbanBatch()}));
  b.box(m.terrain, 0, -.29, -60, GROUND_HALF_WIDTH * 2, .42, CITY_CHUNK);
  highway(b, m, spec, asphalt);
  for (const side of [-1, 1] as const) {
    const edge = spec.front[side === -1 ? 0 : 1];
    streetscape(b,m,edge,side);
    b.box(m.pavement, side * (edge - 1.8), .02, -60, 3.2, .18, 120);
    b.box(m.concrete, side * (edge - 3.35), .08, -60, .18, .25, 120);
    for (const row of [0, 1, 2]) {
      const streetX = side * (edge + 102 + row * CITY_ROW_SPACING);
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
      for (let j = 0; j < 7; j++) b.box(m.white, side * (edge + 102), .015, -j * .65 - .25, 6, .025, .26);
    }
    b.box(side === -1 ? m.pink : m.cyan, side * (edge - 3.2), .22, -60, .12, .1, 120);
    if ((spec.id + side) % 2 !== 0) palm(b, m, side * (edge - 1.8), -35, spec.id * 217 + side + 981);
    for (const ds of [16, 56, 96]) {
      tree(b, m, side * (edge - 1.8), -ds, Math.floor(r.next() * 100000));
      streetLamp(b, m, side * (edge - 2.7), -ds - 10, side);
      b.box(m.dark, side * (edge - 1.4), .6, -ds - 5, .5, 1.1, .5);
      // Bus stop shelter: structural frame, a glazed back and seating.
      if ((spec.id + ds) % 7 === 0) { const x = side * (edge - 1.6), z = -ds + 6; b.box(m.dark, x, 2.7, z, 2.6, .12, 5); b.box(m.glass, x + side * 1.1, 1.45, z, .07, 2.5, 4.7); for (const dz of [-2.3, 2.3]) b.cylinder(m.steel, x + side, 1.4, z + dz, .04, 2.7); b.box(m.dark, x + side * .5, .55, z, .65, .16, 3.5); }
    }
  }
  const bridge=bridgeForChunk(spec.id); if(bridge) skybridge(b,m,bridge,spec.start);
  for (const p of spec.parcels) {
    if(p.assetId)buildCatalogBuilding({silhouette:b,...details[p.row]} satisfies BuildingBatches,m,p,spec.start);
    else building(b,m,p,spec.start);
  }
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
  const group = b.build(); group.name = `city-chunk-${spec.id}`; group.userData.parcels = spec.parcels.length; group.userData.district = spec.district; group.userData.skybridge = bridge?.type ?? null;
  group.userData.catalogIds=spec.parcels.flatMap(p=>p.assetId?[p.assetId]:[]);
  for(const [row,detail]of details.entries())for(const [tier,batch]of [['mid',detail.relief],['near',detail.street]]as const) {
    const g=batch.build();g.name=`catalog-${tier}`;g.userData.detailTier=tier;g.userData.row=row;g.userData.distanceLeft=spec.front[0]+row*CITY_ROW_SPACING+35;g.userData.distanceRight=spec.front[1]+row*CITY_ROW_SPACING+35;group.add(g);
  }
  const sign=roadSignForChunk(spec.id);
  if(sign){const signBatch=new UrbanBatch();signBatch.panel(m.sign,0,0,0,sign.width,1.8,0,m.signRects[sign.width===6?18:16]);
    const signGroup=signBatch.build();signGroup.name='breakable-sign';signGroup.userData.signId=sign.id;signGroup.position.set(sign.x,8.1,-95.8);group.add(signGroup);}
  const gate = medianGate(spec.start, 0);
  if (gate.start >= spec.start && gate.start < spec.start + CITY_CHUNK) {
    const moving = new THREE.Group(); moving.name = 'median-gate'; moving.userData.s = gate.start;
    moving.position.z = -(gate.start - spec.start + (gate.end - gate.start) / 2);
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(.65, .84, gate.end - gate.start), m.concrete);
    barrier.position.y = .42; moving.add(barrier);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.18, .04, gate.end - gate.start), m.amber);
    stripe.position.y = .87; moving.add(stripe); group.add(moving);
    for (const s of [gate.start - 1, gate.end + 1]) {
      const signal = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .3), new THREE.MeshBasicMaterial({ color: '#62f7cc' }));
      signal.name = 'median-signal'; signal.userData.s = gate.start;
      signal.userData.owned = true;
      signal.position.set(0, 1.4, -(s - spec.start)); group.add(signal);
    }
  }
  return group;
}
