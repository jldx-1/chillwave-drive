import * as THREE from 'three';
import { CYBER_VEHICLES,cyberModel,type CyberModel } from './cyber-vehicles';
import { catalogDetailVisible } from './catalog-buildings';
import { CityAtmosphere,CITY_MIST_END,sunsetScreenPosition } from './atmosphere';
import { BUILDING_CATALOG } from './building-catalog';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Presentation } from './post';
import { roadTextures } from './materials';
import { CrashEffects } from './crashes';
import type { Contact } from './collisions';
import { cityChunk,CITY_STREAM_BEHIND,CITY_STREAM_AHEAD } from './world-layout';
import { buildCityChunk } from './city-chunk';
import { CityMaterials } from './world-materials';
import { CityBackdrop } from './skyline';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { sceneZ, originFor } from './road';
import { CarVisual } from './car';
import { FleetDistant, fleetDiagnostics, fleetKind, preloadFleet,buildFleetCar,animateFleetRig,disposeFleetRig } from './fleet-asset';
import { VehicleLighting } from './vehicle-lighting';
import { StableSunShadow, colorPassReflection } from './stable-lighting';
import type { Agent } from './traffic';
import type { Pose, Vehicle } from './vehicle';
import type { Quality, View } from './config';
import { RainField, rainSheltered } from './weather';
import { RainSplashes } from './rain-splashes';
import { medianGate } from './median';
import { PowerUpVisuals } from './powerup-visuals';
import type { PowerUp } from './powerups';
import { AerialTraffic } from './aerial-traffic';
import { CityLighting } from './city-lighting';
import { wetSurfaceGLSL } from './wet-surface';
import { neonRoad } from './night-road';
import { qualityPixelRatio } from './performance';
const mat = (color: string, roughness = .7, metalness = .1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export class DriveScene {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly player = new CarVisual('#00a8d6', true);
  readonly rearTarget = new THREE.WebGLRenderTarget(512, 192);
  readonly rearCamera = new THREE.PerspectiveCamera(65, 512 / 192, .1, 180);
  readonly rain: THREE.LineSegments;
  readonly headlights = new THREE.Group();
  origin = 0;
  private chunks = new Map<number, THREE.Group>();
  private cars = new Map<number, CarVisual>();
  private powerupVisuals = new PowerUpVisuals();
  private distantFleet = new FleetDistant();
  private trafficLighting = new VehicleLighting();
  readonly ready: Promise<void>;
  private fleetReady = false;
  private fleetFailed = false;
  private rainField = new RainField();
  private rainSplashes = new RainSplashes();
  private sprayArray = new Float32Array(2400 * 3);
  private spraySeeds=new Map<number,Float64Array>();
  private spray: THREE.Points;
  private seed = 'SUNSET';
  private reflector: Reflector;
  private quality: Quality = 'high';
  private mirrorFrames = 0;
  private mirrorDirection = new THREE.Vector3(); private mirrorFocus = new THREE.Vector3();
  private mobile = matchMedia('(pointer: coarse)').matches;
  private streamedChunk = NaN; private streamedOrigin = NaN;
  private effectsReady = false;
  private post?: Presentation;
  private sunLighting = new StableSunShadow();
  private surfaces = roadTextures();
  private cityMaterials = new CityMaterials();
  private backdrop = new CityBackdrop();
  private renderWidth = 1280; private renderHeight = 800;
  private pixelRatio = 1;
  private hdrReady = false;
  private crash = new CrashEffects(this.scene);
  private asphalt = mat('#26303c', .48, .12);
  private carRim = new THREE.Group();
  private cityLighting = new CityLighting();
  private aerialTraffic = new AerialTraffic(this.cityMaterials);
  private atmosphere=new CityAtmosphere();
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#080f2c'); this.scene.fog = new THREE.FogExp2('#221934', .0022);
    const pmrem = new THREE.PMREMGenerator(this.renderer), environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, .04).texture; environment.dispose(); pmrem.dispose();
    this.scene.environmentIntensity = .25;
    this.scene.add(new THREE.HemisphereLight('#91b7ff', '#45204c', 1.55));
    this.scene.add(this.sunLighting.light,this.sunLighting.target);
    this.asphalt.userData.castShadow=false; neonRoad(this.asphalt);
    this.asphalt.map = this.surfaces.color; this.asphalt.normalMap = this.surfaces.normal; this.asphalt.roughnessMap = this.surfaces.rough; this.asphalt.normalScale.set(.55, .55);
    const environmentReady = new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}textures/venice-sunset.hdr`).then(hdr => {
      const generator = new THREE.PMREMGenerator(this.renderer), target = generator.fromEquirectangular(hdr);
      this.scene.environment?.dispose(); this.scene.environment = target.texture; this.scene.environmentIntensity = .22; this.hdrReady = true; hdr.dispose(); generator.dispose();
    }).catch(() => {});
    this.scene.add(this.atmosphere.sky);
    // Both ends stay beyond the fog fade, including before/after a kilometre origin shift.
    this.reflector = new Reflector(new THREE.PlaneGeometry(33, 6000), { color: 0x423d72, textureWidth: 1024, textureHeight: 1024, clipBias: .003 });
    this.reflector.userData.colorOnly=true;
    colorPassReflection(this.reflector);
    const reflectionTexture=this.reflector.getRenderTarget().texture;
    reflectionTexture.generateMipmaps=true;reflectionTexture.minFilter=THREE.LinearMipmapLinearFilter;
    const wet = this.reflector.material as THREE.ShaderMaterial;
    wet.transparent = true; wet.depthWrite = false;
    // A millimetre gap cannot separate road/glaze depth at grazing angles. Bias the decal consistently.
    wet.polygonOffset=true;wet.polygonOffsetFactor=-1;wet.polygonOffsetUnits=-2;
    Object.assign(wet.uniforms, { patrolPositions: { value: this.trafficLighting.positions }, patrolColors: { value: this.trafficLighting.colors }, roadNormal: { value: this.surfaces.normal }, roadRough: { value: this.surfaces.rough }, roadOrigin: { value: 0 }, headPose: { value: new THREE.Vector3() }, headDirection: { value: new THREE.Vector2(0,-1) }, headOn:{ value:1 } });
    wet.vertexShader = wet.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 wetWorld;').replace('vUv = textureMatrix', 'wetWorld = (modelMatrix * vec4(position,1.)).xyz; vUv = textureMatrix');
    wet.fragmentShader = wet.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 wetWorld; uniform sampler2D roadNormal; uniform sampler2D roadRough; uniform float roadOrigin; uniform vec3 headPose; uniform vec2 headDirection; uniform float headOn; uniform vec3 patrolPositions[4]; uniform vec3 patrolColors[4];');
    wet.fragmentShader = wet.fragmentShader.replace('void main() {', wetSurfaceGLSL+'\nvoid main() {');
    wet.fragmentShader = wet.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
      vec2 surfaceUV = vec2(wetWorld.x, roadOrigin-wetWorld.z)/8.;
      vec3 normalDetail = texture2D(roadNormal,surfaceUV).rgb*2.-1.;
      vec3 wetState=roadWetState(surfaceUV*8.);
      float rough=mix(wetState.z,texture2D(roadRough,surfaceUV).r,.22);
      float ripple=wetNoise(surfaceUV*vec2(1.9,.9));
      vec2 uv=vUv.xy/vUv.w+normalDetail.xy*mix(.003,.0006,wetState.y)+vec2(ripple-.5,0.)*.0015;
      // Off-screen reflection samples fade into asphalt instead of stretching the texture's edge.
      vec2 reflectionEdge = smoothstep(vec2(0.),vec2(.025),uv) * (1.-smoothstep(vec2(.975),vec2(1.),uv));
      float reflectionCoverage = reflectionEdge.x * reflectionEdge.y * step(.0001,vUv.w);
      float blur=mix(.001,.007,rough);
      vec4 base = texture2D(tDiffuse,uv)*.4;
      base += texture2D(tDiffuse,uv+vec2(blur,0.))*.15;
      base += texture2D(tDiffuse,uv-vec2(blur,0.))*.15;
      base += texture2D(tDiffuse,uv+vec2(0.,blur*.55))*.15;
      base += texture2D(tDiffuse,uv-vec2(0.,blur*.55))*.15;
      float fresnel = pow(1.-abs(normalize(cameraPosition-wetWorld).y),4.);
      vec3 wetColor = base.rgb;
      vec2 headDelta=wetWorld.xz-headPose.xz;float ahead=dot(headDelta,headDirection);
      float lateral=abs(headDelta.x*headDirection.y-headDelta.y*headDirection.x);
      float beam=(1.-smoothstep(1.,2.+max(0.,ahead)*.14,lateral))*step(2.2,ahead)*exp(-max(0.,ahead)*.038)*headOn;
      wetColor+=vec3(.21,.27,.34)*beam*(.45+.55*rough);
      for(int i=0;i<4;i++){
        float radius=length(wetWorld.xz-patrolPositions[i].xz);
        wetColor+=patrolColors[i]*exp(-radius*.23)*(.20+fresnel*.45);
      }
      // A reflection glaze blends over lit asphalt. It neither replaces the texture nor exposes a hard rectangle.
      float edgeFade=1.-smoothstep(14.5,16.5,abs(wetWorld.x));
      float distanceFade=exp(-pow(length(cameraPosition-wetWorld)*.0027,2.));
      float wetAlpha=edgeFade*distanceFade*reflectionCoverage*(.035+fresnel*.24+wetState.y*.32)*wetState.x*(1.-rough*.35);

    `).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4(wetColor,wetAlpha)');
    this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.set(0, .001, -650); this.scene.add(this.reflector);
    this.scene.add(this.backdrop.group,this.cityLighting.group,this.aerialTraffic.group);
    this.scene.add(this.player.group, this.powerupVisuals.group);
    this.scene.add(this.distantFleet.group, this.trafficLighting.group);
    this.ready = Promise.all([this.player.ready, preloadFleet(), this.distantFleet.ready, environmentReady, this.surfaces.ready]).then(async () => {
      if (!this.player.assetReady) throw new Error('Player vehicle could not load');
      this.atmosphere.apply(this.scene);
      this.captureCityEnvironment();
      await this.prepareEffects();
      this.fleetReady = true;
    }).catch(error => { this.fleetFailed = true; throw error; });

    (this.player.mirror.material as THREE.MeshBasicMaterial).map = this.rearTarget.texture;
    (this.player.mirror.material as THREE.MeshBasicMaterial).color.set('#ffffff');
    for (const mirror of this.player.sideMirrors) { const m = mirror.material as THREE.MeshBasicMaterial; m.map = this.rearTarget.texture; m.color.set('#ffffff'); }

    for (const x of [-.65, .65]) {
      const head = new THREE.SpotLight('#cce6ff', 18, 90, .24, .7, 1.4);
      head.position.set(x, .7, -2); head.target.position.set(x, 0, -50); this.headlights.add(head, head.target);
    }
    this.scene.add(this.headlights);
    // Two bounded, unshadowed city-light fills keep the cyan car readable at night.
    const cyanRim = new THREE.PointLight('#22bbff', 100, 22, 2), pinkRim = new THREE.PointLight('#ff28bb', 75, 20, 2);
    cyanRim.position.set(-5, 4, -3); pinkRim.position.set(5, 3, 2);
    this.carRim.add(cyanRim, pinkRim); this.scene.add(this.carRim);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainField.positions, 3).setUsage(THREE.DynamicDrawUsage));
    rg.setAttribute('rainOpacity', new THREE.BufferAttribute(this.rainField.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: `attribute float rainOpacity;varying float opacity;
        #include <fog_pars_vertex>
        void main(){opacity=rainOpacity;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `varying float opacity;
        #include <fog_pars_fragment>
        void main(){gl_FragColor=vec4(.65,.74,.82,opacity);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }));
    this.rain.frustumCulled = false; this.rain.userData.colorOnly=true; this.scene.add(this.rain, this.rainSplashes.mesh);
    const sprayGeometry = new THREE.BufferGeometry(); sprayGeometry.setAttribute('position', new THREE.BufferAttribute(this.sprayArray, 3).setUsage(THREE.DynamicDrawUsage));
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const sc = sprite.getContext('2d')!, gradient = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, '#c5d7e999'); gradient.addColorStop(1, '#c5d7e900'); sc.fillStyle = gradient; sc.fillRect(0, 0, 32, 32);
    this.spray = new THREE.Points(sprayGeometry, new THREE.PointsMaterial({ color: '#b9cbde', map: new THREE.CanvasTexture(sprite), size: .19, transparent: true, opacity: .13, depthWrite: false }));
    this.spray.frustumCulled = false; this.spray.userData.colorOnly=true; this.scene.add(this.spray);
    this.configure('high'); this.reset('SUNSET');
  }
  private brokenSigns=new Map<number,number>();
  breakSign(id:number):void { this.brokenSigns.set(id,0); }
  reset(seed: string): void {
    this.brokenSigns.clear(); this.spraySeeds.clear(); this.seed = seed; this.backdrop.reset(); this.cityLighting.reset(); this.crash.reset(); this.rainField.reset(); this.player.resetWeather();
    for(const car of this.cars.values()){this.scene.remove(car.group);car.dispose();}this.cars.clear();this.distantFleet.begin();this.distantFleet.end();
    for (const g of this.chunks.values()) this.removeChunk(g);
    this.chunks.clear(); this.streamedChunk = this.streamedOrigin = NaN; this.stream(0);
  }
  /** Bake the actual surrounding towers/signs once while loading, rather than adding per-window render passes. */
  private captureCityEnvironment():void {
    const target=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});
    const camera=new THREE.CubeCamera(.5,650,target);camera.position.set(4,18,-80);
    const hidden=[this.reflector,this.player.group,this.powerupVisuals.group,this.rain,this.spray,this.rainSplashes.mesh];
    const visible=hidden.map(o=>o.visible),shadow=this.sunLighting.light.castShadow;
    const previous=this.renderer.getRenderTarget();
    try {
      hidden.forEach(o=>o.visible=false);this.sunLighting.light.castShadow=false;
      camera.update(this.renderer,this.scene);
      const generator=new THREE.PMREMGenerator(this.renderer),environment=generator.fromCubemap(target.texture);
      this.scene.environment?.dispose();this.scene.environment=environment.texture;this.scene.environmentIntensity=.55;generator.dispose();
    } finally {
      hidden.forEach((o,i)=>o.visible=visible[i]);this.sunLighting.light.castShadow=shadow;
      this.renderer.setRenderTarget(previous);target.dispose();
    }
  }
  private async prepareEffects(): Promise<void> {
    const camera = new THREE.PerspectiveCamera(60, 1, .1, 500);
    camera.position.set(0, 3, 9); camera.lookAt(0, .8, 0);
    // Cover screen/post-processing and shadow/no-shadow presets before the first crash.
    const target = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType });
    const previous = this.renderer.getRenderTarget(), castShadow = this.sunLighting.light.castShadow;
    const compile = (linear: boolean, shadowed: boolean) => {
      try {
        this.renderer.setRenderTarget(linear ? target : null); this.sunLighting.light.castShadow = shadowed;
        return this.renderer.compileAsync(this.scene, camera);
      } finally {
        // Shader compilation is asynchronous; restore the menu's state before yielding.
        this.renderer.setRenderTarget(previous); this.sunLighting.light.castShadow = castShadow;
      }
    };
    try {
      for (const shadowed of [castShadow, !castShadow]) { await compile(false,shadowed); await compile(true,shadowed); }
    } catch (error) { target.dispose(); throw error; }
    const reflection = this.reflector.visible, shadows = this.renderer.shadowMap.autoUpdate;
    try {
      this.reflector.visible = false; this.renderer.shadowMap.autoUpdate = false; this.renderer.setRenderTarget(target);
      this.crash.warmup(() => this.renderer.render(this.scene, camera));
    } finally {
      this.renderer.setRenderTarget(previous); this.reflector.visible = reflection; this.renderer.shadowMap.autoUpdate = shadows; target.dispose();
    }
    this.effectsReady = true;
  }
  configure(quality: Quality): void {
    this.quality = quality;
    this.renderer.setPixelRatio(qualityPixelRatio(quality, window.devicePixelRatio));
    this.rain.geometry.setDrawRange(0, { low: 900, medium: 1800, high: 3000, ultra: 3600 }[quality]);
    this.reflector.visible = quality !== 'low';
    const reflectionSize=quality==='high'||quality==='ultra'?1024:512;
    this.reflector.getRenderTarget().setSize(reflectionSize,reflectionSize);
    this.rearTarget.setSize(quality === 'high' || quality === 'ultra' ? 512 : 256, quality === 'high' || quality === 'ultra' ? 192 : 96);
    this.pixelRatio = this.renderer.getPixelRatio();
    this.sunLighting.configure(quality);
    this.post?.configure(quality, this.renderWidth, this.renderHeight, this.pixelRatio);
  }
  resize(w: number, h: number): void { this.renderWidth = w; this.renderHeight = h; this.renderer.setSize(w, h); this.post?.configure(this.quality, w, h, this.pixelRatio); }
  stream(s: number): void {
    this.origin = originFor(s);
    this.reflector.position.z=sceneZ(s,this.origin)-650;
    const current = Math.floor(s / 120);
    if (current === this.streamedChunk && this.origin === this.streamedOrigin) return;
    this.streamedChunk = current; this.streamedOrigin = this.origin;
    this.backdrop.update(this.seed, s, this.origin);
    this.atmosphere.update(this.origin);
    for (let id = current - CITY_STREAM_BEHIND; id <= current + CITY_STREAM_AHEAD; id++) {
      if (!this.chunks.has(id)) { const group = this.createChunk(id); this.chunks.set(id, group); this.scene.add(group); }
    }
    for (const [id, group] of this.chunks) {
      if (id < current - CITY_STREAM_BEHIND || id > current + CITY_STREAM_AHEAD) { this.removeChunk(group); this.chunks.delete(id); }
      else {
        group.position.z = sceneZ(id * 120, this.origin);
        group.visible=Math.abs(id*120+60-s)-60<=CITY_MIST_END+24;
        for(const child of group.children)if(child.userData.detailTier)this.updateCatalogDetail(child,group,s,0);
      }
    }
  }
  private updateCatalogDetail(child:THREE.Object3D,chunk:THREE.Group,s:number,x:number):void {
    const across=Math.min(Math.abs(-child.userData.distanceLeft-x),Math.abs(child.userData.distanceRight-x));
    const distance=Math.hypot(across,this.origin-chunk.position.z+60-s);
    child.visible=catalogDetailVisible(child.userData.detailTier,distance,child.visible);
  }
  private removeChunk(group: THREE.Group): void {
    this.scene.remove(group); group.traverse(o => { if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (o.userData.owned) { (o.material as THREE.MeshBasicMaterial).map?.dispose(); (o.material as THREE.Material).dispose(); }
    } });
  }
  private createChunk(id: number): THREE.Group {
    const group=buildCityChunk(cityChunk(this.seed,id),this.cityMaterials,this.asphalt);
    this.atmosphere.apply(group);return group;
  }
  update(dt: number, time: number, vehicle: Vehicle, pose: Pose, agents: Agent[], braking: boolean, reduced: boolean, alpha = 1, view:View='chase', powerups: PowerUp[] = [], effectDelta = dt): void {
    this.stream(vehicle.s); this.aerialTraffic.update(this.seed,pose.s,this.origin,time,reduced); this.cityLighting.update(this.seed,pose.s,this.origin,dt,this.quality); this.crash.update(effectDelta,this.origin,reduced);
    for(const [id,age] of this.brokenSigns)this.brokenSigns.set(id,Math.min(2,age+dt));
    for(const [id,chunk]of this.chunks)chunk.visible=Math.abs(id*120+60-pose.s)-60<=CITY_MIST_END+24;
    this.powerupVisuals.update(powerups, vehicle, this.origin, reduced);
    for (const chunk of this.chunks.values()) for (const child of chunk.children) {
      if(child.name==='breakable-sign'){const age=this.brokenSigns.get(child.userData.signId);if(age!==undefined){child.rotation.x=Math.min(1.45,age*3);child.position.y=8.1-Math.min(6.8,age*age*7);}continue;}
      if(child.userData.detailTier) {
        this.updateCatalogDetail(child,chunk,pose.s,pose.x);
        continue;
      }
      if (child.name !== 'median-gate' && child.name !== 'median-signal') continue;
      const gate = medianGate(child.userData.s, vehicle.simulationTime, vehicle.medianHeld);
      if (child.name === 'median-gate') child.position.y = -1.2 * gate.lift;
      else (child as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.color.set(
        gate.lift < .99 ? '#ff5668' : gate.warning ? '#ffc25f' : '#62f7cc');
    }
    this.player.group.position.set(pose.x, pose.height??0, sceneZ(pose.s, this.origin)); this.player.group.rotation.y = -pose.yaw;
    this.player.group.visible = !vehicle.exploded;
    if (!vehicle.exploded) { this.player.updatePlayer(vehicle,view==='cockpit'); this.player.animate(dt, time, vehicle.speed, -vehicle.steering, braking, reduced, rainSheltered(vehicle.x, vehicle.s)); }
    this.carRim.position.copy(this.player.group.position);
    this.headlights.position.copy(this.player.group.position); this.headlights.rotation.y = -pose.yaw; this.headlights.visible = vehicle.headlights && !vehicle.exploded;
    this.player.head.color.set(vehicle.headlights ? '#e0f1ff' : '#444954');
    const wetUniforms=(this.reflector.material as THREE.ShaderMaterial).uniforms;
    wetUniforms.roadOrigin.value=this.origin;wetUniforms.headPose.value.copy(this.player.group.position);wetUniforms.headDirection.value.set(Math.sin(pose.yaw),-Math.cos(pose.yaw));wetUniforms.headOn.value=vehicle.headlights&&!vehicle.exploded?1:0;
    this.sunLighting.update(pose.x,pose.s,this.origin);
    const live = new Set(agents.map(a => a.id));
    for(const id of this.spraySeeds.keys())if(id!==-1&&!live.has(id))this.spraySeeds.delete(id);
    for (const [id, car] of this.cars) if (!live.has(id)) { this.scene.remove(car.group); car.dispose(); this.cars.delete(id); }
    this.distantFleet.begin();
    for (const a of agents) {
      const distance = Math.abs(a.s - vehicle.s);
      if (distance > (this.quality === 'low' ? 180 : 260)) {
        const existing = this.cars.get(a.id); if (existing) existing.group.visible = false;
        if (distance < 1150) this.distantFleet.place(fleetKind(a.kind), a.x, sceneZ(a.s, this.origin), a.yaw,a.model);
        continue;
      }
      let car = this.cars.get(a.id);
      if (!car) {
        const spec=CYBER_VEHICLES[cyberModel(fleetKind(a.kind),a.model)];
        car=new CarVisual(spec.colors[a.id%spec.colors.length],false,a.kind,a.model);
        car.onVisualReady=group=>this.atmosphere.apply(group);
        this.atmosphere.apply(car.group);this.cars.set(a.id, car); this.scene.add(car.group);
      }
      // Hysteresis avoids rebuilding a rig repeatedly at the LOD boundary.
      car.setDetail(car.detailLevel === 0 ? distance > 110 ? 1 : 0 : distance < 80 ? 0 : 1);
      car.group.position.set(a.oldX + (a.x - a.oldX) * alpha, 0, sceneZ(a.oldS + (a.s - a.oldS) * alpha, this.origin));
      car.group.rotation.y = -a.yaw;
      car.setPolice(a.active); car.updateAgent(a);
      car.animate(dt, time, a.speed, -(a.steering ?? a.direction * Math.atan(a.lateral / Math.max(4, a.speed)) * .6), a.braking ?? a.speed < a.desired - 4, reduced);
      car.group.visible = true;
    }
    this.distantFleet.end();
    this.trafficLighting.update(agents, vehicle.s, this.origin, time, this.quality, dt, alpha);
    let sprayCount = 0;
    const emitSpray = (x: number, s: number, speed: number, yaw: number, direction: number, id: number,width=2,length=4.55) => {
      if (speed < 9 || Math.abs(s - vehicle.s) > 100 || reduced) return;
      const sin = Math.sin(yaw), cos = Math.cos(yaw), strength = Math.min(1, (speed - 9) / 30);
      const disturbance=id===-1?1+Math.min(.5,Math.abs(vehicle.steering)*.8+(braking?.2:0)):1;
      const count=Math.ceil((this.quality==='low'?12:this.quality==='medium'?24:48)*strength*disturbance);
      let seeds=this.spraySeeds.get(id);
      if(!seeds){seeds=new Float64Array(72);for(let i=0;i<seeds.length;i++){const seed=Math.sin(i*127.1+id*31)*43758.5453;seeds[i]=seed-Math.floor(seed);}this.spraySeeds.set(id,seeds);}
      const worldZ=sceneZ(s,this.origin);
      for (let i = 0; i < count && sprayCount < 2300; i++) {
        const random=seeds[i];
        const age = ((time * 2 + random) % 1) * .42, side = i % 2 ? 1 : -1;
        const across = side * (width/2-.18 + age * (.3 + random * .8)*disturbance);
        const behind = direction * (length*.3 + speed * age * age * .7);
        const height = Math.max(.025, .08 + (1.3 + strength * .8) * age - 4.9 * age * age);
        const index=sprayCount++*3;
        this.sprayArray[index]=x+across*cos-behind*sin;this.sprayArray[index+1]=height;
        this.sprayArray[index+2]=worldZ+across*sin+behind*cos;
      }
    };
    if (!vehicle.airborne) emitSpray(pose.x, pose.s, Math.abs(vehicle.speed), pose.yaw, Math.sign(vehicle.speed) || 1, -1);
    for (const a of agents) emitSpray(a.oldX + (a.x-a.oldX)*alpha, a.oldS + (a.s-a.oldS)*alpha, a.speed, a.yaw, 1, a.id,a.width,a.length);
    this.spray.geometry.setDrawRange(0, sprayCount);
    if(sprayCount){const positions=this.spray.geometry.getAttribute('position') as THREE.BufferAttribute;
      positions.clearUpdateRanges();positions.addUpdateRange(0,sprayCount*3);positions.needsUpdate=true;}
    this.rainSplashes.update(time, vehicle.s, this.origin, reduced);
    this.rain.position.copy(this.player.group.position);
    this.rainField.update(dt, pose.x, pose.s, pose.yaw, reduced, this.rain.geometry.drawRange.count / 2);
    // Upload only active vertices; lower presets do not change the unused tail.
    const rainVertices=this.rain.geometry.drawRange.count;
    const rainPositions=this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const rainOpacity=this.rain.geometry.getAttribute('rainOpacity') as THREE.BufferAttribute;
    rainPositions.clearUpdateRanges();rainPositions.addUpdateRange(0,rainVertices*3);rainPositions.needsUpdate=true;
    rainOpacity.clearUpdateRanges();rainOpacity.addUpdateRange(0,rainVertices);rainOpacity.needsUpdate=true;
  }

  render(camera: THREE.PerspectiveCamera, _dt: number, mirror: boolean): void {
    if (mirror) {
      this.mirrorFrames++;
      const direction = this.mirrorDirection.set(0, 0, 1).applyQuaternion(this.player.group.quaternion);
      this.rearCamera.position.copy(this.player.group.position).addScaledVector(direction, 2.4); this.rearCamera.position.y = this.player.group.position.y + 1.35;
      this.rearCamera.lookAt(this.mirrorFocus.copy(this.rearCamera.position).addScaledVector(direction, 90));
      const reflective = this.reflector.visible, playerVisible = this.player.group.visible;
      this.reflector.visible = false; this.player.group.visible = false;
      const target = this.renderer.getRenderTarget(), shadows = this.renderer.shadowMap.autoUpdate;
      this.renderer.shadowMap.autoUpdate = false;
      try { this.renderer.setRenderTarget(this.rearTarget); this.renderer.render(this.scene, this.rearCamera); }
      finally { this.renderer.setRenderTarget(target); this.renderer.shadowMap.autoUpdate = shadows; this.player.group.visible = playerVisible; this.reflector.visible = reflective; }
    }
    if (!this.post) { this.post = new Presentation(this.renderer, this.scene, camera); this.post.configure(this.quality, this.renderWidth, this.renderHeight, this.pixelRatio); }
    if (this.quality === 'low') this.renderer.render(this.scene, camera); else this.post.render();
    this.aerialTraffic.inspectView(camera,this.origin);this.atmosphere.inspectView(camera);
  }
  /** QA-only static camera probe: compare the same view before/after streaming and origin boundaries. */
  previewCity(camera:THREE.PerspectiveCamera,distance:number,rear:boolean,windowDistance=distance,probe?:{occluder?:number;sun?:boolean}) {
    this.stream(windowDistance);
    const position=camera.position.clone(),rotation=camera.quaternion.clone(),fov=camera.fov,near=camera.near;
    const hidden=[this.player.group,this.powerupVisuals.group,this.aerialTraffic.group,this.distantFleet.group,this.rain,this.spray,this.rainSplashes.mesh,this.headlights,this.carRim,this.cityLighting.group,this.trafficLighting.group,...[...this.cars.values()].map(c=>c.group)];
    let occluder:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>|undefined;
    const visible=hidden.map(o=>o.visible),wet=(this.reflector.material as THREE.ShaderMaterial).uniforms,head=wet.headOn.value;
    try {
      hidden.forEach(o=>o.visible=false);wet.headOn.value=0;wet.roadOrigin.value=this.origin;
      const z=sceneZ(distance,this.origin);
      camera.position.set(6.5,3.25,z+(rear?-7.5:7.5));camera.lookAt(6.5,1.05,z+(rear?20:-20));
      camera.fov=59;camera.near=.2;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      this.reflector.position.z=z-650;
      this.atmosphere.setSunsetEnabled(probe?.sun!==false);
      if(probe?.occluder) {
        const span=probe.occluder*.22;
        occluder=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({color:'#1d2530',roughness:1}));
        occluder.position.set(0,.12,-1).normalize().multiplyScalar(probe.occluder).add(camera.position);
        occluder.lookAt(camera.position);this.atmosphere.apply(occluder);this.scene.add(occluder);
      }
      this.sunLighting.update(6.5,distance,this.origin);this.render(camera,0,false);
      return {...this.diagnostics,sunsetScreen:sunsetScreenPosition(camera).toArray()};
    } finally {
      if(occluder){this.scene.remove(occluder);occluder.geometry.dispose();occluder.material.dispose();}
      this.atmosphere.setSunsetEnabled(true);
      hidden.forEach((o,i)=>o.visible=visible[i]);wet.headOn.value=head;
      camera.position.copy(position);camera.quaternion.copy(rotation);camera.fov=fov;camera.near=near;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    }
  }
  /** QA turntable uses the actual prefab, city, wet road and renderer, without changing simulation. */
  async previewFleet(camera:THREE.PerspectiveCamera,id:CyberModel,angle:number,lod:0|1|2=0) {
    const spec=CYBER_VEHICLES[id];if(!spec)throw new Error('Unknown vehicle');
    const rig=await buildFleetCar(id,spec.colors[0],lod),saved=camera.clone();
    const hidden=[this.player.group,this.distantFleet.group,this.rain,this.spray,this.rainSplashes.mesh,this.powerupVisuals.group,...[...this.cars.values()].map(c=>c.group)],visible=hidden.map(g=>g.visible);
    try {
      this.stream(0);hidden.forEach(g=>g.visible=false);
      rig.group.position.set(6.5,0,sceneZ(0,this.origin));this.atmosphere.apply(rig.group);this.scene.add(rig.group);
      animateFleetRig(rig,1/60,.14,20,.03,true,!!spec.emergency,-1);
      const radius=Math.max(5.7,spec.length*.91),y=spec.height*.52;
      camera.position.set(6.5+Math.sin(angle)*radius,y+radius*.25,sceneZ(0,this.origin)+Math.cos(angle)*radius);
      camera.lookAt(6.5,y,sceneZ(0,this.origin));camera.fov=48;camera.near=.1;camera.updateProjectionMatrix();
      this.sunLighting.update(6.5,0,this.origin);this.render(camera,0,false);
      return {id,name:spec.name,wheels:rig.wheels.length,lamps:Object.fromEntries(Object.entries(rig.lamps).map(([k,v])=>[k,v.length])),lod};
    } finally {
      disposeFleetRig(rig);hidden.forEach((g,i)=>g.visible=visible[i]);camera.copy(saved);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    }
  }
  /** Resource QA still uploads/draws real meshes and maps, but needs no full-screen pixels. */
  sampleResources(camera: THREE.PerspectiveCamera) {
    const area = this.renderer.getScissor(new THREE.Vector4()), enabled = this.renderer.getScissorTest();
    this.renderer.setScissor(0, 0, 1, 1); this.renderer.setScissorTest(true);
    try { this.render(camera, 0, false); return this.diagnostics; }
    finally { this.renderer.setScissor(area); this.renderer.setScissorTest(enabled); }
  }
  setCityNeon(enabled:boolean):void {
    for(const material of [this.cityMaterials.cyan,this.cityMaterials.pink,this.cityMaterials.violet]) {
      material.userData.neonLevel ??= material.emissiveIntensity;
      material.emissiveIntensity=enabled?material.userData.neonLevel:0;
    }
    this.cityMaterials.ad.visible=enabled;
  }
  impact(contact: Contact):void { this.crash.emit(contact); }
  explode(vehicle: Vehicle): void { this.crash.explode(vehicle.x, vehicle.s); }
  explodeTraffic(x:number,s:number):void { this.crash.explode(x,s); }
  get assetsLoaded(): boolean { return this.fleetReady && this.player.assetReady; }
  get diagnostics() { return { atmosphere:{...this.atmosphere.diagnostics,streamBehind:CITY_STREAM_BEHIND,streamAhead:CITY_STREAM_AHEAD},catalog:{available:BUILDING_CATALOG.length,activeAssets:[...new Set([...this.chunks.values()].flatMap(g=>g.userData.catalogIds as number[]))],nearGroups:[...this.chunks.values()].flatMap(g=>g.children).filter(g=>g.userData.detailTier==='near'&&g.visible).length,midGroups:[...this.chunks.values()].flatMap(g=>g.children).filter(g=>g.userData.detailTier==='mid'&&g.visible).length}, aerialTraffic:this.aerialTraffic.diagnostics, cityLighting:this.cityLighting.diagnostics, graphics: { quality:this.quality, mobile:this.mobile, ...this.post?.diagnostics, effectsReady: this.effectsReady, explosion: this.crash.diagnostics, programs: this.renderer.info.programs?.length ?? 0, mirrorFrames: this.mirrorFrames }, fleetReady: this.fleetReady, fleetFailed: this.fleetFailed, fleet: fleetDiagnostics(), distantVehicles: this.distantFleet.count, vehicleLighting: this.trafficLighting.diagnostics, trafficModels: [...this.cars.values()].map(car => ({ kind: car.kind, model:car.model, ready: car.assetReady, failed: car.assetFailed, lod: car.detailLevel })), ...this.backdrop.diagnostics, cityParcels: [...this.chunks.values()].reduce((n,g)=>n+(g.userData.parcels??0),0), terrainHalfWidth: 740, chunks: this.chunks.size, cars: this.cars.size, origin: this.origin, drawCalls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, resolution: this.pixelRatio, eye:this.player.eye.toArray(),bodyTilt:this.player.bodyTilt,boost:this.player.boostDiagnostics,roadReflection:{visible:this.reflector.visible,anchorZ:this.reflector.position.z,depthBias:(this.reflector.material as THREE.ShaderMaterial).polygonOffset,mipmaps:this.reflector.getRenderTarget().texture.generateMipmaps},mirrorBounds:new THREE.Box3().setFromObject(this.player.mirror).getSize(new THREE.Vector3()).toArray(),weather: this.player.weatherDiagnostics, sheltered: rainSheltered(this.player.group.position.x, this.origin - this.player.group.position.z), modelReady: this.player.assetReady, modelFailed: this.player.assetFailed, hdrReady: this.hdrReady }; }
}
