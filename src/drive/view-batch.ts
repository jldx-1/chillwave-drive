import * as THREE from 'three';

interface CameraView {mesh:THREE.InstancedMesh<THREE.BufferGeometry,THREE.Material>;ids:Int32Array;count:number;capacity:number;revision:number}
/** Camera-specific native instancing. Geometry attributes are shared; matrices and VAOs remain independent per pass. */
export class ViewBatch extends THREE.Group {
  readonly geometry:THREE.BufferGeometry;
  material:THREE.Material;
  boundingSphere:THREE.Sphere|null=null;
  boundingBox:THREE.Box3|null=null;
  private used=0;private allocated=0;private revision=0;
  private transforms:Float32Array;
  private bounds:Float32Array;
  private sourceSphere:THREE.Sphere;
  private records:{index:number;z:number}[]=[];
  private list:{index:number;z:number}[]=[];
  private submissions=new WeakMap<THREE.Camera,number>();
  private views=new Map<number,CameraView>();
  private current:CameraView;
  private projection=new THREE.Matrix4();private view=new THREE.Matrix4();private frustum=new THREE.Frustum();
  private sphere=new THREE.Sphere();private scratchMatrix=new THREE.Matrix4();private box=new THREE.Box3();
  constructor(geometry:THREE.BufferGeometry,material:THREE.Material,readonly maxInstanceCount=256) {
    super();this.geometry=geometry.clone();geometry.dispose();this.material=material;
    this.geometry.computeBoundingSphere();this.geometry.computeBoundingBox();this.sourceSphere=this.geometry.boundingSphere!.clone();
    this.transforms=new Float32Array(maxInstanceCount*16);this.bounds=new Float32Array(maxInstanceCount*4);
    for(let i=0;i<maxInstanceCount;i++)new THREE.Matrix4().toArray(this.transforms,i*16);
    this.frustumCulled=false;this.current=this.createView(0);
  }
  static prepare(_renderer:THREE.WebGLRenderer,root:THREE.Object3D,camera?:THREE.Camera,shadowCamera?:THREE.Camera):void {
    root.traverse(object=>{
      if(!(object instanceof ViewBatch)||!camera)return;
      object.views.forEach(view=>{view.mesh.visible=false;});
      const color=object.select(camera);color.mesh.visible=color.count>0;color.mesh.receiveShadow=object.receiveShadow;color.mesh.castShadow=false;
      if(shadowCamera&&object.castShadow) {
        const shadow=object.select(shadowCamera,5);shadow.mesh.visible=shadow.count>0;shadow.mesh.castShadow=true;
      }
    });
  }
  private createView(key:number):CameraView {
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(this.geometry.attributes))geometry.setAttribute(name,attribute);
    geometry.setIndex(this.geometry.index);geometry.boundingBox=this.geometry.boundingBox;geometry.boundingSphere=this.geometry.boundingSphere;
    const mesh=new THREE.InstancedMesh(geometry,this.material,Math.min(4,this.maxInstanceCount));
    mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;
    const view:CameraView={mesh,ids:new Int32Array(this.maxInstanceCount),count:-1,capacity:Math.min(4,this.maxInstanceCount),revision:-1};
    if(key===5){mesh.onBeforeRender=()=>{mesh.count=0;};mesh.onBeforeShadow=()=>{mesh.count=view.count;};}
    this.views.set(key,view);this.add(mesh);return view;
  }
  get instanceMatrix():THREE.InstancedBufferAttribute{return this.current.mesh.instanceMatrix;}
  invalidateGPU():void {for(const view of this.views.values()){view.revision=-1;view.mesh.instanceMatrix.needsUpdate=true;}}
  get instanceCount():number{return this.allocated;}
  get activeCount():number{return this.used;}
  set activeCount(value:number) {
    if(value<0||value>this.maxInstanceCount||!Number.isInteger(value))throw new RangeError('City batch capacity exceeded');
    while(this.allocated<value){const index=this.allocated++;this.records.push({index,z:0});this.cacheBounds(index);}
    this.used=value;
  }
  setMatrixAt(index:number,matrix:THREE.Matrix4):void {
    if(index<0||index>=this.maxInstanceCount)throw new RangeError('Invalid instance index');
    matrix.toArray(this.transforms,index*16);this.cacheBounds(index);this.revision++;
  }
  getMatrixAt(index:number,matrix:THREE.Matrix4):void {matrix.fromArray(this.transforms,index*16);}
  private cacheBounds(index:number):void {
    this.scratchMatrix.fromArray(this.transforms,index*16);this.sphere.copy(this.sourceSphere).applyMatrix4(this.scratchMatrix);
    const at=index*4;this.bounds[at]=this.sphere.center.x;this.bounds[at+1]=this.sphere.center.y;this.bounds[at+2]=this.sphere.center.z;this.bounds[at+3]=this.sphere.radius*1.000001;
  }
  place(matrix:THREE.Matrix4):void {const index=this.used;this.activeCount=index+1;this.setMatrixAt(index,matrix);}
  visibleFor(camera:THREE.Camera):number{return this.submissions.get(camera)??0;}
  override onBeforeRender(...args:Parameters<THREE.Object3D['onBeforeRender']>):void {this.select(args[2]);}
  override onBeforeShadow(...args:Parameters<THREE.Object3D['onBeforeShadow']>):void {this.select(args[3],5);}
  private select(camera:THREE.Camera,forcedKey?:number):CameraView {
    const tag=camera.userData.viewBatchSlot,key=forcedKey??(typeof tag==='number'&&tag>=0&&tag<4?tag:4);
    const view=this.views.get(key)??this.createView(key);this.current=view;
    this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.matrixWorld);this.frustum.setFromProjectionMatrix(this.projection);
    this.view.multiplyMatrices(camera.matrixWorldInverse,this.matrixWorld);const matrix=this.view.elements;this.list.length=0;
    for(let i=0;i<this.used;i++) {
      const at=i*4,x=this.bounds[at],y=this.bounds[at+1],z=this.bounds[at+2];this.sphere.center.set(x,y,z);this.sphere.radius=this.bounds[at+3];
      if(!this.frustum.intersectsSphere(this.sphere))continue;
      const record=this.records[i];record.z=-(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]);this.list.push(record);
    }
    this.list.sort(this.material.transparent?(a,b)=>b.z-a.z:(a,b)=>a.z-b.z);
    this.submissions.set(camera,this.list.length);view.mesh.matrixWorld.copy(this.matrixWorld);view.mesh.material=this.material;
    let changed=view.revision!==this.revision||view.count!==this.list.length;
    if(!changed)for(let i=0;i<this.list.length;i++)if(view.ids[i]!==this.list[i].index){changed=true;break;}
    if(changed) {
      if(this.list.length>view.capacity) {
        view.capacity=Math.min(this.maxInstanceCount,2**Math.ceil(Math.log2(this.list.length)));
        view.mesh.dispose();view.mesh.instanceMatrix=new THREE.InstancedBufferAttribute(new Float32Array(view.capacity*16),16).setUsage(THREE.DynamicDrawUsage);
      }
      const output=view.mesh.instanceMatrix.array;
      for(let i=0;i<this.list.length;i++) {
        const index=this.list[i].index,from=index*16,to=i*16;view.ids[i]=index;
        for(let k=0;k<16;k++)output[to+k]=this.transforms[from+k];
      }
      view.count=this.list.length;view.revision=this.revision;view.mesh.instanceMatrix.clearUpdateRanges();
      view.mesh.instanceMatrix.addUpdateRange(0,view.count*16);view.mesh.instanceMatrix.needsUpdate=true;view.mesh.boundingSphere=null;view.mesh.boundingBox=null;
    }
    view.mesh.count=view.count;return view;
  }
  computeBoundingSphere():void {
    this.boundingSphere??=new THREE.Sphere();this.boundingSphere.makeEmpty();
    for(let i=0;i<this.used;i++){const at=i*4;this.sphere.center.set(this.bounds[at],this.bounds[at+1],this.bounds[at+2]);this.sphere.radius=this.bounds[at+3];this.boundingSphere.union(this.sphere);}
  }
  computeBoundingBox():void {
    this.boundingBox??=new THREE.Box3();this.boundingBox.makeEmpty();
    for(let i=0;i<this.used;i++){this.getMatrixAt(i,this.scratchMatrix);this.box.copy(this.geometry.boundingBox!).applyMatrix4(this.scratchMatrix);this.boundingBox.union(this.box);}
  }
  dispose():this {for(const view of this.views.values()){view.mesh.dispose();view.mesh.geometry.dispose();}this.views.clear();this.geometry.dispose();this.clear();return this;}
}
