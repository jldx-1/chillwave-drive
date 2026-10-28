import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPoliceCar, isSharedPoliceResource, POLICE_SOURCE_WHEEL_RADIUS } from '../src/drive/police-car';
import { COLLISION_PROFILES } from '../src/drive/collision-profiles';
const POLICE_SIZE=COLLISION_PROFILES.police;
import { CYBER_VEHICLES } from '../src/drive/cyber-vehicles';
import { Traffic } from '../src/drive/traffic';
import { policeFacePanel, policeRoof, policeCabinSide } from '../src/drive/police-body';
const lamps = () => ({ head: new THREE.MeshBasicMaterial(), brake: new THREE.MeshStandardMaterial(), red: new THREE.MeshBasicMaterial(), blue: new THREE.MeshBasicMaterial() });

describe('police utility SUV', () => {
  it('fits the SUV collision body and leaves the four tires on the road', () => {
    const rig = buildPoliceCar(lamps()), bounds = new THREE.Box3().setFromObject(rig.group), size = bounds.getSize(new THREE.Vector3());
    expect(size.z).toBeLessThanOrEqual(POLICE_SIZE.length);
    expect(size.z).toBeGreaterThan(5);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-POLICE_SIZE.length / 2);
    expect(bounds.max.z).toBeLessThanOrEqual(POLICE_SIZE.length / 2);
    expect(size.x).toBeGreaterThan(POLICE_SIZE.width); // Mirrors project beyond the body.
    expect(size.x).toBeLessThan(2.5);
    expect(size.y).toBeGreaterThan(1.8); expect(size.y).toBeLessThan(2.1);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(rig.wheels).toHaveLength(4); expect(rig.spins).toHaveLength(4);
    expect(rig.wheels.map(w => w.position.z < 0)).toEqual([true, false, true, false]);
    for (const w of rig.wheels) {
      const b = new THREE.Box3().setFromObject(w);
      expect(b.min.y).toBeCloseTo(0, 5);
      expect(b.max.y).toBeCloseTo(2 * POLICE_SOURCE_WHEEL_RADIUS, 5);
    }
    const traffic = new Traffic('UTILITY', 'low'); traffic.reset();
    expect(traffic.agents.filter(a => a.kind === 'police').every(a => a.width === CYBER_VEHICLES[a.model!].width && a.length === CYBER_VEHICLES[a.model!].length)).toBe(true);
  });
  it('leaves the side windows and windscreen open behind the glazing',()=>{
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),roof=new THREE.Mesh(policeRoof(),material),side=new THREE.Mesh(policeCabinSide(1),material);
    const hits=(mesh:THREE.Mesh,from:number[],direction:number[])=>new THREE.Raycaster(new THREE.Vector3(...from),new THREE.Vector3(...direction)).intersectObject(mesh).length;
    expect(hits(roof,[0,3,-.85],[0,-1,0])).toBe(0);expect(hits(roof,[0,3,.5],[0,-1,0])).toBeGreaterThan(0);
    expect(hits(side,[3,1.5,0],[-1,0,0])).toBe(0);expect(hits(side,[3,1.5,.40],[-1,0,0])).toBeGreaterThan(0);
  });
  it('keeps reusable geometry bounded and finite while giving each car independent warning lights', () => {
    const firstLamps=lamps(), secondLamps=lamps(), first=buildPoliceCar(firstLamps), second=buildPoliceCar(secondLamps);
    const meshes = (g: THREE.Group) => { const out: THREE.Mesh[]=[];g.traverse(o=>{if(o instanceof THREE.Mesh)out.push(o);});return out; };
    const a=meshes(first.group), b=meshes(second.group);
    expect(a.length).toBeLessThan(45); expect(b.length).toBe(a.length);
    a.forEach((m,i)=>{
      expect(m.geometry).toBe(b[i].geometry); expect(isSharedPoliceResource(m.geometry)).toBe(true);
      const p=m.geometry.getAttribute('position'); expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(m.geometry.getAttribute('normal').count).toBe(p.count);
      expect(m.geometry.getAttribute('uv').count).toBe(p.count);
      if(Object.values(firstLamps).includes(m.material as THREE.MeshBasicMaterial)) {
        expect(m.material).not.toBe(b[i].material); expect(isSharedPoliceResource(m.material as THREE.Material)).toBe(false);
      } else { expect(m.material).toBe(b[i].material); expect(isSharedPoliceResource(m.material as THREE.Material)).toBe(true); }
    });
    expect(a.some(m=>m.material===firstLamps.red)).toBe(true); expect(a.some(m=>m.material===firstLamps.blue)).toBe(true);
    const fixed = first.group.children[0].quaternion.clone(), other=first.spins[1].quaternion.clone();
    first.wheels[0].rotation.y=.3;first.spins[0].rotation.x=1.2;
    expect(first.group.children[0].quaternion.equals(fixed)).toBe(true);
    expect(first.spins[1].quaternion.equals(other)).toBe(true);
    expect(second.wheels[0].rotation.y).toBe(0);expect(second.spins[0].rotation.x).toBe(0);
  });
  it('keeps a crowned roof and visibly curved, forward-facing headlamp lenses', () => {
    const roof=policeRoof(),positions=roof.getAttribute('position');
    const center:number[]=[],edges:number[]=[];
    for(let i=0;i<positions.count;i++)if(Math.abs(positions.getZ(i)-.4)<.05){
      const x=Math.abs(positions.getX(i));if(x<.05)center.push(positions.getY(i));if(x>.77)edges.push(positions.getY(i));
    }
    expect(center.length).toBeGreaterThan(0);expect(edges.length).toBeGreaterThan(0);
    expect(Math.min(...center)-Math.max(...edges)).toBeGreaterThan(.03);
    const lens=policeFacePanel(.798,.997,.442,.172),normals=lens.getAttribute('normal');
    const nx:number[]=[];
    for(let i=0;i<normals.count;i++) { expect(normals.getZ(i)).toBeLessThan(-.5);nx.push(normals.getX(i)); }
    expect(Math.max(...nx)-Math.min(...nx)).toBeGreaterThan(.25);
    roof.dispose();lens.dispose();
  });

});
