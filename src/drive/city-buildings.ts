import { Vector3 } from 'three';
import { palm } from './vegetation';
import { Random } from '../core/random';
import { towerPlan, type TowerVolume } from './architecture';
import type { CityParcel } from './world-layout';
import { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';

/** Hollow retail podiums: the glazed bays reveal modeled floors, ceilings and furniture. */
function podium(b: UrbanBatch,m: CityMaterials,p:CityParcel,z:number,h:number): void {
  const r=new Random(p.seed), front=p.x-p.side*p.width/2, rotation=-p.side*Math.PI/2;
  const floorHeight=4.1;
  // Keep a four-metre-deep strip open behind the shop windows instead of filling it with a box.
  b.box(m.concrete,p.x+p.side*2.1,h/2,z,p.width-4.2,h,p.depth);
  b.box(m.concrete,p.x,.18,z,p.width,.36,p.depth);
  b.box(m.trim,p.x,h,z,p.width+.5,.5,p.depth+.5);
  for(let y=4.6;y<h-.1;y+=3.4) {
    b.box(m.facades[p.seed%m.facades.length],front+.1*p.side,y+1.3,z,.15,2.8,p.depth-.8);
    b.box(m.concrete,front-.18*p.side,y,z,.45,.28,p.depth);
    for(let dz=-p.depth/2+1;dz<p.depth/2;dz+=3.8) b.box(m.trim,front-.25*p.side,y+1.4,z+dz,.18,2.8,.14);
  }
  const bays=3+p.seed%2, step=p.depth/bays;
  for(let i=0;i<bays;i++) {
    const bayZ=z-p.depth/2+(i+.5)*step, width=step-.5, height=3.2+r.next()*.45;
    const closed=(p.seed+i)%7===0, shop=i%3;
    b.box(m.concrete,front-.08*p.side,2.15,bayZ-step/2,.6,4.3,.48);
    b.box(m.dark,front+3.8*p.side,2.2,bayZ,.12,4.2,width);
    // Interior side walls, a floor and a shallow coffered ceiling.
    b.box(m.interior,front+1.8*p.side,.38,bayZ,3.8,.1,width);
    b.box(m.interior,front+1.8*p.side,floorHeight,bayZ,3.8,.16,width);
    b.box(shop===1?m.glass:m.interior,front+3.65*p.side,2.2,bayZ,.1,3.8,width);
    for(const side of [-1,1]) if(i!==bays-1||side!==1) b.box(m.concrete,front+1.8*p.side,2.15,bayZ+side*width/2,3.8,4.3,.16);
    if(!closed) {
      b.box(shop===1?m.neutralLight:m.light,front+1.9*p.side,3.96,bayZ,2.4,.05,width*.65);
      if(shop===0) {
        b.box(m.interior,front+2*p.side,.94,bayZ,1.1,1.1,width*.58); b.box(m.trim,front+2*p.side,1.53,bayZ,1.3,.08,width*.65);
        for(const shelfY of [1.2,2.1,3]) { b.box(m.trim,front+3.4*p.side,shelfY,bayZ,.35,.06,width*.8); for(let j=0;j<4;j++) b.box(j%2?m.white:m.amber,front+3.35*p.side,shelfY+.17,bayZ-width*.3+j*width*.2,.24,.3,.25); }
      } else if(shop===1) {
        b.box(m.dark,front+2.5*p.side,.65,bayZ,1.6,1.1,1.4); b.box(m.white,front+2.5*p.side,1.3,bayZ,1,.25,1);
        b.cylinder(m.trim,front+1.3*p.side,1.1,bayZ+width*.28,.09,1.6);
      } else {
        for(const side of [-1,1]) { b.box(m.interior,front+2.4*p.side,.6,bayZ+side*width*.27,1.6,.9,1); b.box(m.glass,front+2.4*p.side,1.1,bayZ+side*width*.27,1.4,.12,.9); }
        b.box(m.white,front+3.5*p.side,2.1,bayZ,.05,1.5,width*.4);
      }
      b.panel(m.shopGlass,front-.035*p.side,2.1,bayZ,width,height,rotation);
      const doorZ=bayZ+width*.26;
      b.panel(m.shopGlass,front+.25*p.side,1.85,doorZ,1.1,2.9,rotation);
      for(const dz of [-.58,.58]) b.box(m.trim,front-.1*p.side,1.9,doorZ+dz,.14,3.15,.09);
      b.box(m.trim,front-.17*p.side,1.65,doorZ+.39,.12,.6,.035);
    } else {
      b.box(m.steel,front,1.95,bayZ,.1,3.2,width);
      for(let y=.6;y<3.5;y+=.27) b.box(m.dark,front-.07*p.side,y,bayZ,.06,.035,width);
    }
    b.box(m.concrete,front-.5*p.side,.18,bayZ,1.15,.26,width*.65);
    b.box(m.dark,front-.6*p.side,4.2,bayZ,1.6,.18,width+.2);
    b.box(i%2?m.cyan:m.neutralLight,front-1.22*p.side,4.12,bayZ,.07,.065,width*.85);
    b.panel(m.sign,front-.18*p.side,4.64,bayZ,width-.2,.65,rotation,m.signRects[(p.sign+i)%16]);
    b.box(m.trim,front-.12*p.side,3.8,bayZ,.2,.16,width);
  }
  // Corner lobby faces approaching traffic as well as the sidewalk.
  const cornerX=front+2*p.side, cornerZ=z+p.depth/2+.03;
  b.box(m.dark,cornerX,2.2,cornerZ-3.4,3.7,4.1,.13);
  b.panel(m.shopGlass,cornerX,2.2,cornerZ+.08,3.3,3.6,0);
  b.box(m.neutralLight,cornerX,3.8,cornerZ+.15,2.7,.09,.09);
  // Recessed terrace, a real balustrade and supporting columns under the overhang.
  if(p.seed%2===0) {
    b.box(m.pavement,front+.9*p.side,h+.35,z,2.1,.18,p.depth-1);
    b.box(m.shopGlass,front-.18*p.side,h+1,z,.07,1.1,p.depth-.5);
    b.box(m.trim,front-.2*p.side,h+1.58,z,.09,.07,p.depth);
    if(p.seed%5===0)palm(b,m,front+p.side*1.5,z-p.depth*.25,p.seed,h+.5);
    for(const dz of [-1,1]) b.box(m.landscape,front+.8*p.side,h+.7,z+dz*(p.depth/2-2),1.3,.6,2.5);
  }
}
function skin(b:UrbanBatch,m:CityMaterials,p:CityParcel,z:number,t:TowerVolume,index:number): void {
  const x=p.x+t.x, tz=z+t.z, facade=m.facades[(index+(p.style==='masonry'?2:p.style==='residential'?1:p.style==='rounded'?3:0))%m.facades.length];
  if(t.shape==='round') b.rounded(facade,x,t.base,tz,t.width,t.depth,t.height,Math.min(t.width,t.depth)*.28);
  else if(t.shape==='taper') b.tapered(facade,x,t.base,tz,t.width,t.depth,t.height,t.topScale);
  else b.box(facade,x,t.base+t.height/2,tz,t.width,t.height,t.depth);
  const floor=p.style==='residential'?3.4:4.2;
  for(let y=t.base;y<t.base+t.height-.5;y+=floor*(p.row+1)) {
    const factor=t.shape==='taper'?1-(1-t.topScale)*(y-t.base)/t.height:1, w=t.width*factor,d=t.depth*factor;
    if(t.shape==='round') { if(Math.round((y-t.base)/floor)%2===0) b.rounded(m.trim,x,y,tz,w+.23,d+.23,.15,Math.min(w,d)*.28); }
    else {
      b.box(m.trim,x,y,tz+d/2+.13,w+.28,.16,.32);
      b.box(m.concrete,x-p.side*(w/2+.13),y,tz,.32,.2,d+.28);
      // Real recessed window bays: broad structural frames in front of the glazing.
      if(p.style==='residential' && Math.round((y-t.base)/floor)%3===1) {
        b.box(m.concrete,x-p.side*(w/2+.45),y,tz,.9,.18,d*.8);
        b.box(m.shopGlass,x-p.side*(w/2+.86),y+.65,tz,.07,1.1,d*.78);
        b.box(m.trim,x-p.side*(w/2+.9),y+1.22,tz,.08,.06,d*.8);
      }
    }
  }
  if(t.shape!=='taper') {
    const inset=t.shape==='round'?Math.min(t.width,t.depth)*.28:1;
    for(let offset=-t.width/2+inset;offset<=t.width/2-inset+.01;offset+=p.row>0?7.6:3.8) b.box(m.trim,x+offset,t.base+t.height/2,tz+t.depth/2+.18,.14,t.height,.38);
    for(let offset=-t.depth/2+inset;offset<=t.depth/2-inset+.01;offset+=p.row>0?8.4:4.2) b.box(p.style==='masonry'?m.concrete:m.trim,x-p.side*(t.width/2+.18),t.base+t.height/2,tz+offset,.4,t.height,.2);
  }
  const top=t.base+t.height, tw=t.width*t.topScale, td=t.depth*t.topScale;
  if(t.shape==='round') b.rounded(m.trim,x,top,tz,tw+.4,td+.4,.4,Math.min(tw,td)*.28);
  else b.box(m.concrete,x,top+.2,tz,tw+.55,.4,td+.55);
  b.box(m.dark,x,top+.7,tz,tw*.55,1.1,td*.6);
  // Louvred mechanical enclosure and a rooftop service unit, not just a glowing cap.
  b.box(m.steel,x+tw*.17,top+1.8,tz-td*.12,tw*.32,2.3,td*.35);
  for(let y=top+1;y<top+2.8;y+=.4) b.box(m.dark,x+tw*.17,y,tz+td*.065,tw*.32,.09,.08);
}
export function buildTower(b:UrbanBatch,m:CityMaterials,p:CityParcel,start:number): void {
  const plan=towerPlan(p), z=-(p.s-start);
  b.box(m.pavement,p.x,.02,z,p.width+1.7,.14,p.depth+1.7);
  if(p.row===0) podium(b,m,p,z,plan.podium);
  else { b.box(m.concrete,p.x,plan.podium/2,z,p.width,plan.podium,p.depth); b.box(m.glass,p.x,3,z+p.depth/2+.08,p.width-1,4,.1); }
  plan.volumes.forEach((t,i)=>skin(b,m,p,z,t,i));
  if(plan.name==='cantilever-residence') for(const side of [-1,1]) {
    b.beam(m.steel,new Vector3(p.x-p.width*.22,plan.podium+(p.height-plan.podium)*.24,z+side*p.depth*.27),new Vector3(p.x-p.width*.44,plan.podium+(p.height-plan.podium)*.37,z+side*p.depth*.27),.17,7);
  }
  const highest=plan.volumes.reduce((a,b)=>a.base+a.height>b.base+b.height?a:b), top=highest.base+highest.height;
  const x=p.x+highest.x, tz=z+highest.z;
  if(plan.crown==='spire') {
    b.tapered(m.steel,x,top+2,tz,highest.width*.35,highest.depth*.35,9,.3);
    b.cylinder(m.steel,x,top+15,tz,.16,20);
    b.cylinder(m.cyan,x,top+18,tz,.075,16);
  } else if(plan.crown==='frame') {
    for(const side of [-1,1]) b.box(m.trim,x+side*highest.width*.32,top+3,tz,.35,6,highest.depth*.65);
    b.box(m.trim,x,top+6,tz,highest.width*.67,.3,highest.depth*.65);
  } else b.tapered(m.steel,x+highest.width*.15,top+2,tz,highest.width*.48,highest.depth*.5,6,.6);
  // Structural fins carry occasional restrained strips, rather than outlining every tower.
  if(p.seed%3===0) {
    const glow=p.seed%2?m.cyan:m.violet;
    b.box(glow,x,top+2.1,tz+highest.depth*.3,highest.width*.45,.12,.12);
    if(highest.shape==='box') b.box(glow,x-p.side*(highest.width/2+.4),(highest.base+top)/2,tz,.1,highest.height,.1);
  }
  // Selected integrated advertising bays leave the architecture itself visible.
  if(p.row===0 && p.seed%3!==1) {
    const ad=p.side<0?(p.seed%3===0?0:2):(p.seed%2?1:2), w=Math.min(16,p.width*.68), h=ad===1?w*.5:w*1.05, y=plan.podium+2+h/2;
    b.box(m.dark,p.x,y,z+p.depth/2+.1,w+1,h+1,.65);
    b.panel(m.ad,p.x,y,z+p.depth/2+.45,w,h,0,m.adRects[ad]);
    for(const side of [-1,1]) b.box(m.trim,p.x+side*(w/2+.35),y,z+p.depth/2+.5,.4,h+1,.3);
    if(p.seed%2===0) {
      const face=p.x-p.side*(p.width/2+.4);
      b.box(m.dark,face,y,z+p.depth*.25,1,h+3,3.8);
      b.panel(m.ad,face,y,z+p.depth*.25+2,3.3,h+2,0,m.adRects[3+p.seed%2]);
    }
  }
}
