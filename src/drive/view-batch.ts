import * as THREE from 'three';

/** Shared geometry with independent visibility commands for every camera and shadow pass. */
export class ViewBatch extends THREE.BatchedMesh {
  private used = 0;
  private allocated = 0;
  private geometryId: number;
  private submissions = new WeakMap<THREE.Camera,number>();
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity = 256) {
    super(capacity, geometry.attributes.position.count, geometry.index?.count ?? 0, material);
    this.geometryId = this.addGeometry(geometry);
    this.perObjectFrustumCulled = true;
    this.sortObjects = true;
    this.customSort = (list,camera) => {
      this.submissions.set(camera,list.length);
      list.sort(material.transparent ? (a,b)=>b.z-a.z : (a,b)=>a.z-b.z);
    };
    // The individual objects, rather than a city-wide bounding sphere, decide visibility.
    this.frustumCulled = false;
    geometry.dispose();
  }
  get activeCount(): number { return this.used; }
  set activeCount(value: number) {
    if(value > this.maxInstanceCount) throw new Error('City batch capacity exceeded');
    while(this.allocated < value) { this.addInstance(this.geometryId); this.allocated++; }
    for(let i=value;i<this.used;i++)this.setVisibleAt(i,false);
    for(let i=this.used;i<value;i++)this.setVisibleAt(i,true);
    this.used = value;
  }
  visibleFor(camera: THREE.Camera): number { return this.submissions.get(camera) ?? 0; }
  place(matrix: THREE.Matrix4): void {
    const index = this.used; this.activeCount = index + 1; this.setMatrixAt(index,matrix);
  }
}
