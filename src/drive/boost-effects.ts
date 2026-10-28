import * as THREE from 'three';
/** Two short, crossed flame ribbons follow the modeled exhaust ports. No per-boost allocation. */
export class BoostEffects {
  readonly group=new THREE.Group();
  private geometry=new THREE.BufferGeometry();
  private material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{strength:{value:0},time:{value:0}},
    vertexShader:'varying vec2 flameUV;uniform float time;void main(){flameUV=uv;vec3 p=position;p.x+=sin(uv.y*9.-time*18.)*.018*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:'varying vec2 flameUV;uniform float strength;void main(){float x=abs(flameUV.x*2.-1.);float w=pow(max(0.,1.-flameUV.y),.7);float shape=1.-smoothstep(w*.35,max(.001,w),x);float tip=1.-smoothstep(.65,1.,flameUV.y);float core=pow(max(0.,1.-x/max(.001,w)),3.);vec3 color=mix(vec3(1.5,.25,.025),vec3(.3,.8,1.8),core*(1.-flameUV.y));gl_FragColor=vec4(color,shape*tip*strength*.8);}',
  });
  constructor(){
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -.25,0,0,.25,0,0,-.08,.04,2.5,.08,.04,2.5,
      0,-.04,0,0,.26,0,0,.05,2.5,0,.1,2.5,
    ],3));
    this.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1],2));
    this.geometry.setIndex([0,1,2,2,1,3,4,5,6,6,5,7]);
    for(let i=0;i<2;i++){const mesh=new THREE.Mesh(this.geometry,this.material);mesh.name='exhaust-flame-'+i;mesh.scale.set(.3,.6,1);this.group.add(mesh);}
    this.geometry.computeVertexNormals();
    this.group.userData.colorOnly=true;
    this.group.visible=false;
  }
  setMounts(mounts:readonly THREE.Vector3[]):void{
    this.group.children.forEach((mesh,i)=>{
      const mount=mounts[i];if(mount)mesh.position.copy(mount);
    });
  }
  update(pulse:number,time:number,reduced=false):void{
    const strength=THREE.MathUtils.clamp(pulse/.32,0,1);
    this.material.uniforms.strength.value=strength*(reduced?.55:1);
    this.material.uniforms.time.value=time;
    this.group.visible=strength>.005;
    for(const plume of this.group.children)plume.scale.z=(.6+.4*strength)*(reduced?.65:1);
  }
  get diagnostics(){return {visible:this.group.visible,strength:this.material.uniforms.strength.value,plumes:this.group.children.length};}
  dispose():void{this.geometry.dispose();this.material.dispose();this.group.clear();}
}
