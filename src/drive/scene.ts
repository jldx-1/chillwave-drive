import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Presentation } from './post';
import { facadeMaterial, roadTextures } from './materials';
import { CrashEffects } from './crashes';
import type { Contact } from './collisions';
import { buildingSpec } from './buildings';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Random, hashSeed } from '../core/random';
import { road, sceneZ, originFor, roadsideObstacles } from './road';
import { CarVisual } from './car';
import type { Agent } from './traffic';
import type { Pose, Vehicle } from './vehicle';
import type { Quality } from './config';
import { RainField, rainSheltered } from './weather';
import { RainSplashes } from './rain-splashes';
class Batch {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): void {
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.facade) {
      const uv = g.attributes.uv, normals = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) { uv.setX(i, uv.getX(i) * (Math.abs(normals.getX(i)) > .5 ? d : w) / 8); uv.setY(i, uv.getY(i) * h / 16); }
    }
    g.translate(x, y, z);
    if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat)!.push(g);
  }
  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [material, parts] of this.parts) {
      const merged = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, material); mesh.receiveShadow = true; mesh.castShadow = !(material instanceof THREE.MeshBasicMaterial); group.add(mesh);
    }
    return group;
  }
}
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
  private distantCars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', .3, .4), 100);
  private distantLights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 100);
  private instance = new THREE.Object3D();
  private rainField = new RainField();
  private rainSplashes = new RainSplashes();
  private sprayArray = new Float32Array(2400 * 3);
  private spray: THREE.Points;
  private seed = 'SUNSET';
  private reflector: Reflector;
  private quality: Quality = 'high';
  private mirrorTime = 0;
  private post?: Presentation;
  private sunLight = new THREE.DirectionalLight('#ffcfaa', 3);
  private surfaces = roadTextures();
  private facades = [facadeMaterial(34, '#55585a'), facadeMaterial(19, '#3e4d56'), facadeMaterial(76, '#77716b')];
  private shadowTarget = new THREE.Object3D();
  private renderWidth = 1280; private renderHeight = 800; private frameAverage = 16; private frameCounter = 0;
  private dynamicRatio = 1;
  private hdrReady = false;
  private crash = new CrashEffects(this.scene);
  private shadowRoad = new THREE.Mesh(new THREE.PlaneGeometry(33,2300),new THREE.ShadowMaterial({opacity:.4}));
  private horizon = new THREE.Group();
  private asphalt = mat('#252632', .19, .4);
  private concrete = mat('#535665');
  private dark = mat('#212635', .43, .45);
  private white = mat('#e1d7bb');
  private glass = mat('#263b50', .2, .7);
  private glow = new THREE.MeshBasicMaterial({ color: '#82c7d6' });
  private amber = new THREE.MeshBasicMaterial({ color: '#ffc28e' });
  private neon = new THREE.MeshBasicMaterial({ color: '#dd8eaf' });
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#5b6179'); this.scene.fog = new THREE.FogExp2('#6d657c', .0027);
    const pmrem = new THREE.PMREMGenerator(this.renderer), environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, .04).texture; environment.dispose(); pmrem.dispose();
    this.scene.environmentIntensity = .6;
    this.scene.add(new THREE.HemisphereLight('#bec8ed', '#3f304b', 1.25));
    this.sunLight.position.set(-35, 65, -80); this.sunLight.castShadow = true;
    Object.assign(this.sunLight.shadow.camera, { left: -50, right: 50, top: 60, bottom: -60, near: 1, far: 250 });
    this.sunLight.shadow.normalBias = .025; this.sunLight.shadow.bias = -.0002;
    this.sunLight.target = this.shadowTarget; this.scene.add(this.sunLight, this.shadowTarget);
    this.asphalt.map = this.surfaces.color; this.asphalt.normalMap = this.surfaces.normal; this.asphalt.roughnessMap = this.surfaces.rough; this.asphalt.normalScale.set(.32, .32);
    void new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}textures/venice-sunset.hdr`).then(hdr => {
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
    this.reflector = new Reflector(new THREE.PlaneGeometry(33, 2300), { color: 0x595162, textureWidth: 512, textureHeight: 512, clipBias: .003 });
    const wet = this.reflector.material as THREE.ShaderMaterial;
    Object.assign(wet.uniforms, { roadColor: { value: this.surfaces.color }, roadNormal: { value: this.surfaces.normal }, roadRough: { value: this.surfaces.rough }, roadOffset: { value: 0 }, headPose: { value: new THREE.Vector3() }, headDirection: { value: new THREE.Vector2(0,-1) }, headOn:{ value:1 }, wetFog:{ value:new THREE.Color('#6d657c') } });
    wet.vertexShader = wet.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 roadUV; varying vec3 wetWorld;').replace('vUv = textureMatrix', 'roadUV = position.xy; wetWorld = (modelMatrix * vec4(position,1.)).xyz; vUv = textureMatrix');
    wet.fragmentShader = wet.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec2 roadUV; varying vec3 wetWorld; uniform sampler2D roadColor; uniform sampler2D roadNormal; uniform sampler2D roadRough; uniform float roadOffset; uniform vec3 headPose; uniform vec2 headDirection; uniform float headOn; uniform vec3 wetFog;');
    wet.fragmentShader = wet.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
      vec2 surfaceUV = vec2(roadUV.x, roadUV.y+roadOffset)/4.;
      vec3 normalDetail = texture2D(roadNormal,surfaceUV).rgb*2.-1.;
      float rough = texture2D(roadRough,surfaceUV).r;
      vec2 uv = vUv.xy/vUv.w + normalDetail.xy*.0015;
      vec4 base = texture2D(tDiffuse,uv)*.4;
      base += texture2D(tDiffuse,uv+vec2(.0015,0.))*.15;
      base += texture2D(tDiffuse,uv-vec2(.0015,0.))*.15;
      base += texture2D(tDiffuse,uv+vec2(0.,.002))*.15;
      base += texture2D(tDiffuse,uv-vec2(0.,.002))*.15;
      float fresnel = pow(1.-abs(normalize(cameraPosition-wetWorld).y),4.);
      vec3 asphalt = texture2D(roadColor,surfaceUV).rgb;
      vec3 wetColor = asphalt*.28 + base.rgb*(.10+fresnel*.46)*(1.-rough*.5);
      vec2 headDelta=wetWorld.xz-headPose.xz;float ahead=dot(headDelta,headDirection);
      float lateral=abs(headDelta.x*headDirection.y-headDelta.y*headDirection.x);
      float beam=(1.-smoothstep(1.,2.+max(0.,ahead)*.14,lateral))*step(2.2,ahead)*exp(-max(0.,ahead)*.038)*headOn;
      wetColor+=vec3(.36,.43,.51)*beam*(.45+.55*rough);
      wetColor=mix(wetColor,wetFog,1.-exp(-pow(length(cameraPosition-wetWorld)*.0027,2.)));

    `).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', 'vec4(wetColor,1.0)');
    this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.set(0, -.025, -700); this.scene.add(this.reflector);
    // Asphalt roughness is represented by the dark reflection tint and surface streaks.
    this.shadowRoad.rotation.x=-Math.PI/2;this.shadowRoad.position.set(0,-.021,-700);this.shadowRoad.receiveShadow=true;this.scene.add(this.shadowRoad);
    const backdrop=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat('#4b5466'),160), skylineRandom=new Random(587);
    const transform=new THREE.Object3D();
    for(let i=0;i<160;i++){const side=i%2?1:-1,h=skylineRandom.range(90,310);transform.position.set(side*skylineRandom.range(70,700),h/2,skylineRandom.range(-4200,-1350));transform.scale.set(skylineRandom.range(20,55),h,skylineRandom.range(25,70));transform.updateMatrix();backdrop.setMatrixAt(i,transform.matrix);}
    this.horizon.add(backdrop);
    const endlessRoad=new THREE.Mesh(new THREE.PlaneGeometry(33,9000),this.asphalt);endlessRoad.rotation.x=-Math.PI/2;endlessRoad.position.set(0,-.08,-4500);this.horizon.add(endlessRoad);this.scene.add(this.horizon);
    this.scene.add(this.player.group);
    this.distantCars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.distantLights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.distantCars.frustumCulled = this.distantLights.frustumCulled = false;
    this.scene.add(this.distantCars, this.distantLights);

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
    this.seed = seed; this.crash.reset(); this.rainField.reset(); this.player.resetWeather();
    for(const car of this.cars.values()){this.scene.remove(car.group);car.dispose();}this.cars.clear();this.distantCars.count=this.distantLights.count=0;
    for (const g of this.chunks.values()) this.removeChunk(g);
    this.chunks.clear(); this.stream(0);
  }
  configure(quality: Quality): void {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, { low: 1, medium: 1.25, high: 1.5, ultra: 2 }[quality]));
    this.rain.geometry.setDrawRange(0, { low: 900, medium: 1800, high: 3000, ultra: 3600 }[quality]);
    this.reflector.visible = quality !== 'low';
    this.dynamicRatio = this.renderer.getPixelRatio();
    this.sunLight.castShadow = quality !== 'low'; this.sunLight.shadow.mapSize.setScalar(quality === 'ultra' ? 2048 : 1024);
    this.post?.configure(quality, this.renderWidth, this.renderHeight, this.dynamicRatio);
  }
  resize(w: number, h: number): void { this.renderWidth = w; this.renderHeight = h; this.renderer.setSize(w, h); this.post?.configure(this.quality, w, h, this.dynamicRatio); }
  stream(s: number): void {
    this.origin = originFor(s);
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
  private label(text: string): THREE.Mesh {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#133f46'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#c4ddd8'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = '#ecf2df'; ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 77);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture }); // owned by chunk
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), material); m.userData.owned = true; return m;
  }
  private createChunk(id: number): THREE.Group {
    const b = new Batch(), r = new Random(hashSeed(`${this.seed}:${id}`)), start = id * 120;
    b.box(this.asphalt, 0, -.12, -60, 33, .16, 120);
    b.box(this.concrete, 0, .44, -60, .7, .88, 120);
    b.box(this.amber, 0, .94, -60, .18, .025, 120);
    for (const side of [-1, 1]) {
      for (let dz = 0; dz < 120; dz += 6) {
        const branch = road.branchCenter(start + dz + 3);
        if (side === 1 && branch !== undefined && branch < 21) continue;
        b.box(this.concrete, side * 16.6, .28, -dz - 3, .35, .56, 6);
        b.box(this.dark, side * 16.7, .85, -dz - 3, .14, .18, 6);
      }
      b.box(this.amber, side * .65, .025, -60, .1, .02, 120);
      for (let s = 0; s < 120; s += 12) {
        for (const laneX of [4.7, 8.3, 11.9]) b.box(this.white, side * laneX, .025, -s - 2, .12, .025, 4);
        if (side === -1 || road.branchCenter(start + s) === undefined || road.branchCenter(start + s)! >= 21) b.box(this.dark, side * 16.7, .52, -s, .11, 1, .12);
      }
      for (let s = 12; s < 120; s += 36) {
        const branch=side===1?road.branchCenter(start+s):undefined;
        const lampX=side*(branch===undefined?17.3:Math.max(17.3,branch+4.4));
        b.box(this.dark, lampX, 5, -s, .15, 10, .15);
        b.box(this.dark, lampX-side*2, 10, -s, 4.2, .15, .17);
        b.box(this.amber, lampX-side*3.6, 9.9, -s, 1.2, .08, .35);
      }
      for (let j = 0; j < 3; j++) {
        const spec = buildingSpec(this.seed, id, j, side), { height: h, width: w, depth, style } = spec;
        const z = -j * 40 - 20, x = side * (road.routeAt(start + j * 40) && side === 1 ? 51 : 34), facade = this.facades[style % 3];
        b.box(this.concrete, x, 2, z, w + 2, 4, depth + 2);
        b.box(this.glass, x, 3.3, z, w - 1, 5.4, depth - 1);
        if (style === 0 || style === 3) {
          for (let tier = 0; tier < spec.tiers; tier++) {
            const floor = h * tier / spec.tiers + 5, th = h / spec.tiers;
            b.box(facade, x, floor + th / 2, z, w - tier * spec.setback, th, depth - tier * spec.setback * .7);
            b.box(this.concrete, x, floor, z, w - tier * spec.setback + .7, .45, depth - tier * spec.setback * .7 + .7);
          }
        } else {
          b.box(facade, x, h / 2 + 5, z, w, h, depth);
          for (let y = 9; y < h; y += style === 1 ? 4 : 12) b.box(this.concrete, x, y, z, w + .6, .25, depth + .6);
          if (style === 2) for (let dx = -w / 2 + 2; dx < w / 2; dx += 4) b.box(this.dark, x + dx, h / 2 + 5, z + depth / 2 + .2, .22, h, .35);
          if (style === 4) for (let y = 8; y < h * .6; y += 4) {
            b.box(this.concrete, x - side * (w / 2 + .5), y, z, 1.1, .2, depth * .75);
            b.box(this.dark, x - side * (w / 2 + 1), y + .65, z, .06, 1.1, depth * .75);
          }
        }
        b.box(this.dark, x, h + 5.5, z, w * .64, 1.2, depth * .65);
        for (let k = 0; k < 3; k++) b.box(this.concrete, x - w * .25 + k * w * .25, h + 6.4, z, 1.7, .7, 2.3);
        if (spec.antenna) { b.box(this.dark, x, h + 10, z, .16, 8, .16); b.box(this.glow, x, h + 14, z, .16, .1, .16); }
        for (const offset of [-w*.4, w*.4]) b.box(this.concrete, x+offset, 2.4, z, .6, 4.8, depth+1);
        if (style === 3) b.box(this.neon, x - side * (w / 2 + .08), 14, z, .1, 1.1, depth * .5);
        const farH = r.range(50, 180);
        b.box(this.facades[(style+1)%3], side * r.range(75, 130), farH / 2, z - 8, r.range(17, 30), farH, 25);
      }
    }
    // The service loop has explicit shared entry/exit coordinates in RoadGraph.
    for (let dz = 0; dz < 120; dz += 6) {
      const a = road.branchCenter(start + dz), next = road.branchCenter(start + dz + 6);
      if (a !== undefined) {
        const center = next === undefined ? a : (a + next) / 2;
        b.box(this.asphalt, center, -.09, -dz - 3, 7.2, .14, 6.05);
        b.box(this.amber, center + 3.3, .04, -dz - 3, .12, .05, 6.05);
        b.box(this.white, center, .025, -dz - 3, .09, .025, 2);
        // Main shoulder opens only through the actual fork / merge.
      }
    }
    for(const obstacle of roadsideObstacles(start+60).filter(o=>Math.floor(o.s/120)===id)){
      b.box(this.concrete,obstacle.x,.45,-(obstacle.s-start),obstacle.width,.9,obstacle.length);
      b.box(this.amber,obstacle.x,1.2,-(obstacle.s-start),obstacle.width,.7,.1);
      for(let k=-.5;k<.7;k+=.4)b.box(this.dark,obstacle.x+k,1.2,-(obstacle.s-start)+.07,.16,.6,.04);
    }
    const group = b.build();
    if (id % 3 === 1) {
      const sign = this.label(road.routeAt(start + 100) ? 'SERVICE LOOP   ↗' : 'SUNSET CITY   ↑   ↑');
      sign.position.set(8, 7.4, -95); group.add(sign);
      const overhead = new Batch(); overhead.box(this.dark, 17.2, 4, -95, .25, 8, .25); overhead.box(this.dark, 6, 8.6, -95, 23, .25, .25); group.add(overhead.build());
    }
    if (id % 9 === 6) {
      const bridge = new Batch(), service=!!road.routeAt(start+60); bridge.box(this.concrete, 0, 12.5, -60, service?84:70, 1.4, 13);
      for (const side of [-1, 1]) bridge.box(this.concrete, side*(service&&side===1?38:20), 6, -60, 1.3, 12, 5);
      bridge.box(this.dark, 0, 13.8, -60, 70, .4, 11); group.add(bridge.build());
    }
    return group;
  }
  update(dt: number, time: number, vehicle: Vehicle, pose: Pose, agents: Agent[], braking: boolean, reduced: boolean, alpha = 1): void {
    this.stream(vehicle.s); this.crash.update(dt,this.origin,reduced);
    this.player.group.position.set(pose.x, 0, sceneZ(pose.s, this.origin)); this.player.group.rotation.y = -pose.yaw;
    this.player.updatePlayer(vehicle); this.player.animate(dt, time, vehicle.speed, -vehicle.steering, braking, reduced, rainSheltered(vehicle.x, vehicle.s));
    this.headlights.position.copy(this.player.group.position); this.headlights.rotation.y = -pose.yaw; this.headlights.visible = vehicle.headlights;
    this.player.head.color.set(vehicle.headlights ? '#e0f1ff' : '#444954');
    this.reflector.position.z = sceneZ(vehicle.s + 650, this.origin);
    const wetUniforms=(this.reflector.material as THREE.ShaderMaterial).uniforms;
    wetUniforms.roadOffset.value=(vehicle.s+650)%4;wetUniforms.headPose.value.copy(this.player.group.position);wetUniforms.headDirection.value.set(Math.sin(pose.yaw),-Math.cos(pose.yaw));wetUniforms.headOn.value=vehicle.headlights?1:0;
    this.sunLight.position.set(pose.x-35, 65, sceneZ(pose.s+80, this.origin)); this.shadowTarget.position.set(pose.x, 0, sceneZ(pose.s, this.origin));
    this.shadowRoad.position.z=this.reflector.position.z;this.horizon.position.z=sceneZ(Math.floor(vehicle.s/120)*120,this.origin);
    this.sun.position.set(0, 0, sceneZ(vehicle.s, this.origin));
    this.scene.getObjectByName('sky')!.position.copy(this.player.group.position);
    const live = new Set(agents.map(a => a.id));
    for (const [id, car] of this.cars) if (!live.has(id)) { this.scene.remove(car.group); car.dispose(); this.cars.delete(id); }
    let distantCount = 0;
    for (const a of agents) {
      const distance = Math.abs(a.s - vehicle.s);
      if (distance > (this.quality === 'low' ? 140 : 200)) {
        const existing = this.cars.get(a.id); if (existing) existing.group.visible = false;
        if (distance < 1150 && distantCount < 100) {
          const height = a.kind === 'truck' ? 2.6 : a.kind === 'police' ? 1.8 : 1.2;
          this.instance.position.set(a.x, height / 2 + .05, sceneZ(a.s, this.origin));
          this.distantCars.setColorAt(distantCount, new THREE.Color(a.kind === 'police' ? '#e7e9e5' : '#4b5260'));
          this.instance.scale.set(a.width, height, a.length); this.instance.updateMatrix(); this.distantCars.setMatrixAt(distantCount, this.instance.matrix);
          this.instance.position.y = .7; this.instance.position.z += Math.sign(a.s - vehicle.s) * (a.length / 2 + .03);
          this.instance.scale.set(a.width * .72, .07, .05); this.instance.updateMatrix(); this.distantLights.setMatrixAt(distantCount, this.instance.matrix);
          this.distantLights.setColorAt(distantCount, new THREE.Color((a.s - vehicle.s) * a.direction < 0 ? '#dae8ff' : '#e44b4d')); distantCount++;
        }
        continue;
      }
      let car = this.cars.get(a.id);
      if (!car) {
        const colors = ['#4b5c70', '#9f9c97', '#353740', '#88775f', '#496267', '#b8b6b0'];
        car = new CarVisual(a.kind === 'police' ? '#f1f2ef' : colors[a.id % colors.length], false, a.kind);
        this.cars.set(a.id, car); this.scene.add(car.group);
      }
      car.group.position.set(a.oldX + (a.x - a.oldX) * alpha, 0, sceneZ(a.oldS + (a.s - a.oldS) * alpha, this.origin));
      car.group.rotation.y = -a.yaw;
      car.setPolice(a.active);
      car.animate(dt, time, a.speed, -a.direction*Math.atan(a.lateral/Math.max(4,a.speed))*.6, a.speed < a.desired - 4, reduced);
      car.group.visible = Math.abs(a.s - vehicle.s) < (this.quality === 'low' ? 650 : 1100);
    }
    this.distantCars.count = this.distantLights.count = distantCount;
    this.distantCars.instanceMatrix.needsUpdate = this.distantLights.instanceMatrix.needsUpdate = true;
    if (this.distantCars.instanceColor) this.distantCars.instanceColor.needsUpdate = true;
    if (this.distantLights.instanceColor) this.distantLights.instanceColor.needsUpdate = true;
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
  impact(contact: Contact):void { this.crash.emit(contact); }
  get diagnostics() { return { chunks: this.chunks.size, cars: this.cars.size, origin: this.origin, drawCalls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, resolution: this.dynamicRatio, eye:this.player.eye.toArray(),mirrorBounds:new THREE.Box3().setFromObject(this.player.mirror).getSize(new THREE.Vector3()).toArray(),weather: this.player.weatherDiagnostics, sheltered: rainSheltered(this.player.group.position.x, this.origin - this.player.group.position.z), modelReady: this.player.assetReady, modelFailed: this.player.assetFailed, hdrReady: this.hdrReady }; }
}
