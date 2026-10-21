import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export type UVRect = readonly [number, number, number, number];
/** Static urban detail is merged by material. Every output geometry belongs to its chunk. */
export class UrbanBatch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(material: THREE.Material, geometry: THREE.BufferGeometry): void {
    if (material.userData.facade) {
      const uv = geometry.attributes.uv, n = geometry.attributes.normal, p = geometry.attributes.position;
      if (uv && n) for (let i = 0; i < uv.count; i++) {
        const across = Math.abs(n.getX(i)) > .5 ? p.getZ(i) : p.getX(i);
        uv.setXY(i, across / 12, p.getY(i) / 24);
      }
    }
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material)!.push(geometry);
  }
  box(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): void {
    const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); this.add(m, g);
  }
  cylinder(m: THREE.Material, x: number, y: number, z: number, radius: number, height: number, segments = 8): void {
    const g = new THREE.CylinderGeometry(radius, radius, height, segments); g.translate(x, y, z); this.add(m, g);
  }
  beam(m: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number, segments = 6): void {
    const delta = to.clone().sub(from), g = new THREE.CylinderGeometry(radius, radius, delta.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2); this.add(m, g);
  }
  panel(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, ry: number, rect?: UVRect): void {
    const g = new THREE.PlaneGeometry(w, h);
    if (rect) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * rect[2], rect[1] + uv.getY(i) * rect[3]); }
    g.rotateY(ry); g.translate(x, y, z); this.add(m, g);
  }
  rounded(m: THREE.Material, x: number, base: number, z: number, w: number, d: number, h: number, radius: number): void {
    const shape = new THREE.Shape(), a = -w / 2, b = -d / 2, r = Math.min(radius, w / 2, d / 2);
    shape.moveTo(a + r, b); shape.lineTo(a + w - r, b); shape.quadraticCurveTo(a + w, b, a + w, b + r);
    shape.lineTo(a + w, b + d - r); shape.quadraticCurveTo(a + w, b + d, a + w - r, b + d);
    shape.lineTo(a + r, b + d); shape.quadraticCurveTo(a, b + d, a, b + d - r);
    shape.lineTo(a, b + r); shape.quadraticCurveTo(a, b, a + r, b);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 5, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(x, base, z); this.add(m, g);
  }
  foliage(m: THREE.Material, x: number, y: number, z: number, scale: THREE.Vector3, seed = 0): void {
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(scale.x, scale.y, scale.z); g.rotateY(seed); g.translate(x, y, z); this.add(m, g);
  }
  /** A tangent-following surface with world-distance UVs. Coordinates are local scene XYZ. */
  ribbon(m: THREE.Material, samples: { x: number; z: number; tx: number; tz: number; s: number; width: number }[], y: number, clipMinX = -Infinity): void {
    if (samples.length < 2) return;
    const pos: number[] = [], uv: number[] = [], index: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i], nx = -p.tz, nz = p.tx;
      for (const side of [-1, 1]) { const x=p.x+nx*p.width/2*side, z=p.z+nz*p.width/2*side; pos.push(x,y,z); uv.push(x/8,(p.s-nz*p.width/2*side)/8); }
      if (i) { const a = (i - 1) * 2, b = i * 2; index.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    // Clip the ramp against the highway edge: one paved layer at junctions, without coplanar overlaps.
    if (Number.isFinite(clipMinX)) {
      const clipped: number[] = [], mapped: number[] = [];
      type Vertex = { x:number; z:number; u:number; v:number };
      for (let i=0;i<index.length;i+=3) {
        const triangle:Vertex[]=index.slice(i,i+3).map(k=>({x:pos[k*3],z:pos[k*3+2],u:uv[k*2],v:uv[k*2+1]}));
        const polygon:Vertex[]=[];
        for (let j=0;j<3;j++) {
          const a=triangle[j],b=triangle[(j+1)%3],inside=a.x>=clipMinX,next=b.x>=clipMinX;
          if(inside)polygon.push(a);
          if(inside!==next){const t=(clipMinX-a.x)/(b.x-a.x);polygon.push({x:clipMinX,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
        }
        for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){clipped.push(v.x,y,v.z);mapped.push(v.u,v.v);}
      }
      pos.splice(0,pos.length,...clipped);uv.splice(0,uv.length,...mapped);
      index.splice(0,index.length,...Array.from({length:pos.length/3},(_,i)=>i));
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); this.add(m, g);
  }
  /** Millimetre-thin paint follows the pavement instead of casting shadows as raised cylinders. */
  paint(m: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, width: number): void {
    const length=Math.hypot(to.x-from.x,to.z-from.z); if(length<1e-6)return;
    const tx=(to.x-from.x)/length,tz=(to.z-from.z)/length;
    this.ribbon(m,[{x:from.x,z:from.z,s:-from.z,tx,tz,width},{x:to.x,z:to.z,s:-to.z,tx,tz,width}],.004);
  }
  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [material, parts] of this.parts) {
      const compatible = parts.map(g => { if (g.index) return g.toNonIndexed(); return g; });
      const geometry = mergeGeometries(compatible, false)!;
      compatible.forEach((g, i) => { g.dispose(); if (g !== parts[i]) parts[i].dispose(); });
      const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; mesh.castShadow = material.userData.castShadow !== false && !(material instanceof THREE.MeshBasicMaterial);
      group.add(mesh);
    }
    this.parts.clear(); return group;
  }
}
