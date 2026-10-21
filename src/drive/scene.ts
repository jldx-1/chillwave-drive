import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Presentation } from './post';
import { roadTextures } from './materials';
import { CrashEffects } from './crashes';
import type { Contact } from './collisions';
import { cityChunk } from './world-layout';
import { buildCityChunk } from './city-chunk';
import { CityMaterials } from './world-materials';
import { CityBackdrop } from './skyline';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { sceneZ, originFor } from './road';
import { CarVisual } from './car';
import { FleetDistant, fleetDiagnostics, fleetKind, preloadFleet } from './fleet-asset';
import { VehicleLighting } from './vehicle-lighting';
import { StableSunShadow, colorPassReflection } from './stable-lighting';
import type { Agent } from './traffic';
import type { Pose, Vehicle } from './vehicle';
import type { Quality, View } from './config';
import { RainField, rainSheltered } from './weather';
import { RainSplashes } from './rain-splashes';
const mat = (color: string, roughness = .7, metalness = .1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export class DriveScene {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly player = new CarVisual('#00a8d6', true);
  readonly rearTarget = new THREE.WebGLRenderTarget(512, 192);
  readonly rearCamera = new THREE.PerspectiveCamera(65, 512 / 192, .1, 380);
  readonly sun = new THREE.Group();
  readonly rain: THREE.LineSegments;
  readonly headlights = new THREE.Group();
  origin = 0;
  private chunks = new Map<number, THREE.Group>();
  private cars = new Map<number, CarVisual>();
  private distantFleet = new FleetDistant();
  private trafficLighting = new VehicleLighting();
  readonly ready: Promise<void>;
  private fleetReady = false;
  private fleetFailed = false;
  private rainField = new RainField();
  private rainSplashes = new RainSplashes();
  private sprayArray = new Float32Array(2400 * 3);
  private spray: THREE.Points;
  private seed = 'SUNSET';
  private reflector: Reflector;
  private quality: Quality = 'high';
  private mirrorTime = 0;
  private post?: Presentation;
  private sunLighting = new StableSunShadow();
  private surfaces = roadTextures();
  private cityMaterials = new CityMaterials();
  private backdrop = new CityBackdrop();
  private renderWidth = 1280; private renderHeight = 800; private frameAverage = 16; private frameCounter = 0;
  private dynamicRatio = 1;
  private hdrReady = false;
  private crash = new CrashEffects(this.scene);
  private asphalt = mat('#32373a', .44, .08);
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#5b6179'); this.scene.fog = new THREE.FogExp2('#6d657c', .0027);
    const pmrem = new THREE.PMREMGenerator(this.renderer), environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, .04).texture; environment.dispose(); pmrem.dispose();
    this.scene.environmentIntensity = .6;
    this.scene.add(new THREE.HemisphereLight('#bec8ed', '#3f304b', 1.25));
    this.scene.add(this.sunLighting.light,this.sunLighting.target);
    this.asphalt.userData.castShadow=false;
    this.asphalt.map = this.surfaces.color; this.asphalt.normalMap = this.surfaces.normal; this.asphalt.roughnessMap = this.surfaces.rough; this.asphalt.normalScale.set(.32, .32);
    const environmentReady = new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}textures/venice-sunset.hdr`).then(hdr => {
      const generator = new THREE.PMREMGenerator(this.renderer), target = generator.fromEquirectangular(hdr);
      this.scene.environment?.dispose(); this.scene.environment = target.texture; this.scene.environmentIntensity = .8; this.hdrReady = true; hdr.dispose(); generator.dispose();
    }).catch(() => {});
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 dir;void main(){float h=normalize(dir).y;vec3 a=vec3(.78,.43,.44),b=vec3(.12,.18,.30);gl_FragColor=vec4(mix(a,b,smoothstep(-.08,.65,h)),1.);}',
    })); sky.name = 'sky'; this.scene.add(sky);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(83, 64), new THREE.MeshBasicMaterial({ color: '#ffcc96', fog: false }));
    disc.position.set(0, 95, -1500); this.sun.add(disc);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 uvp;void main(){float a=pow(max(0.,1.-length(uvp-.5)*2.),3.)*.4;gl_FragColor=vec4(1.,.43,.24,a);}',
    })); halo.position.set(0, 95, -1490); this.sun.add(halo); this.scene.add(this.sun);
    this.reflector = new Reflector(new THREE.PlaneGeometry(33, 2300), { color: 0x595162, textureWidth: 1024, textureHeight: 1024, clipBias: .003 });
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
    wet.fragmentShader = wet.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
      vec2 surfaceUV = vec2(wetWorld.x, roadOrigin-wetWorld.z)/8.;
      vec3 normalDetail = texture2D(roadNormal,surfaceUV).rgb*2.-1.;
      float rough = texture2D(roadRough,surfaceUV).r;
      vec2 uv = vUv.xy/vUv.w + normalDetail.xy*.0006;
      vec4 base = texture2D(tDiffuse,uv)*.4;
      base += texture2D(tDiffuse,uv+vec2(.0025,0.))*.15;
      base += texture2D(tDiffuse,uv-vec2(.0025,0.))*.15;
      base += texture2D(tDiffuse,uv+vec2(0.,.0025))*.15;
      base += texture2D(tDiffuse,uv-vec2(0.,.0025))*.15;
      float fresnel = pow(1.-abs(normalize(cameraPosition-wetWorld).y),4.);
      vec3 wetColor = base.rgb;
      vec2 headDelta=wetWorld.xz-headPose.xz;float ahead=dot(headDelta,headDirection);
      float lateral=abs(headDelta.x*headDirection.y-headDelta.y*headDirection.x);
      float beam=(1.-smoothstep(1.,2.+max(0.,ahead)*.14,lateral))*step(2.2,ahead)*exp(-max(0.,ahead)*.038)*headOn;
      wetColor+=vec3(.36,.43,.51)*beam*(.45+.55*rough);
      for(int i=0;i<4;i++){
        float radius=length(wetWorld.xz-patrolPositions[i].xz);
        wetColor+=patrolColors[i]*exp(-radius*.23)*(.20+fresnel*.45);
      }
      // A reflection glaze blends over lit asphalt. It neither replaces the texture nor exposes a hard rectangle.
      float edgeFade=1.-smoothstep(14.5,16.5,abs(wetWorld.x));
      float distanceFade=exp(-pow(length(cameraPosition-wetWorld)*.0027,2.));
      float wetAlpha=edgeFade*distanceFade*(.08+fresnel*.36)*(1.-rough*.5);

    `).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4(wetColor,wetAlpha)');
    this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.set(0, .001, -650); this.scene.add(this.reflector);
    this.scene.add(this.backdrop.group);
    this.scene.add(this.player.group);
    this.scene.add(this.distantFleet.group, this.trafficLighting.group);
    this.ready = Promise.all([this.player.ready, preloadFleet(), this.distantFleet.ready, environmentReady, this.surfaces.ready]).then(() => {
      if (!this.player.assetReady) throw new Error('Player vehicle could not load');
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
    this.rain.frustumCulled = false; this.scene.add(this.rain, this.rainSplashes.mesh);
    const sprayGeometry = new THREE.BufferGeometry(); sprayGeometry.setAttribute('position', new THREE.BufferAttribute(this.sprayArray, 3));
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const sc = sprite.getContext('2d')!, gradient = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, '#c5d7e999'); gradient.addColorStop(1, '#c5d7e900'); sc.fillStyle = gradient; sc.fillRect(0, 0, 32, 32);
    this.spray = new THREE.Points(sprayGeometry, new THREE.PointsMaterial({ color: '#b9cbde', map: new THREE.CanvasTexture(sprite), size: .19, transparent: true, opacity: .13, depthWrite: false }));
    this.spray.frustumCulled = false; this.scene.add(this.spray);
    this.configure('high'); this.reset('SUNSET');
  }
  reset(seed: string): void {
    this.seed = seed; this.backdrop.reset(); this.crash.reset(); this.rainField.reset(); this.player.resetWeather();
    for(const car of this.cars.values()){this.scene.remove(car.group);car.dispose();}this.cars.clear();this.distantFleet.begin();this.distantFleet.end();
    for (const g of this.chunks.values()) this.removeChunk(g);
    this.chunks.clear(); this.stream(0);
  }
  configure(quality: Quality): void {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, { low: 1, medium: 1.25, high: 1.5, ultra: 2 }[quality]));
    this.rain.geometry.setDrawRange(0, { low: 900, medium: 1800, high: 3000, ultra: 3600 }[quality]);
    this.reflector.visible = quality !== 'low';
    const reflectionSize=quality==='high'||quality==='ultra'?1024:512;
    this.reflector.getRenderTarget().setSize(reflectionSize,reflectionSize);
    this.dynamicRatio = this.renderer.getPixelRatio();
    this.sunLighting.configure(quality);
    this.post?.configure(quality, this.renderWidth, this.renderHeight, this.dynamicRatio);
  }
  resize(w: number, h: number): void { this.renderWidth = w; this.renderHeight = h; this.renderer.setSize(w, h); this.post?.configure(this.quality, w, h, this.dynamicRatio); }
  stream(s: number): void {
    this.origin = originFor(s); this.backdrop.update(this.seed, s, this.origin);
    const current = Math.floor(s / 120);
    for (let id = current - 3; id <= current + 10; id++) {
      if (!this.chunks.has(id)) { const group = this.createChunk(id); this.chunks.set(id, group); this.scene.add(group); }
    }
    for (const [id, group] of this.chunks) {
      if (id < current - 3 || id > current + 10) { this.removeChunk(group); this.chunks.delete(id); }
      else group.position.z = sceneZ(id * 120, this.origin);
    }
  }
  private removeChunk(group: THREE.Group): void {
    this.scene.remove(group); group.traverse(o => { if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (o.userData.owned) { (o.material as THREE.MeshBasicMaterial).map?.dispose(); (o.material as THREE.Material).dispose(); }
    } });
  }
  private createChunk(id: number): THREE.Group {
    return buildCityChunk(cityChunk(this.seed, id), this.cityMaterials, this.asphalt);
  }
  update(dt: number, time: number, vehicle: Vehicle, pose: Pose, agents: Agent[], braking: boolean, reduced: boolean, alpha = 1, view:View='chase'): void {
    this.stream(vehicle.s); this.crash.update(dt,this.origin,reduced);
    this.player.group.position.set(pose.x, 0, sceneZ(pose.s, this.origin)); this.player.group.rotation.y = -pose.yaw;
    this.player.updatePlayer(vehicle,view==='cockpit'); this.player.animate(dt, time, vehicle.speed, -vehicle.steering, braking, reduced, rainSheltered(vehicle.x, vehicle.s));
    this.headlights.position.copy(this.player.group.position); this.headlights.rotation.y = -pose.yaw; this.headlights.visible = vehicle.headlights;
    this.player.head.color.set(vehicle.headlights ? '#e0f1ff' : '#444954');
    const wetUniforms=(this.reflector.material as THREE.ShaderMaterial).uniforms;
    wetUniforms.roadOrigin.value=this.origin;wetUniforms.headPose.value.copy(this.player.group.position);wetUniforms.headDirection.value.set(Math.sin(pose.yaw),-Math.cos(pose.yaw));wetUniforms.headOn.value=vehicle.headlights?1:0;
    this.sunLighting.update(pose.x,pose.s,this.origin);
    this.sun.position.set(0, 0, sceneZ(vehicle.s, this.origin));
    this.scene.getObjectByName('sky')!.position.copy(this.player.group.position);
    const live = new Set(agents.map(a => a.id));
    for (const [id, car] of this.cars) if (!live.has(id)) { this.scene.remove(car.group); car.dispose(); this.cars.delete(id); }
    this.distantFleet.begin();
    for (const a of agents) {
      const distance = Math.abs(a.s - vehicle.s);
      if (distance > (this.quality === 'low' ? 180 : 260)) {
        const existing = this.cars.get(a.id); if (existing) existing.group.visible = false;
        if (distance < 1150) this.distantFleet.place(fleetKind(a.kind), a.x, sceneZ(a.s, this.origin), a.yaw);
        continue;
      }
      let car = this.cars.get(a.id);
      if (!car) {
        const colors = ['#66757e', '#b1aaa0', '#3e454e', '#a39480', '#52717b', '#c7c5bd'];
        car = new CarVisual(a.kind === 'police' ? '#f1f2ef' : colors[a.id % colors.length], false, a.kind);
        this.cars.set(a.id, car); this.scene.add(car.group);
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
    const emitSpray = (x: number, s: number, speed: number, yaw: number, direction: number) => {
      if (speed < 9 || Math.abs(s - vehicle.s) > 100 || reduced) return;
      const sin = Math.sin(yaw), cos = Math.cos(yaw), strength = Math.min(1, (speed - 9) / 30);
      for (let i = 0; i < 48 && sprayCount < 2300; i++) {
        const seed = Math.sin(i * 127.1 + x * 31) * 43758.5453, random = seed - Math.floor(seed);
        const age = ((time * 2 + random) % 1) * .42, side = i % 2 ? 1 : -1;
        const across = side * (.77 + age * (.3 + random * .8));
        const behind = direction * (1.3 + speed * age * age * .7);
        const height = Math.max(.025, .08 + (1.3 + strength * .8) * age - 4.9 * age * age);
        this.sprayArray.set([x + across * cos - behind * sin, height,
          sceneZ(s, this.origin) + across * sin + behind * cos], sprayCount++ * 3);
      }
    };
    emitSpray(vehicle.x, vehicle.s, Math.abs(vehicle.speed), pose.yaw, Math.sign(vehicle.speed) || 1);
    for (const a of agents) emitSpray(a.x, a.s, a.speed, a.yaw, 1);
    this.spray.geometry.setDrawRange(0, sprayCount); this.spray.geometry.attributes.position.needsUpdate = true;
    this.rainSplashes.update(time, vehicle.s, this.origin, reduced);
    this.rain.position.copy(this.player.group.position);
    this.rainField.update(dt, pose.x, pose.s, pose.yaw, reduced);
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.geometry.attributes.rainOpacity.needsUpdate = true;
  }

  render(camera: THREE.PerspectiveCamera, dt: number, mirror: boolean): void {
    this.mirrorTime += dt;
    if (mirror && this.mirrorTime > .12) {
      this.mirrorTime = 0;
      this.rearCamera.position.copy(this.player.group.position).add(new THREE.Vector3(0, 1.35, 2.4));
      this.rearCamera.lookAt(this.rearCamera.position.clone().add(new THREE.Vector3(0, 0, 90)));
      const reflective = this.reflector.visible; this.reflector.visible = false; this.player.group.visible = false;
      this.renderer.setRenderTarget(this.rearTarget); this.renderer.render(this.scene, this.rearCamera); this.renderer.setRenderTarget(null);
      this.player.group.visible = true; this.reflector.visible = reflective;
    }
    if (!this.post) { this.post = new Presentation(this.renderer, this.scene, camera); this.post.configure(this.quality, this.renderWidth, this.renderHeight, this.dynamicRatio); }
    if (this.quality === 'low') this.renderer.render(this.scene, camera); else this.post.render();
    // Resolution adaptation uses sustained frame cadence; simulation remains fixed-step.
    if (dt > 0 && dt < .5) this.frameAverage += (dt * 1000 - this.frameAverage) * .025;
    if (++this.frameCounter % 240 === 0 && this.frameAverage > 26 && this.dynamicRatio > .75) {
      this.dynamicRatio = Math.max(.75, this.dynamicRatio - .1); this.renderer.setPixelRatio(this.dynamicRatio);
      this.post.configure(this.quality, this.renderWidth, this.renderHeight, this.dynamicRatio);
    }
  }
  /** Resource QA still uploads/draws real meshes and maps, but needs no full-screen pixels. */
  sampleResources(camera: THREE.PerspectiveCamera) {
    const area = this.renderer.getScissor(new THREE.Vector4()), enabled = this.renderer.getScissorTest();
    this.renderer.setScissor(0, 0, 1, 1); this.renderer.setScissorTest(true);
    try { this.render(camera, 0, false); return this.diagnostics; }
    finally { this.renderer.setScissor(area); this.renderer.setScissorTest(enabled); }
  }
  impact(contact: Contact):void { this.crash.emit(contact); }
  get assetsLoaded(): boolean { return this.fleetReady && this.player.assetReady; }
  get diagnostics() { return { fleetReady: this.fleetReady, fleetFailed: this.fleetFailed, fleet: fleetDiagnostics(), distantVehicles: this.distantFleet.count, vehicleLighting: this.trafficLighting.diagnostics, trafficModels: [...this.cars.values()].map(car => ({ kind: car.kind, ready: car.assetReady, failed: car.assetFailed, lod: car.detailLevel })), ...this.backdrop.diagnostics, cityParcels: [...this.chunks.values()].reduce((n,g)=>n+(g.userData.parcels??0),0), terrainHalfWidth: 740, chunks: this.chunks.size, cars: this.cars.size, origin: this.origin, drawCalls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, resolution: this.dynamicRatio, eye:this.player.eye.toArray(),bodyTilt:this.player.bodyTilt,boost:this.player.boostDiagnostics,roadReflection:{visible:this.reflector.visible,anchorZ:this.reflector.position.z,depthBias:(this.reflector.material as THREE.ShaderMaterial).polygonOffset,mipmaps:this.reflector.getRenderTarget().texture.generateMipmaps},mirrorBounds:new THREE.Box3().setFromObject(this.player.mirror).getSize(new THREE.Vector3()).toArray(),weather: this.player.weatherDiagnostics, sheltered: rainSheltered(this.player.group.position.x, this.origin - this.player.group.position.z), modelReady: this.player.assetReady, modelFailed: this.player.assetFailed, hdrReady: this.hdrReady }; }
}
