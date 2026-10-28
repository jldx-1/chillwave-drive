import { buildingAsset,type GroundUse } from './building-catalog';
export interface FrontageBay {use:GroundUse;center:number;width:number}
/** Actual mixed-use frontage: lobbies, cafes and independent shops can share the same podium. */
export function catalogFrontage(id:number,length:number):FrontageBay[] {
  const a=buildingAsset(id);
  let schedule:readonly (readonly [GroundUse,number])[];
  if([1,6,7,10,45,49,81,96,98].includes(id))schedule=[['retail',.22],['office',.56],['retail',.22]];
  else if([24,28,52,58,59].includes(id))schedule=[['restaurant',.26],['hotel',.54],['retail',.2]];
  else if([31,32,36,38,40,91].includes(id))schedule=[['retail',.26],['residential',.5],['restaurant',.24]];
  else if(id===75)schedule=[['service',.28],['civic',.52],['civic',.2]];
  else if(id===97||id===100)schedule=[['restaurant',.22],['mall',.56],['retail',.22]];
  else {
    const use=a.ground;
    const count=id===9?6:id===11?3:use==='service'||use==='parking'?Math.max(2,Math.floor(length/10)):use==='retail'?Math.max(3,Math.floor(length/8)):use==='arcade'?Math.max(4,Math.floor(length/7)):['mall','cinema','station'].includes(use)?3:use==='restaurant'?2:1;
    // Slightly different shop widths break the uniform-bay pattern without randomizing architecture each drive.
    const weights=Array.from({length:count},(_,i)=>1+((id+i*3)%5-2)*.07),total=weights.reduce((a,b)=>a+b,0);
    schedule=weights.map(weight=>[use,weight/total]as const);
  }
  let cursor=-length/2;
  return schedule.map(([use,ratio])=>{const width=ratio*length,bay={use,width,center:cursor+width/2};cursor+=width;return bay;});
}

export function catalogEntryHeight(use:GroundUse,podium:number):number {
  return Math.min(podium-.4,['mall','cinema','civic','office','station'].includes(use)?7.6:use==='hotel'?6.8:4.1);
}
