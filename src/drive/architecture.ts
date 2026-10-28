import type { CityParcel } from './world-layout';

export interface TowerVolume {
  shape: 'box' | 'round' | 'taper'; x: number; z: number; width: number; depth: number; base: number; height: number; topScale: number;
}
export interface TowerPlan { name: string; podium: number; volumes: TowerVolume[]; crown: 'spire' | 'frame' | 'offset' }
/** Ten distinct massing arrangements, independent of facade color and neon. */
export function towerPlan(p: CityParcel): TowerPlan {
  const variant = p.seed % 2, w = p.width, d = p.depth, podium = p.row === 0 ? 11 + p.seed % 3 * 3.4 : 8;
  const h = p.height - podium, volumes: TowerVolume[] = [];
  const add = (shape: TowerVolume['shape'], x: number, z: number, width: number, depth: number, base: number, height: number, topScale = 1) => volumes.push({shape,x,z,width,depth,base,height,topScale});
  let name: string, crown: TowerPlan['crown'] = 'frame';
  if (p.style === 'rounded') {
    name = variant ? 'curved-twin' : 'oval-atrium';
    if (variant) {
      add('round', -w*.22, -d*.1, w*.43, d*.7, podium, h);
      add('round', w*.22, d*.1, w*.43, d*.74, podium, h*.76);
      add('box', 0, 0, w*.27, d*.42, podium+h*.43, h*.12);
    } else { add('round', 0, 0, w*.9, d*.83, podium, h*.87); add('round', w*.08, -d*.06, w*.68, d*.64, podium+h*.87, h*.13); }
  } else if (p.style === 'stepped') {
    name = variant ? 'offset-megatower' : 'terraced-pagoda'; crown = 'offset';
    for (let i=0;i<4;i++) add('box', variant ? (i%2 ? .08 : -.02)*w : 0, variant ? -i*d*.045 : 0, w*(.95-i*.15), d*(.92-i*.13), podium+h*i/4, h/4);
  } else if (p.style === 'curtain') {
    name = variant ? 'tapered-needle' : 'split-slab'; crown = 'spire';
    if (variant) { add('box',0,0,w*.87,d*.85,podium,h*.65); add('taper',0,0,w*.87,d*.85,podium+h*.65,h*.35,.44); }
    else { add('box',-w*.24,-d*.03,w*.39,d*.83,podium,h); add('box',w*.23,d*.09,w*.39,d*.67,podium,h*.82); add('box',0,0,w*.2,d*.43,podium+h*.6,h*.13); }
  } else if (p.style === 'residential') {
    name = variant ? 'cantilever-residence' : 'terrace-court';
    if (variant) { add('box',w*.08,0,w*.67,d*.72,podium,h); add('box',-w*.2,0,w*.54,d*.88,podium+h*.37,h*.17); }
    else { add('box',-w*.25,0,w*.36,d*.88,podium,h*.83); add('box',w*.2,-d*.14,w*.5,d*.58,podium,h); add('box',0,-d*.24,w*.38,d*.32,podium,h*.38); }
  } else {
    name = variant ? 'stacked-commercial' : 'ribbed-commercial'; crown = 'offset';
    if (variant) for (let i=0;i<4;i++) add('box', (i%2 ? -.09:.08)*w, (i%2 ? .05:-.03)*d, w*(.8-i*.06), d*(.86-i*.07), podium+h*i/4, h/4);
    else { add('box',0,0,w*.72,d*.89,podium,h); add('box',-w*.36,-d*.15,w*.15,d*.55,podium,h*.73); add('box',w*.36,d*.08,w*.15,d*.58,podium,h*.92); }
  }
  return {name,podium,volumes,crown};
}
