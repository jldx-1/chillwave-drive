import * as THREE from 'three';

export const MIST_DENSITY=.0009;
export const MIST_HEIGHT=24;
export const CITY_MIST_START=420;
export const CITY_MIST_END=680;
export function cityMistCoverage(distance:number):number {
  const t=THREE.MathUtils.clamp((distance-CITY_MIST_START)/(CITY_MIST_END-CITY_MIST_START),0,1);
  return t*t*(3-2*t);
}
export const SUNSET_WORLD_DIRECTION=Object.freeze([0,.12,-1]as const);
const fogSkyColorGLSL=`
vec3 cityFogSkyColor(vec3 direction) {
  vec3 ray=normalize(direction);
  float h=ray.y;
  vec3 background=mix(vec3(.045,.018,.075),vec3(.003,.008,.035),smoothstep(-.04,.55,h));
  background+=vec3(.03,.006,.025)*exp(-pow(h*7.,2.));
  return background;
}
`;
const skyColorGLSL=fogSkyColorGLSL+`
uniform float sunsetEnabled;
vec3 citySkyColor(vec3 direction) {
  vec3 ray=normalize(direction);
  vec3 background=cityFogSkyColor(ray);
  // The sun is drawn only by the sky. No surface-fog shader contains its disc or halo.
  vec3 sunAxis=normalize(vec3(0.,.12,-1.));
  float separation=length(ray-sunAxis),radius=.071;
  float disc=1.-smoothstep(radius-.002,radius+.002,separation);
  float halo=exp(-pow(separation/.17,2.)*2.8)*.15;
  float latitude=(ray.y-sunAxis.y)/radius;
  vec3 sunColor=mix(vec3(1.,.12,.51),vec3(1.,.33,.77),smoothstep(-1.,1.,latitude));
  float bands=1.-smoothstep(.08,.24,abs(fract(latitude*5.)-.5));
  sunColor*=mix(mix(.73,1.,bands),1.,smoothstep(-.05,.25,latitude));
  // The disc is behind a violet veil, rather than an overlay in front of nearby vehicles/buildings.
  float veil=.26+.15*exp(-pow((latitude+.45)*.85,2.));
  sunColor=mix(sunColor,vec3(.32,.12,.38),veil);
  float alpha=disc*.86*(1.-veil*.42)+halo*(1.-disc);
  return mix(background,sunColor,alpha*sunsetEnabled);
}
`;
/** Analytic integral of low-lying haze along a view ray; no depth buffers or fog planes. */
export function mistOpacity(distance:number,eyeHeight:number,surfaceHeight:number):number {
  const a=Math.max(0,eyeHeight)/MIST_HEIGHT,delta=(Math.max(0,surfaceHeight)-Math.max(0,eyeHeight))/MIST_HEIGHT;
  const integral=Math.exp(-a)*(Math.abs(delta)<.0001?1:-Math.expm1(-delta)/delta);
  return -Math.expm1(-Math.max(0,distance)*MIST_DENSITY*integral);
}
export function sunsetDirection(target=new THREE.Vector3()):THREE.Vector3 {
  return target.fromArray(SUNSET_WORLD_DIRECTION).normalize();
}
export function sunsetScreenPosition(camera:THREE.PerspectiveCamera):THREE.Vector3 {
  camera.updateMatrixWorld();return sunsetDirection().multiplyScalar(1500).add(camera.position).project(camera);
}
const heightFogGLSL=`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float distanceFog=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
    float distanceFog=smoothstep(fogNear,fogFar,vFogDepth);
  #endif
  float mistDistance=length(mistWorldPosition-cameraPosition);
  float mistEye=max(0.,cameraPosition.y)/24.;
  float mistDelta=(max(0.,mistWorldPosition.y)-max(0.,cameraPosition.y))/24.;
  float mistIntegral=exp(-mistEye)*(abs(mistDelta)<.0001?1.:(1.-exp(-mistDelta))/mistDelta);
  // Broad, static banks stay attached to world coordinates through origin rebases.
  vec3 mistMid=(mistWorldPosition+cameraPosition)*.5;
  mistMid.z-=mistOrigin;
  float mistBank=.88+.12*sin(mistMid.x*.017+mistMid.z*.009)*sin(mistMid.z*.004-mistMid.x*.006);
  float groundMist=1.-exp(-mistDistance*.0009*mistIntegral*mistBank);
  float horizonCoverage=smoothstep(420.,680.,mistDistance);
  float combinedFog=max(1.-(1.-distanceFog)*(1.-groundMist),horizonCoverage);
  vec3 horizonColor=linearToOutputTexel(vec4(cityFogSkyColor(mistWorldPosition-cameraPosition),1.)).rgb;
  vec3 mistColor=mix(fogColor,horizonColor,smoothstep(120.,680.,mistDistance));
  gl_FragColor.rgb=mix(gl_FragColor.rgb,mistColor,combinedFog);
#endif
`;

/** Height-integrated street mist and a fixed celestial sunset down the forward highway. */
export class CityAtmosphere {
  readonly sky:THREE.Mesh;
  private viewDirection=new THREE.Vector3();
  private projectedSun=new THREE.Vector3();
  private sunInView=false;
  private origin={value:0};
  private hooked=new WeakSet<THREE.Material>();
  constructor() {
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1800,32,20),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,uniforms:{sunsetEnabled:{value:1}},
      vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
      fragmentShader:`varying vec3 skyDirection;${skyColorGLSL}
        void main(){gl_FragColor=vec4(citySkyColor(skyDirection),1.);
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.name='sky';this.sky.renderOrder=-100;this.sky.frustumCulled=false;this.sky.userData.colorOnly=true;
    this.sky.onBeforeRender=(_renderer,_scene,camera)=>{this.sky.position.setFromMatrixPosition(camera.matrixWorld);this.sky.updateMatrixWorld(true);};
  }
  inspectView(camera:THREE.PerspectiveCamera):void {
    camera.getWorldDirection(this.viewDirection);
    sunsetDirection(this.projectedSun).multiplyScalar(1500).add(camera.position).project(camera);
    this.sunInView=this.viewDirection.z<0&&Math.abs(this.projectedSun.x)<1.1&&Math.abs(this.projectedSun.y)<1.1;
  }
  apply(scene:THREE.Object3D):void {
    scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      for(const material of Array.isArray(o.material)?o.material:[o.material]) {
        if(this.hooked.has(material)||!(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshBasicMaterial)||!material.fog)continue;
        this.hooked.add(material);
        const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
        material.onBeforeCompile=(shader,renderer)=>{
          previous.call(material,shader,renderer);
          shader.uniforms.mistOrigin=this.origin;
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mistWorldPosition;');
          shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
            vec4 mistVertex=vec4(transformed,1.);
            #ifdef USE_INSTANCING
              mistVertex=instanceMatrix*mistVertex;
            #endif
            mistWorldPosition=(modelMatrix*mistVertex).xyz;
          `);
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 mistWorldPosition;uniform float mistOrigin;\n'+fogSkyColorGLSL);
          shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',heightFogGLSL);
        };
        material.customProgramCacheKey=()=>`${key}:height-mist-v3`;material.needsUpdate=true;
      }
    });
  }
  setSunsetEnabled(enabled:boolean):void {(this.sky.material as THREE.ShaderMaterial).uniforms.sunsetEnabled.value=enabled?1:0;}
  update(origin:number):void {this.origin.value=origin;}
  get diagnostics(){return {height:MIST_HEIGHT,density:MIST_DENSITY,fullyHiddenAt:CITY_MIST_END,origin:this.origin.value,sunsetVisible:this.sky.visible,sunsetInView:this.sunInView,sunsetWorldDirection:SUNSET_WORLD_DIRECTION,sunsetDepthTest:(this.sky.material as THREE.ShaderMaterial).depthTest};}
}
