import { ViewBatch } from './view-batch';
import type { Quality } from './config';
import { CityMaterialBatches } from './city-material-batches';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder } from './procedural-buildings/builder';
import { buildHive } from './procedural-buildings/hive';
import { buildArcology } from './procedural-buildings/arcology';
import { buildCapsule } from './procedural-buildings/capsule';
import { MaterialLib, shared } from './procedural-buildings/materials';
import { NEON_CHARS } from './procedural-buildings/neonfont';
import type { Params } from './procedural-buildings/types';
import type { CityChunkSpec, CityParcel } from './world-layout';

export const PROCEDURAL_FAMILIES = ['hive', 'arcology', 'capsule'] as const;
export type ProceduralFamily = typeof PROCEDURAL_FAMILIES[number];
/** Existing plots remain the collision/road authority; all visible architecture is replaced. */
export function proceduralFamily(p: CityParcel): ProceduralFamily {
  if (p.style === 'residential' || p.style === 'masonry' || p.style === 'warehouse') return 'hive';
  if (p.style === 'rounded' || p.style === 'garage') return 'capsule';
  return PROCEDURAL_FAMILIES[((p.assetId ?? p.seed) + p.row) % 3];
}
export function fitProceduralBuilding(p: CityParcel, bounds: THREE.Box3, origin: number): THREE.Matrix4 {
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  // Include signs, roof props and cantilevers in the measured footprint, not just the core.
  const scale = Math.min((p.width - 1) / size.x, (p.depth - 1) / size.z);
  const sx=Math.min((p.width-1)/size.x,scale*1.35),sz=Math.min((p.depth-1)/size.z,scale*1.35);
  const sy = Math.min(p.height / size.y, scale * 2.6);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p.x - center.x * sx, -bounds.min.y * sy, origin - p.s - center.z * sz),
    new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz),
  );
}

/** Teach standalone sign/neon vertex shaders to use the same instance transform as Three's surfaces. */
function instanceShader(material: THREE.Material): void {
  if (!(material instanceof THREE.ShaderMaterial) || material.userData.cityInstancing) return;
  material.userData.cityInstancing = true;
  const main = material.vertexShader.indexOf('void main()');
  if (main < 0) return;
  const head = material.vertexShader.slice(0, main);
  const body = material.vertexShader.slice(main).replace(/\bposition\b/g, 'cityPosition').replace(/\bnormal\b/g, 'cityNormal');
  material.vertexShader = '#include <batching_pars_vertex>\n' + head + body.replace('{', `{
    #include <batching_vertex>
    vec3 cityPosition = position;
    vec3 cityNormal = normal;
    #ifdef USE_BATCHING
      cityPosition = (batchingMatrix * vec4(position, 1.)).xyz;
      mat3 cityBatchBasis = mat3(batchingMatrix);
      cityNormal = cityBatchBasis * (normal / vec3(dot(cityBatchBasis[0],cityBatchBasis[0]),dot(cityBatchBasis[1],cityBatchBasis[1]),dot(cityBatchBasis[2],cityBatchBasis[2])));
    #endif
    #ifdef USE_INSTANCING
      cityPosition = (instanceMatrix * vec4(position, 1.)).xyz;
      mat3 cityBasis = mat3(instanceMatrix);
      cityNormal = cityBasis * (normal / vec3(dot(cityBasis[0],cityBasis[0]),dot(cityBasis[1],cityBasis[1]),dot(cityBasis[2],cityBasis[2])));
    #endif
  `);
}
interface Template { family: ProceduralFamily; bounds: THREE.Box3; meshes: ViewBatch[]; detail: ViewBatch[]; windows: {seed:number;points:THREE.Vector3[]}[]; }

/** Six deterministic generated buildings, instanced across the streamed city instead of rebuilt per plot. */
export class ProceduralCity {
  readonly group = new THREE.Group();
  private templates: Template[] = [];
  private materials = new MaterialLib();
  private active = 0;
  private detailDistance = 180;
  private entries: { parcel: CityParcel; template: Template; matrix: THREE.Matrix4; bounds: THREE.Box3; near: boolean }[] = [];
  private chunks: CityChunkSpec[] = [];
  private detailBuildings = 0;
  private uploads = 0;
  private cameraVisibility = {visibleBuildings:0,submittedPieces:0,culledPieces:0};
  private viewFrustum = new THREE.Frustum();
  private viewProjection = new THREE.Matrix4();
  private counts: Record<ProceduralFamily, number> = { hive: 0, arcology: 0, capsule: 0 };
  constructor() { this.group.name = 'procedural-cyberpunk-city'; }
  private prepare(): void {
    if (this.templates.length) return;
    for (const family of PROCEDURAL_FAMILIES) for (let variant = 0; variant < 2; variant++) {
      const b = new Builder(); b.separateDetail = true; b.neonChars = NEON_CHARS; b.prefix = family + '.';
      const p: Params = {
        type: family, seed: 42 + variant * 137, palette: 'Vapor', texts: {},
        floors: family === 'arcology' ? 24 + variant * 6 : 8 + variant * 3,
        width: family === 'capsule' ? 2 : 4 + variant, depth: 3 + variant,
        clutter: .28, signs: .65, ac: .32, cables: .12,
        opts: { cages: .12, laundry: .08, antennas: 3, tanks: 1, shacks: 1, bladeTiers: 1,
          elevators: 0, hologram: 0, cube: 0, screens: 1, led: 1, podDensity: .72 },
      };
      ({ hive: buildHive, arcology: buildArcology, capsule: buildCapsule }[family])(p, b);
      const generated = b.build(this.materials);
      generated.updateMatrixWorld(true);
      // Flatten static extras (sign faces, tube text, stalls) and merge by material/attributes.
      const batches = new CityMaterialBatches(generated);
      const windows:Template['windows']=[];
      const parts = new Map<string, { material: THREE.Material; detail: boolean; geometries: THREE.BufferGeometry[] }>();
      generated.traverse(o => {
        if (!(o instanceof THREE.Mesh) || !o.visible || Array.isArray(o.material) || !o.material.visible) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const win=g.getAttribute('aWin'),uv=g.getAttribute('uv'),position=g.getAttribute('position');
        if(win&&uv)for(let i=0;i<win.count;i+=6) {
          // A sparse sample from each facade is enough for camera-motion QA.
          if(i/6%3!==0)continue;
          const corners:THREE.Vector3[]=[];
          for(const [u,v] of [[0,0],[1,0],[0,1]]) {
            const at=Array.from({length:6},(_,j)=>i+j).find(j=>Math.abs(uv.getX(j)-u)<.001&&Math.abs(uv.getY(j)-v)<.001);
            if(at!==undefined)corners.push(new THREE.Vector3().fromBufferAttribute(position,at));
          }
          if(corners.length===3)windows.push({seed:win.getX(i),points:corners});
        }
        const material = batches.material(o.material, g);
        const key = material.uuid + ':' + Object.keys(g.attributes).sort().join(',') + ':' + !!o.userData.cityDetail;
        if (!parts.has(key)) parts.set(key, { material, detail: !!o.userData.cityDetail, geometries: [] });
        parts.get(key)!.geometries.push(g);
      });
      const bounds = new THREE.Box3(), meshes: ViewBatch[] = [], detail: ViewBatch[] = [];
      for (const { material, geometries, detail: isDetail } of parts.values()) {
        const merged = mergeGeometries(geometries, false)!;
        const geometry = mergeVertices(merged); merged.dispose(); geometries.forEach(g => g.dispose());
        geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!);
        instanceShader(material);
        const mesh = new ViewBatch(geometry, material);
        mesh.activeCount = 0; mesh.name = `procedural-${family}-${variant}`;
        mesh.castShadow = !isDetail && material instanceof THREE.MeshStandardMaterial;
        mesh.userData.cityDetail = isDetail;
        mesh.receiveShadow = true;
        this.group.add(mesh); (isDetail ? detail : meshes).push(mesh);
      }
      const originals = new Set<THREE.BufferGeometry>();
      generated.traverse(o => { if (o instanceof THREE.Mesh) originals.add(o.geometry); });
      originals.forEach(g => g.dispose());
      this.templates.push({ family, bounds, meshes, detail, windows });
    }
  }
  update(chunks: CityChunkSpec[], origin: number, focusS = 0, focusX = 0): void {
    this.group.position.z = origin;
    if (chunks.length === this.chunks.length && chunks.every((c,i) => c === this.chunks[i])) return;
    const previousNear = new Map(this.entries.map(e => [e.parcel.id,e.near]));
    this.chunks = chunks.slice(); this.entries = [];
    this.prepare(); this.active = 0; this.counts = { hive: 0, arcology: 0, capsule: 0 };
    this.templates.forEach(t => t.meshes.forEach(m => { m.activeCount = 0; }));
    for (const chunk of chunks) for (const p of chunk.parcels) {
      const family = proceduralFamily(p), variant = (p.seed >>> 4) % 2;
      const template = this.templates[PROCEDURAL_FAMILIES.indexOf(family) * 2 + variant];
      const matrix = fitProceduralBuilding(p, template.bounds, 0);
      for (const mesh of template.meshes) {
        mesh.place(matrix);
      }
      this.entries.push({parcel:p,template,matrix,bounds:template.bounds.clone().applyMatrix4(matrix),near:previousNear.get(p.id) ?? false});
      this.active++; this.counts[family]++;
    }
    this.templates.forEach(t => t.meshes.forEach(m => { m.computeBoundingSphere(); }));
    this.uploads++; this.updateDetail(focusS, focusX, true);
  }
  configure(quality: Quality): void {
    this.detailDistance = {potato:40,low:100,medium:180,high:260,ultra:360}[quality];
  }
  /** Only rebuild fixture instance buffers when a building crosses a hysteresis boundary. */
  updateDetail(s: number, x: number, force = false): void {
    let changed = force;
    for (const entry of this.entries) {
      const p = entry.parcel;
      const distance = Math.hypot(Math.max(0, Math.abs(p.x-x)-p.width/2), Math.max(0, Math.abs(p.s-s)-p.depth/2));
      const near = distance < this.detailDistance + (entry.near ? 24 : 0);
      if (near !== entry.near) { entry.near = near; changed = true; }
    }
    if (!changed) return;
    this.detailBuildings = 0;
    this.templates.forEach(t => t.detail.forEach(m => {m.activeCount = 0;}));
    for (const entry of this.entries) if (entry.near) {
      this.detailBuildings++;
      for (const mesh of entry.template.detail) mesh.place(entry.matrix);
    }
    this.templates.forEach(t => t.detail.forEach(m => {m.computeBoundingSphere();}));
    this.uploads++;
  }
  inspectCamera(camera: THREE.Camera): void {
    this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.group.matrixWorld);
    this.viewFrustum.setFromProjectionMatrix(this.viewProjection);
    this.cameraVisibility.visibleBuildings = this.entries.filter(e=>this.viewFrustum.intersectsBox(e.bounds)).length;
    let submitted=0,eligible=0;
    for(const t of this.templates)for(const mesh of [...t.meshes,...t.detail]) {
      submitted+=mesh.visibleFor(camera); eligible+=mesh.activeCount;
    }
    this.cameraVisibility.submittedPieces=submitted;
    this.cameraVisibility.culledPieces=eligible-submitted;
  }
  /** QA projects fixed locations inside real window panes, allowing the same surface to be compared while driving. */
  windowProbes(camera:THREE.Camera) {
    const result:{id:string;area:number;points:number[][]}[]=[],world=new THREE.Matrix4(),center=new THREE.Vector3();
    for(const entry of this.entries) {
      if(!this.viewFrustum.intersectsBox(entry.bounds))continue;
      world.multiplyMatrices(this.group.matrixWorld,entry.matrix);
      for(const [paneIndex,pane] of entry.template.windows.entries()) {
        const [a,b,c]=pane.points.map(p=>p.clone().applyMatrix4(world));
        const normal=b.clone().sub(a).cross(c.clone().sub(a));center.copy(b).add(c).multiplyScalar(.5);
        if(normal.dot(camera.position.clone().sub(center))<=0)continue;
        const projected=[a,b,c].map(p=>p.clone().project(camera));
        if(projected.some(p=>p.z<0||p.z>1||Math.abs(p.x)>.88||Math.abs(p.y)>.8))continue;
        const area=Math.abs((projected[1].x-projected[0].x)*(projected[2].y-projected[0].y)-(projected[1].y-projected[0].y)*(projected[2].x-projected[0].x));
        if(area<.002||area>.035)continue;
        const ray=new THREE.Ray(camera.position.clone(),center.clone().sub(camera.position).normalize());
        const distance=camera.position.distanceTo(center);
        if(this.entries.some(other=>{
          if(other===entry)return false;
          const hit=ray.intersectBox(other.bounds.clone().applyMatrix4(this.group.matrixWorld),new THREE.Vector3());
          return hit!==null&&hit.distanceTo(camera.position)<distance-.2;
        }))continue;
        const points:number[][]=[];
        for(let y=0;y<5;y++)for(let x=0;x<5;x++) {
          const p=a.clone().addScaledVector(b.clone().sub(a),.2+x*.15).addScaledVector(c.clone().sub(a),.2+y*.15).project(camera);
          points.push([p.x,p.y]);
        }
        result.push({id:entry.parcel.id+':'+paneIndex,area,points});
      }
    }
    return result.sort((a,b)=>b.area-a.area).slice(0,80);
  }
  animate(time: number, reduced: boolean): void { shared.uTime.value = reduced ? 0 : time; }
  setNeon(enabled: boolean): void { shared.uNeon.value = enabled ? 1.4 : 0; }
  get diagnostics() {
    return { culling:'per-building/per-camera', visibility:{...this.cameraVisibility}, source: 'CyberPunkProceduralBuildingsThreeJS', templates: this.templates.length,
      activeBuildings: this.active, families: { ...this.counts },
      drawBatches: this.group.children.length, detailBuildings:this.detailBuildings, instanceUploads:this.uploads,
      templateVertices: this.templates.reduce((n,t) => n + [...t.meshes,...t.detail].reduce((a,m) => a + m.geometry.attributes.position.count, 0), 0) };
  }
}
