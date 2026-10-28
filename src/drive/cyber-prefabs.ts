import * as THREE from 'three';
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CYBER_VEHICLES,type CyberModel,type CyberVehicleSpec } from './cyber-vehicles';
import { VEHICLE_LAMPS } from './lamp-levels';
import { referenceCoachwork,type VehicleSurface } from './reference-coachwork';

type Role=VehicleSurface;
const box=new THREE.BoxGeometry(1,1,1);
const sources=new Map<string,THREE.Group>(),library=new Map<string,THREE.MeshStandardMaterial>();
function material(role:Role,s:CyberVehicleSpec,side=''):THREE.MeshStandardMaterial {
  const key=role+':'+(role==='paint'||role==='brake'||role==='glass'&&s.id==='orbit'?s.id:role==='accent'?s.accent:'')+side;
  if(library.has(key))return library.get(key)!;
  const colors:Record<Role,string>={paint:s.colors[0],livery:'#d9e8f3',caliper:'#ce325a',rotor:'#35404c',trim:'#111924',carbon:'#202735',metal:'#7b8c9b',rubber:'#101215',glass:'#1a3546',lens:'#c1d7e3',head:'#d7f0ff',brake:s.id==='nebula'?'#fa389c':s.id==='vector'?'#fa408a':'#d31d38',turn:'#e59e35',reverse:'#b9c6d2',red:'#ef2344',blue:'#247bea',amber:'#c18935',accent:s.accent,interior:'#a5805e'};
  const settings={color:colors[role],roughness:role==='rubber'?.94:role==='trim'?.67:role==='carbon'?.55:role==='paint'?.28:.32,metalness:['paint','metal'].includes(role)?.72:.15};
  const m=role==='paint'?new THREE.MeshPhysicalMaterial({...settings,clearcoat:1,clearcoatRoughness:.16}):new THREE.MeshStandardMaterial(settings);
  m.name=`cyber-${role}-${side}`;m.userData={vehicleRole:role,vehicleSide:side,cyber:true};
  if(['head','brake','turn','reverse','red','blue','amber','accent','interior'].includes(role)) {
    m.emissive.set(colors[role]);m.emissiveIntensity=role==='head'?VEHICLE_LAMPS.head:role==='brake'?VEHICLE_LAMPS.tail:role==='accent'?.65:role==='amber'?.55:role==='interior'?.3:0;
  }
  // Smoked exterior glass stays opaque in traffic. The player rig uses transparent glazing.
  if(role==='glass'){m.metalness=.65;m.roughness=.12;if(s.id==='orbit'){m.transparent=true;m.opacity=.35;m.depthWrite=false;m.side=THREE.DoubleSide;}}
  if(role==='lens'){m.metalness=.05;m.roughness=.07;m.transparent=true;m.opacity=.12;m.depthWrite=false;}
  library.set(key,m);return m;
}
class Parts {
  private parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
  constructor(readonly spec:CyberVehicleSpec,readonly group:THREE.Group){}
  add(role:Role,g:THREE.BufferGeometry,side=''):void {if(!g.index){const source=g;g=mergeVertices(source);source.dispose();}const m=material(role,this.spec,side),items=this.parts.get(m)??[];items.push(g);this.parts.set(m,items);}
  shape(role:Role,g:THREE.BufferGeometry,x:number,y:number,z:number,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,side=''):void {
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
    this.add(role,g.clone().applyMatrix4(matrix),side);
  }
  box(role:Role,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0,side=''):void{this.shape(role,box,x,y,z,w,h,d,rx,ry,rz,side);}
  line(role:Role,a:readonly number[],b:readonly number[],width:number,depth=width,side=''):void {
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),mid=from.clone().add(to).multiplyScalar(.5);
    const g=box.clone().applyMatrix4(new THREE.Matrix4().compose(mid,new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(width,delta.length(),depth)));this.add(role,g,side);
  }
  branch(group:THREE.Group):Parts{return new Parts(this.spec,group);}
  finish():void {
    for(const [m,parts]of this.parts){const merged=mergeGeometries(parts,false),g=merged?mergeVertices(merged):null;merged?.dispose();parts.forEach(p=>p.dispose());if(!g)throw new Error('Incompatible cyber vehicle geometry');const mesh=new THREE.Mesh(g,m);mesh.name=`Surface_${String(m.userData.vehicleRole)}_${String(m.userData.vehicleSide??'')}`;mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);}
    this.parts.clear();
  }
}
function lamps(p:Parts,lod:number):void {
  const {id,width,length,height,emergency}=p.spec,w=width/2,f=-length/2-.008,r=length/2+.008;
  const y=id==='titan'?1.48:id==='barricade'?1.53:id==='cargo'?1.35:id==='orbit'?1.01:Math.min(.85,height*.51);
  const ry=id==='titan'?1.25:id==='cargo'?1.3:id==='orbit'?1.8:height*.56;
  const trailer=p.group.getObjectByName('TrailerPivot') as THREE.Group|undefined,rear=trailer?new Parts(p.spec,trailer):undefined;
  // Recessed housings, individual emitters and lens lips give each signature actual depth.
  const segment=(role:Role,x:number,yy:number,z:number,ww:number,hh:number,angle=0,side='')=>{
    // Preserve each signature while keeping thin functional LEDs visible at distance.
    if (role === 'head' || role === 'brake') { const minimum=lod===2?.08:.055; ww=Math.max(ww,minimum);hh=Math.max(hh,minimum); }
    const q=rear&&z>0?rear:p,zz=z-(q===rear?trailer!.position.z:0),direction=z<0?-1:1;
    q.box('trim',x,yy,zz,ww+.075,hh+.07,.095,0,0,angle);
    q.box(role,x,yy,zz+direction*.052,ww,hh,.025,0,0,angle,side);
    if(lod===0){q.box('metal',x,yy+hh/2+.026,zz+direction*.04,ww,.012,.015,0,0,angle);q.box('lens',x,yy,zz+direction*.071,ww+.02,hh+.02,.012,0,0,angle);}
  };
  for(const side of [-1,1]) {
    const x=side*w*.7;
    switch(id) {
      case 'vortex':segment('head',x,y,f,width*.2,.035,side*.19);segment('head',side*w*.86,y-.07,f,.035,.17,side*.15);segment('brake',x,ry,r,width*.22,.045,-side*.22);segment('brake',side*w*.86,ry+.06,r,.035,.18,side*.22);break;
      case 'nebula':segment('head',x,y,f,width*.2,.035,side*.25);segment('head',side*w*.86,y-.07,f,.035,.17,side*.15);segment('brake',x,ry,r,width*.25,.04,side*.08);break;
      case 'lumen':case 'pulse':segment('head',side*w*.81,y,f,.045,id==='pulse'?.49:.22);segment('brake',x,ry,r,width*.23,.055,side*.11);break;
      case 'sentinel':case 'mira':case 'aegis':segment('head',x,y,f,width*.19,.055);segment('head',side*w*.88,y-.1,f,.04,.2);segment('brake',side*w*.86,ry,r,.055,id==='mira'?.45:.61);break;
      case 'vector':for(let i=0;i<3;i++)segment('head',side*(w*.6+i*.11),y+i*.03,f,.07,.027,side*.4);segment('brake',x,ry,r,width*.25,.035,side*.14);segment('brake',side*w*.92,ry+.05,r,.035,.2);break;
      case 'barricade':segment('head',x,y,f,width*.19,.08);segment('brake',side*w*.87,1.45,r,.08,.7);break;
      case 'titan':segment('head',x,y,f,.12,.32,-side*.35);segment('brake',side*w*.87,1.6,r,.08,.74);break;
      case 'cargo':segment('head',x,y,f,.47,.05);segment('head',x,y-.18,f,.24,.07);segment('brake',side*w*.86,1.55,r,.065,.7);break;
      case 'orbit':segment('head',x,y,f,.27,.07,side*.26);segment('brake',side*w*.86,1.9,r,.07,1.35,side*.06);break;
      case 'nova':segment('head',x,y,f,.045,.23);segment('brake',side*w*.88,ry,r,.045,.26);break;
      default:segment('head',x,y,f,width*.21,.034,-side*.08);segment('brake',x,ry,r,width*.28,.034);break;
    }
    if(lod<2){segment('turn',side*w*.91,y-.14,f,.09,.035,0,side<0?'left':'right');segment('turn',side*w*.91,Math.max(.42,ry-.15),r,.09,.04,0,side<0?'left':'right');segment('reverse',side*w*.48,Math.max(.38,ry-.17),r,.1,.035);}
  }
  const frontBar=['vortex','sentinel','aurora','mira','nova','cargo'].includes(id);
  if(frontBar)segment('accent',0,y+.06,f,width*.67,.022);
  if(!['pulse','cargo','titan','barricade'].includes(id))segment('brake',0,ry+.01,r,width*.62,id==='nebula'?.035:.022);
  if(lod<2)for(const side of [-1,1])p.box('accent',side*(w-.035),.39,0,.025,.028,Math.min(2.5,length*.5));
  if(emergency) {
    for(const side of [-1,1]) {
      const role:Role=emergency==='rescue'?(side<0?'amber':'blue'):(side<0?'red':'blue');
      segment(role,side*w*.38,y-.14,f,.19,.045);segment(role,side*w*.4,ry-.12,r,.18,.045);
      if(id!=='phantom')p.box(role,side*.33,height-.025,0,.54,.075,.21);
      else {segment(role,side*.33,1.15,-.58,.2,.035);segment(role,side*.33,1.04,1.5,.2,.035);}
      if(lod===0)p.box(role,side*w,.82,-.3,.025,.04,.17);
    }
  }
  if(lod<2&&['pulse','titan','cargo','barricade','nova'].includes(id))for(const side of [-1,1])for(let z=-length/2+.3;z<length/2;z+=Math.max(1.15,length/6))p.box('amber',side*(w+.006),Math.min(1,height*.45),z,.018,.05,.09);
  rear?.finish();
}
function wheels(p:Parts,lod:number,trailer?:THREE.Group):void {
  const s=p.spec,w=s.width/2,r=s.wheelRadius,commercial=s.wheels==='commercial',segments=lod===0?(commercial?24:32):lod===1?20:12,t=s.wheels==='commercial'?.27:.25;
  // Revolved sidewall and tread profile: rounded shoulders and recessed tread grooves.
  const profile=[ [.74,-.5],[.87,-.49],[.97,-.36],[1,-.25],[1,-.17],[.982,-.145],[1,-.12],[1,-.025],[.982,0],[1,.025],[1,.12],[.982,.145],[1,.17],[1,.25],[.97,.36],[.87,.49],[.74,.5] ];
  const tire=lod===2?new THREE.CylinderGeometry(r,r,t,segments):new THREE.LatheGeometry(profile.filter((_,i)=>!commercial||![4,6,8,10,12].includes(i)).map(([rad,x])=>new THREE.Vector2(rad*r,x*t)),segments);
  const disc=new THREE.CylinderGeometry(1,1,1,segments),ring=new THREE.TorusGeometry(1,.035,lod===0&&!commercial?8:4,segments);
  for(const side of [-1,1])for(let axle=0;axle<s.axles.length;axle++) {
    const z=s.axles[axle],pivot=new THREE.Group(),spin=new THREE.Group();
    pivot.name=axle===0?(side<0?'Wheel_FL':'Wheel_FR'):axle===s.axles.length-1?(side<0?'Wheel_RL':'Wheel_RR'):`Wheel_${side<0?'L':'R'}_${axle}`;
    pivot.userData.frontWheel=axle===0;pivot.userData.vehicleWheel=true;
    const parent=trailer&&z>0?trailer:p.group;
    pivot.position.set(side*(w-.13),r+.012,z-parent.position.z);spin.name='Spin';pivot.add(spin);parent.add(pivot);
    const q=new Parts(s,spin),face=side*(t/2+.015);
    q.shape('rubber',tire,0,0,0,1,1,1,0,0,Math.PI/2);
    if(lod===2)q.shape('metal',disc,face,0,0,r*.7,.02,r*.7,0,0,Math.PI/2);
    else {
      q.shape('metal',ring,face,0,0,r*.755,r*.755,r*.755,0,Math.PI/2);
      q.shape('trim',ring,face-side*.025,0,0,r*.72,r*.72,r*.72,0,Math.PI/2);
      // An open rim exposes a separate brake rotor and non-rotating caliper.
      q.shape('rotor',disc,side*.058,0,0,r*.61,.018,r*.61,0,0,Math.PI/2);
      const count=s.wheels==='turbine'?9:s.wheels==='luxury'?10:s.wheels==='performance'?6:s.wheels==='armored'?6:5;
      if(s.wheels==='covered')q.shape('trim',disc,face,0,0,r*.72,.018,r*.72,0,0,Math.PI/2);
      for(let spoke=0;spoke<count;spoke++) {
        const a=spoke/count*Math.PI*2,b=a+(s.wheels==='turbine'?.38:.1);
        for(const fork of s.wheels==='performance'?[-.075,.075]:[0])q.line('metal',[face,Math.cos(a)*r*.18,Math.sin(a)*r*.18],[face,Math.cos(b+fork)*r*.73,Math.sin(b+fork)*r*.73],s.wheels==='commercial'?.065:s.wheels==='armored'?.055:.027,.025);
      }
      q.shape('metal',disc,face+side*.018,0,0,r*.18,.028,r*.18,0,0,Math.PI/2);
      q.shape('accent',ring,face+side*.032,0,0,r*.19,r*.19,r*.19,0,Math.PI/2);
      if(lod===0){
        q.shape('trim',ring,side*(t/2-.004),0,0,r*.85,r*.85,r*.85,0,Math.PI/2);
        for(let bolt=0;bolt<5;bolt++){const a=bolt*Math.PI*2/5;q.box('metal',face+side*.038,Math.cos(a)*r*.12,Math.sin(a)*r*.12,.013,.016,.016);}
        for(let slot=0;slot<12;slot++){const a=slot*Math.PI*2/12;q.box('trim',side*.071,Math.cos(a)*r*.49,Math.sin(a)*r*.49,.008,.012,.035,a);}
      }
    }
    q.finish();
    if(lod===0){const caliper=new THREE.Mesh(new THREE.BoxGeometry(.055,r*.46,.09),material('caliper',s));caliper.name='BrakeCaliper';caliper.position.set(side*.09,r*.12,-r*.44);pivot.add(caliper);}
  }
  tire.dispose();ring.dispose();disc.dispose();
}
/** Immutable, shared model templates: a full prefab and two simplified LODs per identity. */
export function cyberPrefab(id:CyberModel,lod:0|1|2=0):THREE.Group {
  const key=id+':'+lod;if(sources.has(key))return sources.get(key)!;
  const spec=CYBER_VEHICLES[id],root=new THREE.Group();root.name=spec.name;root.userData.cyberModel=id;
  const p=new Parts(spec,root);referenceCoachwork(p,lod);lamps(p,lod);wheels(p,lod,root.getObjectByName('TrailerPivot') as THREE.Group|undefined);p.finish();
  root.updateMatrixWorld(true);sources.set(key,root);return root;
}

/** Fully modeled cockpit for the playable NEBULA, using the same exterior prefab. */
export function cyberPlayerPrefab():THREE.Group {
  const group=cyberPrefab('nebula').clone(true),p=new Parts(CYBER_VEHICLES.nebula,group);
  group.userData.playerRig=true;group.userData.scale=1;group.userData.exhaustMounts=[[-.11,.35,CYBER_VEHICLES.nebula.length/2+.03],[.11,.35,CYBER_VEHICLES.nebula.length/2+.03]];group.userData.eye=[-.335,1.015,.14];
  p.box('trim',0,.71,-.43,1.5,.17,.45);p.box('trim',0,.33,.22,1.46,.08,1.55);
  for(const side of [-1,1]){p.box('trim',side*.4,.51,.35,.5,.16,.55);p.box('trim',side*.4,.7,.6,.48,.53,.12,-.13);}
  p.finish();
  const steering=new THREE.Group();steering.name='Steering';steering.position.set(-.335,.77,-.22);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.15,.016,6,24),material('trim',CYBER_VEHICLES.nebula));steering.add(rim);
  for(const side of [-1,1]){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.025),material('metal',CYBER_VEHICLES.nebula));spoke.position.x=side*.07;steering.add(spoke);}group.add(steering);
  const mirrors=[['Mirror_Center',0,1.11,-.43,.35,.11],['Mirror_Left',-1.01,.92,-.6,.16,.085],['Mirror_Right',1.01,.92,-.6,.16,.085]]as const;
  for(const [name,x,y,z,w,h]of mirrors){const g=new THREE.PlaneGeometry(w,h);g.translate(x,y,z);const m=new THREE.Mesh(g,material('metal',CYBER_VEHICLES.nebula));m.name=name;group.add(m);}
  for(let i=0;i<2;i++) {
    const pivot=new THREE.Group();pivot.name=`Wiper_${i}`;pivot.position.set(i===0?-.55:.12,.76,-.98);
    for(let j=0;j<3;j++){const blade=new THREE.Mesh(new THREE.BoxGeometry(j===2?.45:.24,.012,.016),material('trim',CYBER_VEHICLES.nebula));blade.position.set(.1+j*.12,j*.025,j*.035);blade.name=`GEO_Wiper${i*3+j}`;pivot.add(blade);}group.add(pivot);
  }
  // Exported cockpit model has the reference coupe's cyan finish as well as the in-game rig.
  group.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&o.material.userData.vehicleRole==='paint'){o.material=o.material.clone();(o.material as THREE.MeshStandardMaterial).color.set('#00a8d6');}});
  return group;
}
