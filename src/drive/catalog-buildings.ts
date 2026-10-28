import { BoxGeometry, SphereGeometry, Vector3, type Material } from 'three';
import { catalogPlan, profileContour, type CatalogPlan, type CatalogVolume } from './catalog-architecture';
import type { CityParcel } from './world-layout';
import { UrbanBatch } from './world-geometry';
import type { CityMaterials } from './world-materials';
import { palm } from './vegetation';
import { catalogFrontage,catalogEntryHeight } from './catalog-frontage';
import { CITY_MIST_END } from './atmosphere';

export interface BuildingBatches { silhouette:UrbanBatch; relief:UrbanBatch; street:UrbanBatch }
function volume(b:UrbanBatch,m:Material,p:CityParcel,z:number,t:CatalogVolume,inflate=0,height=t.height,base=t.base):void {
  const x=p.x+t.x,tz=z+t.z,w=t.width+inflate,d=t.depth+inflate;
  if(t.profile==='box'&&t.topScale===1)b.box(m,x,base+height/2,tz,w,height,d,t.angle);
  else b.prism(m,x,base,tz,w,d,height,profileContour(t.profile),t.topScale,t.angle,t.profile==='slant'?.22:0,t.profile==='shell');
}

/** Twelve entrance programs share structural components, not the same storefront composition. */
function ground(b:BuildingBatches,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan):void {
  const {silhouette:base,relief:mid,street:near}=b,a=plan.asset;
  const w=a.id===1?58:a.width,d=a.id===1?46:a.depth,h=plan.podium;
  if(a.id===26) return;
  const entryHeight=catalogEntryHeight(a.ground,h);
  base.box(m.concrete,p.x+p.side*2.6,h/2,z-2.6,w-5.2,h,d-5.2);
  base.box(m.pavement,p.x,.19,z,w,.34,d);
  base.box(m.concrete,p.x,h,z,w+.4,.5,d+.4);
  // The glazed street and approaching faces enclose an actual L-shaped interior.
  for(const approach of [false,true]) {
    const length=approach?w:d,front=p.x-p.side*w/2;
    const box=(batch:UrbanBatch,mat:Material,u:number,y:number,v:number,uw:number,yh:number,vd:number)=>{
      if(approach)batch.box(mat,p.x+u,y,z+d/2-v,uw,yh,vd);
      else batch.box(mat,front+p.side*v,y,z+u,vd,yh,uw);
    };
    const panel=(batch:UrbanBatch,mat:Material,u:number,y:number,v:number,pw:number,ph:number,ad?:number)=>{
      const rect=ad===undefined?undefined:m.signRects[ad];
      batch.panel(mat,approach?p.x+u:front+p.side*v,y,approach?z+d/2-v:z+u,pw,ph,approach?0:-p.side*Math.PI/2,rect);
    };
    for(const [i,entry]of catalogFrontage(a.id,length).entries()) {
      const use=entry.use,service=use==='service'||use==='parking';
      const u=entry.center,step=entry.width,bay=step-.65;
      const recess=use==='arcade'?2.4:use==='residential'?1.4:.6;
      box(base,m.concrete,u-step/2,entryHeight/2,0,.55,entryHeight,.6);
      box(base,service?m.dark:m.interior,u,entryHeight/2,4.95,bay,entryHeight,.14);
      box(base,m.interior,u,.4,2.5,bay,.12,4.8);
      box(base,m.dark,u,entryHeight+.12,1.8,bay,.25,5.6);
      box(base,m.light,u,entryHeight-.16,2.1,bay*.65,.08,.6);
      if(service) {
        box(base,m.steel,u,entryHeight*.48,.3,bay,entryHeight*.86,.2);
        for(let y=.8;y<entryHeight-.4;y+=.4)box(mid,m.dark,u,y,.17,bay,.07,.12);
        box(mid,m.dark,u,.55,-.6,bay+1,1.1,1.3);
        for(const side of [-1,1])box(near,m.amber,u+side*(bay/2+.3),.8,-1,.16,1.6,.16);
        if(a.id===67||a.id===78) {box(base,m.dark,u,2.2,.13,bay*.75,3.1,.1);box(near,m.steel,u,1.2,2.2,.22,2.3,3.8);box(near,m.amber,u,1.6,2.2,2.6,.12,1.8);}
      } else {
        panel(base,m.shopGlass,u,entryHeight/2+.2,recess,bay,entryHeight-.2);
        const doorWidth=use==='mall'||use==='civic'?3.4:use==='residential'?1.4:2.2;
        panel(mid,m.shopGlass,u,1.8,recess+.2,doorWidth,3.3);
        for(const side of [-1,1])box(mid,m.trim,u+side*doorWidth/2,1.85,recess, .1,3.5,.18);
        box(near,m.trim,u+.3,1.4,recess-.08,.045,.7,.1);
        if(use==='office'||use==='hotel'||use==='residential') {
          box(near,m.interior,u,1.05,3.3,Math.min(5,bay*.55),1.3,1.1);
          box(near,m.trim,u,1.74,3.3,Math.min(5.3,bay*.57),.08,1.2);
          for(const side of [-1,1]) {box(near,m.interior,u+side*bay*.3,.65,2.6,Math.min(2.2,bay*.18),.85,1.2);box(near,m.dark,u+side*bay*.3,1.2,3.1,Math.min(2.2,bay*.18),.6,.18);}
          if(use==='residential')for(let j=0;j<6;j++)box(near,m.steel,u-bay*.3+j*.35,1.5,4.8,.3,.48,.12);
        } else if(use==='restaurant') {
          for(const table of [-1,1]) {box(near,m.interior,u+table*bay*.25,1.1,2.5,bay*.27,.13,1.6);box(near,m.trim,u+table*bay*.25,.6,2.5,.13,1,.13);for(const chair of [-1,1])box(near,m.interior,u+table*bay*.25,.6,2.5+chair*1.1,.7,.75,.6);box(near,m.light,u+table*bay*.25,3.5,2.5,.5,.18,.5);}
        } else if(use==='station') {
          for(let j=0;j<4;j++)box(near,m.steel,u-1.8+j*1.2,.8,2.3,.32,1.4,1.2);
          for(let j=0;j<9;j++)box(near,m.trim,u+bay*.28,.3+j*.25,1+j*.25,1.6,.2,.3);
          box(mid,m.dark,u+bay*.28,1.7,3.4,1.9,3.4,.4);
        } else if(use==='cinema') {
          box(near,m.interior,u,1,3.7,bay*.75,1.2,.8);
          for(const side of [-1,1]) {box(near,m.dark,u+side*bay*.34,2.4,1.5,.7,1.2,.2);box(near,m.neutralLight,u+side*bay*.34,2.4,1.37,.55,.9,.03);}
        } else if(use==='mall') {
          for(const y of [2.8,5.5]) {box(mid,m.concrete,u,y,3.8,bay,.22,1.8);box(mid,m.shopGlass,u,y+.7,3,bay,.9,.07);}
          box(mid,m.shopGlass,u+bay*.32,entryHeight/2,2,1.9,entryHeight,.12);
          for(let j=0;j<10;j++)box(near,m.trim,u-bay*.27,.3+j*.32,1+j*.28,1.4,.22,.32);
        } else {
          const library=a.id===76||a.id===99;
          for(const side of [-1,1])for(const y of [1,2,3]) {
            box(near,m.interior,u+side*bay*.29,y,3.7,bay*.23,.1,.65);
            for(let j=0;j<(library?6:4);j++)box(near,j%2?m.white:m.amber,u+side*bay*.29-bay*.08+j*bay*.03,y+.18,3.65,.14,.3,.3);
          }
          if(use==='civic')box(near,m.interior,u,1.1,3.1,Math.min(5,bay*.3),1.3,1.3);
        }
      }
      const sign=use==='parking'?20:use==='service'?21:use==='station'?17:use==='hotel'?2:a.id===22?3:use==='restaurant'?6:(p.sign+i)%16;
      panel(mid,m.sign,u,entryHeight+.65,-.12,Math.min(9,bay),.9,sign);
      const canopyDepth=use==='hotel'||use==='mall'||use==='cinema'?3.2:use==='arcade'?2.7:1.4;
      box(base,m.steel,u,entryHeight+.1,-canopyDepth/2,bay+.6,.25,canopyDepth);
      box(mid,use==='restaurant'||use==='cinema'?m.pink:m.neutralLight,u,entryHeight-.09,-canopyDepth+.1,bay*.88,.06,.08);
      if(use==='arcade'||use==='civic'||use==='mall')for(const side of [-1,1])box(base,m.concrete,u+side*bay*.46,entryHeight/2,-canopyDepth+.3,.42,entryHeight,.42);
      if(use==='civic'||use==='residential')for(let j=0;j<3;j++)box(mid,m.pavement,u,.1+j*.1,-.3-j*.4,bay*.8,.16,.4);
    }
    for(let y=entryHeight+2;y<h-.7;y+=4.1) {
      box(base,m.facades[plan.facade],0,y,0,length-1,3.7,.18);
      box(mid,m.trim,0,y-1.9,-.16,length,.2,.25);
    }
  }
}

function relief(b:UrbanBatch,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan,t:CatalogVolume):void {
  if(t.role!=='glass'||t.profile==='shell')return;
  const floor=plan.asset.height/plan.asset.floors;
  const stop=t.base+t.height;
  // Lower ten floors retain floor-by-floor structure. Upper floors use larger structural bays.
  for(let y=t.base+floor;y<stop-.5;) {
    const factor=1+(t.topScale-1)*(y-t.base)/t.height;
    if(t.profile==='box'&&t.angle===0) {
      b.box(m.trim,p.x+t.x,y,z+t.z+t.depth*factor/2+.12,t.width*factor,.18,.24);
      b.box(m.trim,p.x+t.x-p.side*(t.width*factor/2+.12),y,z+t.z,.24,.18,t.depth*factor);
    } else if(t.profile!=='slant')volume(b,m.trim,p,z,{...t,width:t.width*factor,depth:t.depth*factor,topScale:1},.22,.14,y);
    y+=floor*(y<42?1:3);
  }
  if(t.profile==='box'&&t.topScale===1&&t.angle===0) {
    for(let u=-t.depth/2+1;u<t.depth/2;u+=plan.asset.district===7?6:4.5)b.box(m.trim,p.x+t.x-p.side*(t.width/2+.13),t.base+t.height/2,z+t.z+u,.28,t.height,.16);
    for(let u=-t.width/2+1;u<t.width/2;u+=4.5)b.box(m.trim,p.x+t.x+u,t.base+t.height/2,z+t.z+t.depth/2+.13,.16,t.height,.28);
  }
  if(plan.asset.district===4||[24,28,58,91].includes(plan.asset.id)) {
    for(let y=t.base+floor;y<stop-1;y+=floor*2) {
      const offset=(Math.round(y/floor)%4<2?1:-1)*t.depth*.21,span=t.depth*.36;
      b.box(m.concrete,p.x+t.x-p.side*(t.width/2+.7),y,z+t.z+offset,1.5,.18,span);
      b.box(m.shopGlass,p.x+t.x-p.side*(t.width/2+1.35),y+.65,z+t.z+offset,.07,1.1,span);
      b.box(m.trim,p.x+t.x-p.side*(t.width/2+1.4),y+1.2,z+t.z+offset,.07,.07,span);
    }
  }
}
function terraces(b:BuildingBatches,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan):void {
  const h=plan.asset.height-plan.podium-plan.roofHeight;
  for(const [i,f]of plan.terraces.entries()) {
    const y=plan.podium+h*f,part=plan.volumes.find(t=>Math.abs(t.base+t.height-y)<2)??plan.volumes[0];
    const x=p.x+part.x,d=Math.min(part.depth,plan.asset.depth),w=Math.min(part.width,plan.asset.width);
    b.silhouette.box(m.concrete,x,y,z+part.z,w+.6,.28,d+.6);
    for(const side of [-1,1]) {
      b.relief.box(m.trim,x+side*(w/2-.3),y+.7,z+part.z,.08,1.2,d);
      b.relief.box(m.landscape,x+side*(w/2-1.3),y+.5,z+part.z,1.5,.8,d*.7);
      for(let j=0;j<3;j++)b.relief.box(m.palmLeaf,x+side*(w/2-1.3),y+1.1,z+part.z+(j-1)*d*.22,1.7,.7,2);
    }
    if(p.row===0&&i<2&&[3,13,36,58,91,97,100].includes(plan.asset.id))palm(b.street,m,x-p.side*(w/2-2.6),z+part.z-d*.2,p.seed+i,y+.3);
  }
}
function rooftop(b:BuildingBatches,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan):void {
  const a=plan.asset,highest=plan.volumes.reduce((v,t)=>t.base+t.height>v.base+v.height?t:v),y=highest.base+highest.height;
  const x=p.x+highest.x,tz=z+highest.z,w=highest.width*highest.topScale,d=highest.depth*highest.topScale;
  const base=b.silhouette,mid=b.relief;
  for(const t of plan.volumes)if(t.role!=='bridge') {
    // Repeat its actual contour, not a rectangular lid filling atriums and courtyards.
    if(t.profile!=='shell'&&t.profile!=='slant')volume(base,m.trim,p,z,{...t,width:t.width*t.topScale,depth:t.depth*t.topScale,topScale:1},.2,.28,t.base+t.height);
  }
  if(a.roof==='ring'||a.id===98) {
    const radius=a.id===98?21:a.id===96?26:22,cy=y+(a.id===80?1.5:8);
    for(const side of [-1,1])for(const sz of [-1,1])base.beam(m.steel,new Vector3(x+side*w*.32,y,tz+sz*d*.32),new Vector3(x+side*radius*.7,cy,tz+sz*radius*.7),.4,6);
    base.ring(m.steel,x,cy,tz,radius,.75);base.ring(a.id===98?m.pink:m.cyan,x,cy+.5,tz,radius,.15);
    if(a.id===98) {base.cylinder(m.steel,x,y+18,tz,.16,28);base.cylinder(m.pink,x,y+30,tz,.08,6);}
  } else if(a.roof==='spire') {
    const points=a.id===82?[-.29,.29]:a.id===89?[-.3,0,.3]:[0];
    for(const [i,dx]of points.entries()) {
      const cx=points.length>1?p.x+dx*a.width:x,top=y-(points.length>1?i*7:0),rh=plan.roofHeight;
      base.tapered(m.steel,cx,top,tz,Math.min(w*.5,10),Math.min(d*.5,12),rh*.45,.18);
      base.cylinder(m.steel,cx,top+rh*.58,tz,.14,rh*.84);base.cylinder(m.cyan,cx,top+rh*.78,tz,.065,rh*.4);
    }
  } else if(a.roof==='lantern') {
    for(const side of [-1,1])base.box(m.steel,x+side*w*.4,y+4,tz,.5,8,d*.8);
    base.box(m.neutralLight,x,y+4,tz,w*.74,6,d*.7);base.box(m.steel,x,y+8,tz,w*.84,.4,d*.84);
  } else if(a.roof==='pavilion'||a.roof==='garden') {
    base.box(m.facades[plan.facade],x+w*.08,y+2,tz-d*.1,w*.42,3.8,d*.46);
    base.box(m.concrete,x+w*.08,y+4,tz-d*.1,w*.49,.4,d*.53);
    if(a.roof==='garden')for(const side of [-1,1]) {
      mid.box(m.landscape,x+side*w*.34,y+.5,tz,2,.8,d*.7);
      for(let j=0;j<3;j++)mid.box(m.palmLeaf,x+side*w*.34,y+1.3,tz+(j-1)*d*.2,2,1,2.8);
      mid.box(m.steel,x+side*w*.32,y+2.3,tz+d*.3,.15,4.6,.15);
    }
    if(a.roof==='garden')for(let i=0;i<4;i++)mid.box(m.trim,x,y+4.5,tz+d*(.2+i*.05),w*.7,.12,.13);
  } else if(a.roof==='sawtooth') {
    for(let i=0;i<5;i++)base.prism(m.steel,x-w*.4+i*w*.2,y,tz,w*.19,d*.85,4,profileContour('box'),1,0,.9);
  } else if(a.roof==='landing') {
    base.box(m.dark,x,y+.3,tz,w*.85,.5,d*.85);
    for(const side of [-1,1])base.box(m.neutralLight,x+side*w*.35,y+.6,tz,.15,.08,d*.7);
    for(const side of [-1,1])mid.box(m.white,x+side*2,y+.59,tz,.3,.04,5);
    mid.box(m.white,x,y+.59,tz,4,.04,.3);
  } else if(a.roof==='crown') {
    const profile=[2,7,10,89,95].includes(a.id)?highest.profile:'box';
    base.prism(m.steel,x,y,tz,w*.62,d*.66,5,profileContour(profile),.7);
    base.box(m.cyan,x,y+4,tz+d*.25,w*.45,.12,.15);
  }
  if(a.roof==='antenna')for(let i=0;i<3;i++) {
    mid.cylinder(m.steel,x+(i-1)*w*.22,y+3+i,tz,.09,6+i*2,6);
    mid.box(m.white,x+(i-1)*w*.22,y+5+i,tz,.7,.4,.1);
  }
  // Shared PBR plant equipment, screened housings and parapets vary with the asset's roof program.
  for(let i=0;i<(a.district===7?5:2);i++) {
    const cx=x-w*.23+i*2.4;
    mid.box(m.steel,cx,y+.9,tz-d*.23,1.7,1.6,2.3);mid.cylinder(m.dark,cx,y+1.76,tz-d*.23,.6,.12,8);
  }
}

function structure(b:BuildingBatches,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan):void {
  const a=plan.asset,base=b.silhouette,mid=b.relief,h=a.height-plan.roofHeight;
  if(a.id===26) {
    const f=a.height/a.floors;
    for(let i=0;i<=a.floors;i++) {
      const y=.3+i*f;
      base.box(m.concrete,p.x,y,z,a.width,.35,a.depth);
      for(const x of [-1,1])for(const dz of [-1,1])base.box(m.concrete,p.x+x*(a.width/2-1),y+f/2,z+dz*(a.depth/2-1),.8,f,.8);
      if(i<a.floors) {
        const span=a.width*.48,ramp=new BoxGeometry(Math.hypot(span,f),.3,4.5);
        ramp.rotateZ(Math.atan2(f,span));ramp.translate(p.x,y+f/2,z-a.depth*.26);mid.add(m.concrete,ramp);
        mid.box(m.light,p.x,y+f-.25,z,a.width*.7,.06,.2);
      }
    }
    for(const side of [-1,1])base.box(m.steel,p.x+side*a.width/2,a.height+.8,z,.15,1.2,a.depth);
  }
  if([50,93,100].includes(a.id))for(const side of [-1,1]) {
    const x=p.x+side*a.width*.42;
    if(a.id===50)for(let i=0;i<4;i++)base.beam(m.trim,new Vector3(x,plan.podium+(h-plan.podium)*i/4,z+a.depth*.44),new Vector3(p.x-side*a.width*.42,plan.podium+(h-plan.podium)*(i+1)/4,z+a.depth*.44),.5,6);
    else {base.beam(m.steel,new Vector3(p.x+side*a.width*.28,0,z+a.depth*.2),new Vector3(x,plan.podium,z+a.depth*.4),.7,7);base.box(m.steel,x,plan.podium,z,a.width*.08,1.3,a.depth*.8);}
  }
  if([43,62,68,69,99].includes(a.id))for(let i=0;i<5;i++) {
    const x=p.x-a.width*.36+i*a.width*.18,depth=a.id===68?1.5:.35;
    mid.box(m.steel,x,h*.52,z+a.depth/2+depth/2,depth,h*.72,depth);
    for(let j=0;j<4;j++)mid.box(m.dark,x,h*(.2+j*.18),z+a.depth/2+depth,.8,1.1,.12);
  }
  if(a.id===5)for(let i=0;i<4;i++) {
    base.prism(m.steel,p.x+(i%2?1:-1)*a.width*.35,plan.podium+8+i*14,z+a.depth*.4,6,3,12,profileContour('box'),.45,(i%2?1:-1)*.2,.28);
  }
  if([8,17,44,95].includes(a.id)) {
    const height=(h-plan.podium)*(a.id===8?.37:.9),width=a.width*(a.id===8?.33:.19);
    base.panel(m.shopGlass,p.x,plan.podium+height/2,z+a.depth*.49,width,height,0);
    for(const side of [-1,1])base.box(m.steel,p.x+side*width/2,plan.podium+height/2,z+a.depth*.5,.3,height,.3);
  }
  if(a.id===44) {
    // A second, perforated facade layer stands clear of the research glazing.
    for(let i=0;i<9;i++)mid.box(m.trim,p.x-a.width*.43+i*a.width*.05,h*.55,z+a.depth*.51,.2,h*.7,.2);
    for(let y=plan.podium+4;y<h*.9;y+=9)mid.box(m.trim,p.x-a.width*.23,y,z+a.depth*.51,a.width*.44,.16,.2);
  }
  if(a.id===66)for(const f of [.2,.48,.76]) {
    const y=plan.podium+(h-plan.podium)*f;
    for(const side of [-1,1])mid.box(m.steel,p.x+side*a.width*.48,y+.7,z+a.depth*.35,.1,1.2,a.depth*.3);
    for(const side of [-1,1])base.box(side<0?m.pink:m.cyan,p.x+side*a.width*.46,y+.2,z+a.depth*.49,.4,.15,.4);
  }
  if(a.id===68)for(const side of [-1,1]) {
    base.cylinder(m.steel,p.x+side*a.width*.28,h+3,z,.95,9,10);
    base.cylinder(m.dark,p.x+side*a.width*.28,h+7.6,z,1.15,.3,10);
  }
  if(a.id===79) {
    const dish=new SphereGeometry(3.2,16,8,0,Math.PI*2,0,Math.PI/2);dish.rotateX(.65);dish.translate(p.x+5,h+3,z);
    base.add(m.steel,dish);base.cylinder(m.steel,p.x+5,h+.7,z,.22,4,6);
  }
  if(a.id===21) {
    b.street.box(m.dark,p.x-p.side*(a.width/2-1),1.4,z+a.depth*.3,1.3,2.4,1.1);
    b.street.box(m.neutralLight,p.x-p.side*(a.width/2-1.69),1.6,z+a.depth*.3,.06,1.3,.65);
  }
  if(a.id===65)for(const side of [-1,1]) {
    base.cylinder(m.steel,p.x+side*a.width*.35,plan.podium+2,z-a.depth*.3,4,7,16);
    base.beam(m.steel,new Vector3(p.x+side*a.width*.35,6,z-a.depth*.3),new Vector3(p.x+side*a.width*.35,6,z+a.depth*.4),.7,8);
  }
  if([7,17,19,47,54,83,92,99].includes(a.id)) {
    const width=a.width*.15,y=plan.podium+(h-plan.podium)*.45;
    base.box(a.id===99?m.shopGlass:m.glass,p.x,y,z+a.depth*.08,width,(h-plan.podium)*.85,.18);
    base.box(a.id===99?m.violet:m.cyan,p.x-width/2,y,z+a.depth*.1,.13,(h-plan.podium)*.85,.16);
  }
  if([12,16,54].includes(a.id))for(let i=0;i<3;i++) {
    const x=p.x-a.width*.35,y=plan.podium+7+i*15;
    base.box(m.steel,x,y,z+a.depth*.51,3.6,10,1);
    base.panel(m.ad,x,y,z+a.depth*.51+.55,3.2,9.6,0,m.adRects[3+i%2]);
    for(const dy of [-4,4])mid.beam(m.steel,new Vector3(x,y+dy,z+a.depth*.5),new Vector3(x+3,y+dy,z+a.depth*.3),.14,5);
  }
}
function advertising(b:UrbanBatch,m:CityMaterials,p:CityParcel,z:number,plan:CatalogPlan):void {
  if(plan.advertisement===null)return;
  const a=plan.asset,ad=plan.advertisement,w=a.id===51?a.width*.78:a.id===13?a.width*.64:a.width*.48;
  const height=ad===1?w*.5:ad===2?w*.72:Math.min(w*1.4,a.height*.48),y=plan.podium+2+height/2;
  // Recessed backing, deep projecting frame and physical sign supports. Windows stay out of this bay.
  const front=z+a.depth/2+.7;
  b.box(m.dark,p.x,y,front-.35,w+1.4,height+1.4,1.2);
  b.panel(m.ad,p.x,y,front+.28,w,height,0,m.adRects[ad]);
  for(const side of [-1,1]) {
    b.box(m.steel,p.x+side*(w/2+.35),y,front+.35,.5,height+1.4,.5);
    b.beam(m.steel,new Vector3(p.x+side*w*.4,y-height*.4,front-.3),new Vector3(p.x+side*w*.4,y-height*.4-2,front-2),.2,6);
  }
  b.box(ad===0?m.pink:m.cyan,p.x,y-height/2-.4,front+.35,w,.15,.25);
}

/** Additive LODs retain the same silhouette, actual open atriums, bridges and crowns at every distance. */
export function buildCatalogBuilding(b:BuildingBatches,m:CityMaterials,p:CityParcel,start:number):void {
  const plan=catalogPlan(p.assetId!),z=-(p.s-start);
  ground(b,m,p,z,plan);
  for(const t of plan.volumes) {
    volume(b.silhouette,t.role==='core'?m.dark:t.role==='bridge'?m.glass:m.facades[(plan.facade+(plan.asset.id===100?plan.volumes.indexOf(t)%3:0))%m.facades.length],p,z,t);
    if(t.role==='bridge') {
      b.silhouette.box(m.concrete,p.x+t.x,t.base,z+t.z,t.width,.6,t.depth);
      b.relief.box(m.neutralLight,p.x+t.x,t.base+.7,z+t.z+t.depth/2+.05,t.width,.12,.12);
    }
    relief(b.relief,m,p,z,plan,t);
  }
  terraces(b,m,p,z,plan);structure(b,m,p,z,plan);rooftop(b,m,p,z,plan);advertising(b.silhouette,m,p,z,plan);
}

/** Hysteresis prevents repeated detail toggles near a boundary. No frame-rate or quality adaptation. */
export function catalogDetailVisible(tier:'near'|'mid',distance:number,visible:boolean):boolean {
  // A chunk is assembled atomically. Reveal every architectural tier while its entire plot is
  // still behind opaque mist; the 160 m margin covers the plot diagonal and LOD hysteresis.
  const limit=CITY_MIST_END+(tier==='near'?160:360);
  return distance<limit+(visible?35:-35);
}

/** Far skyline templates keep the authored massing and crowns, without constructing retail interiors. */
export function buildCatalogSilhouette(b:UrbanBatch,m:CityMaterials,p:CityParcel):void {
  const plan=catalogPlan(p.assetId!),z=0;
  b.box(m.dark,0,plan.podium/2,z,plan.asset.width,plan.podium,plan.asset.depth);
  for(const t of plan.volumes)volume(b,t.role==='core'?m.dark:m.facades[plan.facade],p,z,t);
  const omitted={relief:new UrbanBatch(),street:new UrbanBatch()};
  const batches={silhouette:b,...omitted};
  structure(batches,m,p,z,plan);rooftop(batches,m,p,z,plan);
  // Roof authoring also emits tiny service details; these do not belong to the far silhouette.
  for(const batch of Object.values(omitted))for(const mesh of batch.build().children as import('three').Mesh[])mesh.geometry.dispose();
}
