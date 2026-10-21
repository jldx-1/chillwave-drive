/** Local art review only; the game never imports this showroom. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
export async function reviewVehicle(path:string,rear=false) {
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c1bdb4');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
 const car=(await new GLTFLoader().loadAsync(path)).scene;scene.add(car);car.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=!(o.material as THREE.Material).transparent;o.receiveShadow=true;}});
 const bounds=new THREE.Box3().setFromObject(car),size=bounds.getSize(new THREE.Vector3()),target=new THREE.Vector3(0,size.y*.47,0),camera=new THREE.PerspectiveCamera(33,1280/800,.1,100);camera.position.set(-size.z*.84,size.y*.87+1,(rear?1:-1)*size.z*1.08);camera.lookAt(target);
 scene.add(new THREE.HemisphereLight('#e9f4ff','#44404b',1.6));const sun=new THREE.DirectionalLight('#fff4e7',3.5);sun.position.set(-3,8,-5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:30});sun.shadow.bias=-.0002;scene.add(sun);const rim=new THREE.DirectionalLight('#d7eeff',1.8);rim.position.set(4,5,4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#bbb7ad',roughness:.62}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
 try{const env=await new RGBELoader().loadAsync('/textures/venice-sunset.hdr');env.mapping=THREE.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.65;}catch{}
 renderer.render(scene,camera);await new Promise(r=>setTimeout(r,100));renderer.render(scene,camera);return{bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
