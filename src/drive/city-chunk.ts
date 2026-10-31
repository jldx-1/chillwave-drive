import * as THREE from 'three';
import { Random } from '../core/random';
import { road, districtPassagesAt } from './road';
import { jumpRamps } from './jump-ramps';
import { roadSignForChunk } from './environment-collisions';
import { medianGate } from './median';
import { CITY_CHUNK, GROUND_HALF_WIDTH, type CityChunkSpec } from './world-layout';
import { UrbanBatch } from './world-geometry';
import { streetLamp, skybridge, bridgeForChunk, streetscape } from './city-infrastructure';
import { tree, palm } from './vegetation';
import { CityMaterials } from './world-materials';
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function highway(b: UrbanBatch, m: CityMaterials, spec: CityChunkSpec, asphalt: THREE.Material): void {
  const start = spec.start;
  const openExit=(s:number,x:number)=>{const p=road.sampleDetour(s);return p&&Math.abs(x-p.x)<p.width/(2*p.tangentS)+1;};
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
      const outer = 17.9;
      if(!openExit(start+ds,side*outer))streetLamp(b, m, side * outer, -ds, side, true);
    }
  }
  // Continuous sampled ramp, with the same normal as the graph's lane tangent.
  const branchSamples: { x: number; z: number; tx: number; tz: number; s: number; width: number }[] = [];
  for (let ds = 0; ds <= 120; ds += 2) {
    const p = road.sampleDetour(start + ds); if (p) branchSamples.push({ x: p.x, z: -ds, tx: p.tangentX, tz: -p.tangentS, s: p.s, width: p.width });
  }
  b.ribbon(asphalt, branchSamples, 0, 16.5);
  // Both sides of the neighborhood route have sidewalks; no park-sized cleared median.
  for(const side of [-1,1]) {
    const sidewalk=branchSamples.filter(p=>road.sampleDetour(p.s)?.phase==='service')
      .map(p=>({...p,x:p.x-p.tz*6.0*side,z:p.z+p.tx*6.0*side,width:1.8}));
    b.ribbon(m.concrete,sidewalk,.09);
  }
  for (let i = 1; i < branchSamples.length; i++) {
    const a = branchSamples[i - 1], c = branchSamples[i], nx = -a.tz, nz = a.tx;
    const normal = (side: number, offset: number, y: number) => vec(a.x + nx * offset * side, y, a.z + nz * offset * side);
    const next = (side: number, offset: number, y: number) => vec(c.x - c.tz * offset * side, y, c.z + c.tx * offset * side);
    b.paint(m.roadWhite, normal(1, 4.45, 0), next(1, 4.45, 0), .09);
    const street = road.sampleDetour(a.s)?.phase === 'service';
    if (a.x > 21) {
      b.paint(m.roadAmber, normal(-1, 4.45, 0), next(-1, 4.45, 0), .09);
      if (!street) for (const side of [-1, 1]) { b.beam(m.steel, normal(side, 5.15, .83), next(side, 5.15, .83), .07, 5); if (i % 4 === 0) b.beam(m.dark, normal(side, 5.15, .1), normal(side, 5.15, 1.03), .05, 5); }
    }
    if (street && i%24===0) {
      for(const side of [-1,1])streetLamp(b,m,a.x-side*a.tz*7.1,a.z+side*a.tx*7.1,side);
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
  b.box(m.terrain, 0, -.29, -60, GROUND_HALF_WIDTH * 2, .42, CITY_CHUNK);
  highway(b, m, spec, asphalt);
  for (const side of [-1, 1] as const) {
    const edge = spec.front[side === -1 ? 0 : 1];
    const exitClear=(ds:number,padding=4)=>{const p=road.sampleDetour(spec.start+ds);return !p||side<0||Math.abs(edge-2-p.x)>p.width/(2*p.tangentS)+padding;};
    if([0,30,60,90,120].every(ds=>exitClear(ds,8)))streetscape(b,m,edge,side);
    for(let ds=1;ds<120;ds+=2)if(exitClear(ds)) {
      b.box(m.pavement,side*(edge-1.8),.02,-ds,3.2,.18,2);
      b.box(m.concrete,side*(edge-3.35),.08,-ds,.18,.25,2);
      b.box(side<0?m.pink:m.cyan,side*(edge-3.2),.22,-ds,.12,.1,2);
    }
    // Cross-block pedestrian cuts remain legible without drawing fake, undrivable streets.
    if(spec.id%2===0&&!spec.overpasses.length) b.box(m.pavement,side*(edge+110),-.01,-2.5,220,.06,4);
    if (exitClear(35,10) && (spec.id + side) % 2 !== 0) palm(b, m, side * (edge - 1.8), -35, spec.id * 217 + side + 981);
    for (const ds of [16, 56, 96]) {
      if(!exitClear(ds,14))continue;
      tree(b, m, side * (edge - 1.8), -ds, Math.floor(r.next() * 100000));
      streetLamp(b, m, side * (edge - 2.7), -ds - 10, side);
      b.box(m.dark, side * (edge - 1.4), .6, -ds - 5, .5, 1.1, .5);
      // Bus stop shelter: structural frame, a glazed back and seating.
      if ((spec.id + ds) % 7 === 0) { const x = side * (edge - 1.6), z = -ds + 6; b.box(m.dark, x, 2.7, z, 2.6, .12, 5); b.box(m.glass, x + side * 1.1, 1.45, z, .07, 2.5, 4.7); for (const dz of [-2.3, 2.3]) b.cylinder(m.steel, x + side, 1.4, z + dz, .04, 2.7); b.box(m.dark, x + side * .5, .55, z, .65, .16, 3.5); }
    }
  }
  for(const p of spec.parcels) b.box(m.pavement,p.x,-.04,-(p.s-spec.start),p.width+.8,.05,p.depth+.8);
  for(const passage of districtPassagesAt(spec.start+60).filter(p=>Math.floor(p.s/CITY_CHUNK)===spec.id)) {
    const z=-(passage.s-spec.start),x=passage.x;
    for(const side of [-1,1]) {
      b.box(m.concrete,x+side*8.8,passage.underside/2,z,3.2,passage.underside,passage.length);
      b.box(m.trim,x+side*7.16,passage.underside/2,z,.16,passage.underside,passage.length);
      b.box(side<0?m.pink:m.cyan,x+side*7.04,passage.underside-.4,z,.1,.13,passage.length);
    }
    b.box(m.concrete,x,passage.underside+passage.thickness/2,z,passage.width,passage.thickness,passage.length);
    for(const side of [-1,1])for(const y of [10.4,13.8]) {
      b.panel(m.glass,x,y,z+side*(passage.length/2+.04),passage.width-1,2.5,side>0?0:Math.PI);
      for(let dx=-10;dx<=10;dx+=2.5)b.box(m.trim,x+dx,y,z+side*(passage.length/2+.08),.15,2.8,.15);
    }
    b.panel(m.sign,x,passage.underside+1.2,z+passage.length/2+.12,10,1.2,0,m.signRects[spec.id%16]);
    b.box(m.neutralLight,x,passage.underside-.06,z,4,.08,passage.length-1);
  }
  const bridge=bridgeForChunk(spec.id); if(bridge) skybridge(b,m,bridge,spec.start);
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
