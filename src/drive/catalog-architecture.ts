import { buildingAsset, type BuildingAsset } from './building-catalog';

export type Profile = 'box'|'round'|'corner'|'pentagon'|'hex'|'octagon'|'triangle'|'crescent'|'sail'|'slant'|'shell';
export interface CatalogVolume {
  profile:Profile; x:number; z:number; width:number; depth:number; base:number; height:number;
  topScale:number; angle:number; role:'glass'|'core'|'bridge';
}
export interface CatalogPlan {
  asset:BuildingAsset; podium:number; volumes:CatalogVolume[]; terraces:number[];
  roofHeight:number; facade:number; advertisement:number|null;
}
/** Authored massing, in actual metres. Each case corresponds to one named production asset.
 * Fractions are relative to that asset's footprint and occupied tower height, never the parcel. */
export function catalogPlan(id:number):CatalogPlan {
  const asset=buildingAsset(id), w=asset.width,d=asset.depth;
  const podiumFloors:Record<number,number>={1:2,3:3,4:3,5:6,9:2,10:4,14:8,28:5,36:5,48:4,51:5,52:4,58:4,70:6,71:5,74:4,81:6,82:4,90:4,93:5,96:4,98:4,100:6};
  const podium=Math.min(asset.height*.4,(podiumFloors[id]??2)*4.1);
  const roofHeight=asset.roof==='spire'?(id>=81?28:15):asset.roof==='ring'?12:asset.roof==='lantern'?9:6;
  const h=asset.height-podium-roofHeight, volumes:CatalogVolume[]=[],terraces:number[]=[];
  const P=(profile:Profile,x:number,z:number,width:number,depth:number,base=0,end=1,topScale=1,angle=0,role:CatalogVolume['role']='glass')=>{
    volumes.push({profile,x:x*w,z:z*d,width:width*w,depth:depth*d,base:podium+base*h,height:(end-base)*h,topScale,angle,role});
  };
  const B=(x=0,z=0,width=1,depth=1,base=0,end=1)=>P('box',x,z,width,depth,base,end);
  const bridge=(y:number,width=.32,depth=.42,x=0,z=0,thickness=.035)=>P('box',x,z,width,depth,y,y+thickness,1,0,'bridge');
  const split=(gap:number,left=1,right=.86,profile:Profile='box')=>{P(profile,-(.25+gap/4),0,.5-gap/2,1,0,left);P(profile,.25+gap/4,0,.5-gap/2,.92,0,right);};
  switch(id) {
    case 1: P('corner',0,0,1,1,0,.83);P('corner',0,0,.9,.9,.83,1);break;
    case 2: P('pentagon',0,0,1,1,0,.75);P('pentagon',0,0,.76,.8,.75,1);break;
    case 3: B(0,0,1,1,0,.32);B(.07,-.07,.86,.86,.32,.69);B(.14,-.14,.72,.72,.69,1);terraces.push(.32,.69);break;
    case 4: P('sail',-.25,0,.46,1,0,1,.65);P('sail',.25,.07,.46,.86,0,.88,.72);P('box',0,0,.1,.55,0,.84,1,0,'core');break;
    case 5: P('octagon',0,0,1,1,0,.82);P('box',-.19,.08,.55,.78,.82,1);P('slant',.31,.08,.25,.82,.12,.8,1,.08,'core');break;
    case 6: for(let i=0;i<5;i++)B(0,0,1,1,i*.2,i*.2+.19);P('box',0,-.08,.32,.3,0,.99,1,0,'core');break;
    case 7: P('hex',0,0,1,1,0,.23);P('hex',0,-.1,1,.8,.23,.88);B(-.29,.34,.28,.3,.23,.88);B(.29,.34,.28,.3,.23,.88);P('hex',0,0,1,1,.88,1);break;
    case 8: B(-.34,0,.32,1);B(.34,0,.32,1,0,.94);B(0,-.32,.36,.36);B(0,.06,.36,.88,.37,1);for(const y of [.12,.24,.35])bridge(y,.4,.5);break;
    case 9: B(0,-.04,1,.86,0,.88);for(const x of [-.32,0,.32])B(x,.43,.2,.14,0,.88);B(.04,-.08,.82,.78,.88,1);break;
    case 10: B(0,0,1,1,0,.85);P('octagon',0,0,.95,.95,.85,.93);P('octagon',0,0,.83,.83,.93,1,.78);break;
    case 11: B(0,-.11,1,.78);B(-.4,.36,.2,.28);B(.4,.36,.2,.28);B(0,.36,.6,.28,.62,1);break;
    case 12: B(.08,-.04,.84,.82);P('box',-.42,0,.14,.8,0,1,1,0,'core');for(let i=0;i<4;i++)B(-.24,.39,.5,.22,.15+i*.2,.18+i*.2);break;
    case 13: B(-.19,0,.62,1,0,.55);B(.31,-.1,.38,.8,0,.8);B(-.28,-.08,.44,.84,.55,1);terraces.push(.55,.8);break;
    case 14: B(0,0,.9,.86,0,.06);B(.13,-.06,.4,.58,.06,1);B(-.27,.07,.36,.78,0,.16);break;
    case 15: P('pentagon',-.14,.02,.72,.96,0,.65);B(.33,-.2,.34,.6,0,1);B(-.18,-.08,.54,.6,.65,.84);break;
    case 16: B(.05,-.08,.78,.84,.18,1);for(let i=0;i<5;i++)B(-.08+i*.025,0,1-i*.08,1-i*.04,i*.036,(i+1)*.036);for(let i=0;i<4;i++)B(-.39,.28,.18,.4,.27+i*.18,.3+i*.18);break;
    case 17: split(.22);for(const y of [.23,.49,.72])bridge(y,.36,.55,0,-.06);break;
    case 18: B(-.31,0,.38,1,0,.73);B(.1,-.16,.44,.68,0,1);P('pentagon',.35,.14,.3,.68,0,.55);break;
    case 19: B(-.36,0,.28,1);B(.36,0,.28,1);B(0,-.24,.44,.52,0,.92);bridge(.9,.5,.38);break;
    case 20: B(0,-.05,.82,.86);for(let i=0;i<6;i++)B(i%2?.33:-.33,.3,.34,.4,.06+i*.14,.15+i*.14);break;
    case 21: P('octagon',0,0,.88,.88,0,.2);B(-.03,0,1,.98,.2,.52);B(.09,-.08,.82,.78,.52,1);break;
    case 22: B(.06,-.03,.88,.94);B(-.35,.36,.22,.28,.13,.83);break;
    case 23: for(let i=0;i<4;i++)B((i%2)*.04,-i*.035,1-i*.07,1-i*.07,i*.25,(i+1)*.25);terraces.push(.25,.5,.75);break;
    case 24: B(0,-.06,.88,.86);for(let i=0;i<6;i++)B(i%2?.34:-.34,.38,.24,.24,.1+i*.13,.14+i*.13);break;
    case 25: P('pentagon',-.12,.06,.76,.88,0,.78);B(.37,-.12,.26,.76,0,1);break;
    case 26: P('box',.36,-.32,.2,.32,0,1,1,0,'core');break; // Open slabs and ramps are built separately.
    case 27: B(0,0,1,1,0,.65);B(.08,-.08,.84,.84,.65,.84);B(.16,-.16,.68,.68,.84,1);P('box',-.4,-.27,.17,.42,0,1,1,0,'core');terraces.push(.65,.84);break;
    case 28: B(-.04,0,.85,.96);B(.41,-.05,.12,.74,0,.94);break;
    case 29: B(0,0,1,1,0,.28);B(.11,-.06,.78,.88,.28,.62);B(-.03,-.19,.5,.6,.62,1);terraces.push(.28,.62);break;
    case 30: B(.06,-.06,.82,.88);B(-.36,.27,.26,.46,0,.94);B(.18,-.2,.42,.46,1,1.04);break;
    case 31: B(0,0,.82,.84);for(let i=0;i<8;i++)B(i%2?.4:-.4,0,.2,.86,.03+i*.12,.045+i*.12);break;
    case 32: B(-.3,0,.4,1,0,.85);B(.3,0,.4,1,0,.85);B(0,-.18,.2,.64,0,.85);B(.05,-.12,.76,.76,.85,1);terraces.push(.85);break;
    case 33: B(-.34,0,.32,1,0,.9);B(.34,0,.32,1);B(0,-.34,.36,.32,0,.81);terraces.push(.02,.81);break;
    case 34: split(.19,1,.95);bridge(.54,.3,.68,0,0,.1);break;
    case 35: P('box',0,-.12,.56,.66,0,1,1,0,'core');for(let i=0;i<9;i++)B(i%2?.14:-.14,(i%3-1)*.05,.7,.76,i/9,(i+1)/9);break;
    case 36: B(-.29,-.04,.4,.78,0,1);B(.29,.12,.4,.76,0,.85);bridge(.42,.3,.42);terraces.push(.03,.42,.85);break;
    case 37: B(0,-.07,.58,.86,0,.8);for(const x of [-.37,.37])B(x,.03,.26,.92,0,.8);B(0,-.08,.68,.72,.8,1);break;
    case 38: P('round',0,0,.88,.88,0,1);for(const y of [.24,.53,.79])P('round',0,0,1,1,y,y+.03);terraces.push(.24,.53,.79);break;
    case 39: B(-.29,0,.42,.92);B(.29,0,.42,.92);P('box',0,-.04,.16,1,0,1,1,0,'core');for(const y of [.3,.64])bridge(y,.84,1,0,0,.05);break;
    case 40: B(0,0,1,1,0,.48);B(.09,-.03,.82,.88,.52,1);P('box',0,-.2,.6,.5,.48,.52,1,0,'core');terraces.push(.48);break;
    case 41: P('slant',0,0,.7,.92,0,1,.78,.12);break;
    case 42: B(0,0,.68,.66,0,.94);for(const x of [-.4,.4])for(const z of [-.37,.37])P('box',x,z,.2,.26,0,1,1,0,'core');break;
    case 43: P('box',.33,-.03,.34,.94,0,1,1,0,'core');B(-.17,0,.66,.94);for(const y of [.2,.43,.67,.88])P('box',-.17,0,.67,.98,y,y+.035,1,0,'core');break;
    case 44: B(-.27,.13,.46,.74,0,.92);B(.27,-.13,.46,.74);bridge(.4,.16,.5);bridge(.74,.16,.5);break;
    case 45: B(0,0,.36,1);B(0,0,1,.36,0,.93);break;
    case 46: P('round',-.28,0,.42,.96,0,.87);P('round',.28,-.04,.42,.88,0,1);B(0,-.24,.18,.48,0,.92);for(const y of [.28,.61])bridge(y,.9,.95,0,0,.04);break;
    case 47: B(0,-.1,.56,.8);B(-.38,.02,.24,.96);B(.38,-.06,.24,.88,0,.95);B(-.17,.37,.14,.26,0,.85);B(.18,.34,.16,.28,0,.93);break;
    case 48: B(-.32,.03,.36,.94,0,.83);B(.02,-.08,.32,.78);B(.34,-.02,.32,.84,0,.91);break;
    case 49: for(let i=0;i<6;i++)B((i%2?.06:-.06),(i%3-1)*.055,.88,.85,i/6,(i+1)/6);terraces.push(1/6,3/6,5/6);break;
    case 50: B(0,0,.83,.83,0,.96);P('box',0,0,.34,.34,.96,1,1,0,'core');break; // Diagonal load-bearing frame stays in every LOD.
    case 51: P('corner',0,-.06,1,.88);B(-.36,.4,.28,.2,0,.5);B(.36,.4,.28,.2,0,.5);break;
    case 52: P('round',-.19,0,.62,1,0,.95);P('round',.32,-.05,.36,.9,0,1);terraces.push(.1);break;
    case 53: P('shell',-.2,.13,.6,.74,0,.63);P('shell',.08,.04,.56,.86,0,.76);P('shell',.31,.09,.38,.76,0,.52);B(.17,-.4,.6,.2,0,1);break;
    case 54: B(-.31,0,.38,1);B(.3,0,.4,1,0,.92);B(0,-.26,.22,.48,0,.86);for(const y of [.23,.4,.57])B(-.12,.41,.6,.18,y,y+.03);break;
    case 55: P('round',0,-.15,1,.7,0,.7);P('round',0,.11,.5,.7,0,1);break;
    case 56: P('octagon',0,.02,1,.96,0,.57);P('round',0,.02,.67,.68,.57,.82);B(.34,-.31,.25,.32,0,1);terraces.push(.57);break;
    case 57: P('round',0,.08,1,.84,0,.55);B(-.19,-.15,.62,.64,.55,.83);B(.23,-.2,.45,.6,.55,1);break;
    case 58: for(let i=0;i<4;i++)B(0,0,.88,.88,i*.25,i*.25+.22);P('box',0,-.18,.42,.4,0,.99,1,0,'core');terraces.push(.22,.47,.72);break;
    case 59: P('crescent',0,0,1,1,0,.92);P('round',-.31,-.04,.32,.63,0,1);break;
    case 60: B(-.27,-.05,.46,.9,0,.76);B(.28,-.16,.44,.68,0,.94);B(.02,-.06,.56,.87,.68,1);bridge(.55,.18,.38,0,-.2);break;
    case 61: B(0,0,.78,.84,0,.88);P('box',-.43,-.2,.14,.6,0,1,1,0,'core');B(.43,.15,.14,.66,0,.65);break;
    case 62: P('box',-.26,0,.48,.92,0,.84,1,0,'core');P('box',.24,-.12,.46,.76,0,1,1,0,'core');B(.2,.38,.5,.24,0,.65);break;
    case 63: B(0,0,.8,.82);P('box',-.46,.15,.08,.62,0,.92,1,0,'core');P('box',.46,-.13,.08,.62,0,.89,1,0,'core');bridge(.45,1,.14);break;
    case 64: for(let i=0;i<3;i++)B((i%2)*.1,-i*.04,.75,.86,i/3,(i+1)/3);P('box',-.43,0,.14,.92,0,1,1,0,'core');break;
    case 65: P('box',0,.15,.9,.7,0,.8,1,0,'core');for(const x of [-.28,.28])P('round',x,-.31,.35,.35,0,1,1,0,'core');break;
    case 66: B(0,-.07,.84,.86);for(const y of [.2,.48,.76])B(0,.35,1,.3,y,y+.025);break;
    case 67: B(.3,-.2,.38,.6,0,1);B(-.2,-.1,.6,.8,0,.5);B(-.2,-.1,.6,.8,.55,.63);B(-.2,-.1,.6,.8,.78,.86);break;
    case 68: B(0,-.1,.64,.8);P('box',-.42,0,.16,1,0,.95,1,0,'core');P('box',.42,0,.16,1,0,.95,1,0,'core');break;
    case 69: P('box',-.36,0,.28,1,0,1,1,0,'core');P('box',.36,0,.28,1,0,.93,1,0,'core');B(0,-.15,.44,.7,0,.91);break;
    case 70: B(0,-.06,.7,.74,0,1);P('box',-.42,.08,.14,.82,0,.32,1,0,'core');B(.4,.12,.2,.76,0,.5);break;
    case 71: B(-.19,-.06,.44,.7);B(.25,-.04,.4,.74,0,.81);B(0,.32,.88,.2,0,.12);break;
    case 72: B(0,-.18,.94,.64,0,.94);B(-.33,.27,.34,.46,0,1);B(.33,.27,.34,.46,0,.86);bridge(.3,1,.6);bridge(.62,1,.6);break;
    case 73: P('pentagon',0,0,.92,.9,0,.92);P('box',.33,-.22,.22,.42,0,1,1,0,'core');break;
    case 74: B(-.05,-.02,.86,.82,0,.86);B(.23,-.08,.54,.7,.86,1);B(-.42,.14,.16,.72,0,.35);break;
    case 75: B(0,-.2,.44,.6);B(-.34,.06,.32,.88,0,.9);B(.34,.06,.32,.88,0,.86);bridge(.33,.88,.26,0,.3);bridge(.69,.88,.26,0,.3);break;
    case 76: for(let i=0;i<4;i++)B(i%2?.035:-.035,-i*.025,.92-i*.08,.94-i*.04,i/4,(i+1)/4);terraces.push(.25,.75);break;
    case 77: B(-.32,0,.36,.92);B(.3,-.04,.4,.84,0,.81);B(0,-.29,.28,.34,0,.68);bridge(.33,.36,.48);break;
    case 78: B(0,-.1,1,.8,0,.79);B(.2,-.12,.6,.76,.79,1);B(-.4,.3,.2,.4,0,.55);break;
    case 79: B(0,0,.78,.78,0,.82);B(0,0,1,1,.82,.94);B(0,0,.56,.56,.94,1);break;
    case 80: B(0,0,.8,.78,0,.86);P('round',0,0,1.22,1.16,.86,.97);P('round',0,0,.96,.94,.97,1);break;
    case 81: B(0,0,1,1,0,.74);for(let i=0;i<4;i++)P('box',0,0,.88-i*.17,.88-i*.17,.74+i*.065,.805+i*.065,.82);break;
    case 82: split(.19,1,.94,'slant');bridge(.07,.32,.62,0,0,.05);break;
    case 83: B(0,-.11,1,.78);B(-.36,.39,.28,.22);B(.36,.39,.28,.22);B(0,.39,.44,.22,0,.12);bridge(.95,.5,.28,0,.36);break;
    case 84: B(0,0,1,1,0,.68);for(let i=0;i<5;i++)B(i*.045,-i*.045,1-i*.13,1-i*.13,.68+i*.064,.744+i*.064);break;
    case 85: B(0,0,.65,.65);for(let i=0;i<9;i++)for(let j=0;j<4;j++){const a=i*.055+j*Math.PI/2;P('box',Math.cos(a)*.35,Math.sin(a)*.35,.13,.3,i/9,(i+1)/9,1,-a,'core');}break;
    case 86: B(0,0,.82,.84,0,.77);B(.04,0,.66,.7,.77,.9);B(.04,0,.46,.5,.9,1);for(const x of [-.45,.45])P('box',x,0,.1,.92,0,.77,1,0,'core');break;
    case 87: P('triangle',0,0,1,1,0,.78,.78);P('triangle',0,0,.78,.78,.78,1,.12);break;
    case 88: B(0,0,1,1,0,.49);B(-.33,0,.34,1,.49,1);B(.33,0,.34,1,.49,.96);B(0,-.4,.32,.2,.49,.94);break;
    case 89: P('pentagon',0,0,.66,.78);P('pentagon',-.33,.04,.34,.92,0,.92);P('pentagon',.33,-.04,.34,.92,0,.97);B(.27,.4,.28,.2,.73,.83);break;
    case 90: P('octagon',-.29,0,.42,1,0,1);for(let i=0;i<3;i++)B(.29+i*.02,0,.42-i*.04,1-i*.1,i/3,(i+1)/3*.95);bridge(.64,.3,.72,0,0,.07);break;
    case 91: B(0,0,.78,.8);for(let i=0;i<7;i++){B(i%2?.4:-.4,0,.2,.94,.04+i*.13,.06+i*.13);terraces.push(.06+i*.13);}break;
    case 92: B(-.31,0,.38,1);B(.31,0,.38,1);B(0,-.28,.24,.44,0,.95);P('box',0,-.04,.13,.1,0,.98,1,0,'core');break;
    case 93: B(-.18,-.12,.56,.72,0,.76);B(.28,-.1,.4,.76,0,1);B(0,.1,1,.8,0,.025);terraces.push(.025,.76);break;
    case 94: P('crescent',0,0,1,1,0,1,.91);break;
    case 95: P('pentagon',-.29,.05,.42,.9,0,1);P('pentagon',.29,-.05,.42,.9,0,.94);for(const y of [.19,.44,.7,.88])bridge(y,.24,.5,0,-.02);break;
    case 96: B(0,0,1,1,0,.95);B(0,0,.58,.58,.95,1);break;
    case 97: for(let i=0;i<3;i++)B((i-1)*.08,-i*.03,.84,.84,i/3,i/3+.28);P('box',0,-.17,.4,.4,0,1,1,0,'core');terraces.push(.28,.613,.946);break;
    case 98: B(0,0,.82,.82,0,.77);B(0,0,.66,.66,.77,.88);B(0,0,.48,.48,.88,.96);P('round',0,0,.9,.9,.96,1);break;
    case 99: B(-.35,0,.3,1,0,.93);B(.35,0,.3,1);B(0,-.24,.4,.52,0,.96);bridge(.82,.46,.42,0,-.04);break;
    case 100: B(0,-.13,.3,.5);P('slant',-.32,.08,.28,.62,0,.77,1,.15);P('slant',.32,.05,.28,.64,0,.88,1,-.15);for(const y of [.25,.53,.7]){bridge(y,.34,.24,-.16);bridge(y+.04,.34,.24,.16);}terraces.push(.25,.53,.74);break;
  }
  const facade=asset.district===4?1:asset.district===7?2:asset.district===3?2:id%3===0?3:0;
  const advertisement=(asset.district===2||asset.district===6)?(id===51?1:[11,19].includes(id)?0:id===13?2:id%5):null;
  return {asset,podium,volumes,terraces,roofHeight,facade,advertisement};
}

/** Horizontal contours are real polygons, including the concave crescent and the single curved corner. */
export function profileContour(profile:Profile):[number,number][] {
  if(profile==='triangle')return [[-.5,-.5],[0,-.54],[.5,-.5],[.3,.02],[0,.5],[-.3,.02]];
  if(profile==='pentagon')return [[-.5,-.5],[.5,-.5],[.5,.15],[0,.5],[-.5,.15]];
  if(profile==='hex')return [[-.5,0],[-.28,-.5],[.28,-.5],[.5,0],[.28,.5],[-.28,.5]];
  if(profile==='octagon')return [[-.32,-.5],[.32,-.5],[.5,-.32],[.5,.32],[.32,.5],[-.32,.5],[-.5,.32],[-.5,-.32]];
  if(profile==='crescent') {
    const p:[number,number][]=[];
    for(let i=0;i<=14;i++){const a=Math.PI*i/14;p.push([Math.cos(a)*.5,Math.sin(a)*.72-.36]);}
    for(let i=14;i>=0;i--){const a=Math.PI*i/14;p.push([Math.cos(a)*.46,Math.sin(a)*.42-.36]);}return p;
  }
  if(profile==='corner') {
    const p:[number,number][]=[[-.5,-.5],[.5,-.5],[.5,.05]];
    for(let i=1;i<=8;i++){const a=i*Math.PI/16;p.push([.05+Math.cos(a)*.45,.05+Math.sin(a)*.45]);}p.push([-.5,.5]);return p;
  }
  if(profile==='round'||profile==='sail'||profile==='shell')return Array.from({length:20},(_,i)=>{const a=i*Math.PI/10;return [Math.cos(a)*.5,Math.sin(a)*.5];});
  return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
}
