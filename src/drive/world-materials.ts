import * as THREE from 'three';
import { Random } from '../core/random';
import { neonSigns } from './neon-signs';
import type { UVRect } from './world-geometry';
const canvas = (size: number) => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
function texture(c: HTMLCanvasElement): THREE.CanvasTexture { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function mineral(seed: number, color: string, brick = false): THREE.MeshStandardMaterial {
  const c = canvas(256), n = canvas(256), rough = canvas(256), ctx = c.getContext('2d')!, normal = n.getContext('2d')!, rctx = rough.getContext('2d')!, r = new Random(seed);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256); normal.fillStyle = '#8080ff'; normal.fillRect(0, 0, 256, 256); rctx.fillStyle = '#c7c7c7'; rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1700; i++) { const x = r.range(0, 256), y = r.range(0, 256), shade = r.next() > .5 ? '#ffffff0a' : '#0000000c'; ctx.fillStyle = shade; ctx.fillRect(x, y, r.range(.5, 3), r.range(.5, 3)); }
  if (brick) for (let y = 0; y < 256; y += 16) { ctx.fillStyle = '#77736c'; ctx.fillRect(0, y, 256, 1); normal.fillStyle = '#8080df'; normal.fillRect(0, y, 256, 1); for (let x = y % 32 ? -16 : 0; x < 256; x += 32) ctx.fillRect(x, y, 1, 16); }
  const m = new THREE.MeshStandardMaterial({ map: texture(c), normalMap: texture(n), roughnessMap: texture(rough), roughness: .86, metalness: .03 });
  m.normalMap!.colorSpace = THREE.NoColorSpace; m.roughnessMap!.colorSpace = THREE.NoColorSpace; m.normalScale.set(.15, .15); return m;
}
function facade(seed: number, tint: string, masonry: boolean, apartments=false): THREE.MeshStandardMaterial {
  const c = canvas(1024), e = canvas(1024), n = canvas(1024), rough = canvas(1024), a = c.getContext('2d')!, em = e.getContext('2d')!, normal = n.getContext('2d')!, ro = rough.getContext('2d')!, r = new Random(seed);
  a.fillStyle = tint; a.fillRect(0, 0, 1024, 1024); em.fillStyle = '#000'; em.fillRect(0, 0, 1024, 1024); normal.fillStyle = '#8080ff'; normal.fillRect(0, 0, 1024, 1024); ro.fillStyle = masonry ? '#b4b4b4' : '#606060'; ro.fillRect(0, 0, 1024, 1024);
  const occupied = Array.from({length:8},()=>r.next()>.48);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const px = x * 128, py = y * 128, margin = masonry ? 26 : 5, w = 128 - margin * 2, top = masonry ? 16 : 5, h = masonry ? 88 : 117;
    const lit = r.next() > (apartments ? .57 : occupied[y] ? .34 : .94), warm = r.next() > (apartments ? .1 : .32);
    const gradient = a.createLinearGradient(px, py, px + 120, py + 128);
    gradient.addColorStop(0, lit ? warm ? '#8e877d' : '#708a9f' : masonry ? '#15233f' : '#102942');
    gradient.addColorStop(.5, lit ? '#394c72' : '#0e1d35'); gradient.addColorStop(1, '#080e24');
    a.fillStyle = '#1d2930'; a.fillRect(px + margin - 2, py + top - 2, w + 4, h + 4); a.fillStyle = gradient; a.fillRect(px + margin, py + top, w, h);
    a.fillStyle = '#101c2588'; a.fillRect(px + 63, py + top, 2, h); a.fillRect(px + margin, py + 78, w, 2);
    if (r.next() > .65) { a.fillStyle = '#c8c7bb22'; a.fillRect(px + margin, py + top + 2, w, 15 + r.next() * 30); }
    a.fillStyle = '#d8d9cb44'; a.fillRect(px + margin - 2, py + top - 2, w + 4, 2);
    normal.fillStyle = '#7d84ef'; normal.fillRect(px + margin - 2, py + top - 2, w + 4, 2); ro.fillStyle = '#555555'; ro.fillRect(px + margin, py + top, w, h);
    if (lit) { em.fillStyle = warm ? '#b9966f' : x % 3 === 0 ? '#c8dce1' : '#659eb7'; em.fillRect(px + margin + 2, py + top + 2, w - 4, h - 4); em.fillStyle = '#000'; em.fillRect(px + 63, py + top, 2, h); em.fillRect(px + margin, py + 78, w, 2); }
  }
  const m = new THREE.MeshStandardMaterial({ map: texture(c), emissiveMap: texture(e), emissive: '#ffffff', emissiveIntensity: .4, normalMap: texture(n), roughnessMap: texture(rough), roughness: masonry ? .8 : .46, metalness: masonry ? .05 : .28 });
  m.normalMap!.colorSpace = m.roughnessMap!.colorSpace = THREE.NoColorSpace; m.normalScale.set(.24, .24); m.userData.facade = true; return m;
}
/** Irregular leaf clusters retain fine silhouette detail rather than spherical tree crowns. */
function foliageMaterial(): THREE.MeshStandardMaterial {
  const c = canvas(512), a = c.getContext('2d')!, r = new Random(2084);
  a.clearRect(0, 0, 512, 512);
  const centers = [[245, 130, 105], [155, 195, 98], [335, 205, 110], [210, 280, 125], [327, 300, 95], [133, 290, 72]];
  for (const [x, y, radius] of centers) for (let i = 0; i < 1700; i++) {
    const angle = r.range(0, Math.PI * 2), length = Math.sqrt(r.next()) * radius;
    const px = x + Math.cos(angle) * length, py = y + Math.sin(angle) * length;
    a.fillStyle = ['#311749', '#632253', '#9b3578', '#d45caa', '#ed8ecf'][Math.floor(r.next() * 5)];
    a.beginPath(); a.ellipse(px, py, r.range(1.5, 4), r.range(2, 5.5), r.range(0, Math.PI), 0, Math.PI * 2); a.fill();
  }
  const map = texture(c); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#bc438f', emissiveIntensity: .045, alphaTest: .48, side: THREE.DoubleSide, roughness: .98, metalness: 0 });
}
const signs = ['AFTERGLOW MARKET', 'LUMEN COFFEE', 'NOVA HOTEL', 'CITY PHARMACY', 'METRO PARK', 'NORTHLINE STUDIO', 'SUNSET DINER', 'EASTSIDE SERVICE', 'URBAN OUTFITTER', 'FRESH MARKET', 'POLARIS BANK', 'CORNER BOOKS', 'PACIFIC LOGISTICS', 'WAREHOUSE 09', 'DELIVERY ENTRANCE', '24 HOUR FUEL', 'SUNSET EXPRESSWAY', 'CITY CENTER', 'EXIT / SERVICE', 'MERGE LEFT', 'PARKING', 'LOADING ONLY', 'NORTHLINE AVENUE', 'SERVICE ROAD'];
export class CityMaterials {
  readonly concrete = mineral(11, '#626673');
  readonly pavement = mineral(12, '#454958');
  readonly masonry = mineral(13, '#30304d', true);
  readonly terrain = mineral(14, '#151827');
  readonly road = new THREE.MeshStandardMaterial({ color: '#111b31', roughness: .58, metalness: .07 });
  readonly dark = new THREE.MeshStandardMaterial({ color: '#202938', roughness: .53, metalness: .35 });
  readonly steel = new THREE.MeshStandardMaterial({ color: '#6a788b', roughness: .4, metalness: .75 });
  readonly glass = new THREE.MeshStandardMaterial({ color: '#193e63', roughness: .24, metalness: .45 });
  readonly white = new THREE.MeshStandardMaterial({ color: '#e3dfcf', roughness: .66 });
  readonly amber = new THREE.MeshStandardMaterial({ color: '#e8b96b', emissive: '#d5a05e', emissiveIntensity: .28, roughness: .65 });
  readonly roadWhite = new THREE.MeshStandardMaterial({ color:'#bfd9eb', emissive:'#3a7192', emissiveIntensity:.35, roughness:.55, metalness:.03, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  readonly roadAmber = new THREE.MeshStandardMaterial({ color:'#c4a05d', roughness:.75, metalness:.03, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  readonly light = new THREE.MeshStandardMaterial({ color: '#ffd4a0', emissive: '#ffb365', emissiveIntensity: 3, roughness: .5 });
  readonly leaf = foliageMaterial();
  readonly landscape = new THREE.MeshStandardMaterial({ color: '#462343', roughness: .96 });
  readonly bark = new THREE.MeshStandardMaterial({ color: '#38263f', roughness: .95 });
  readonly trim = new THREE.MeshStandardMaterial({color:'#888c8e',roughness:.34,metalness:.78});
  readonly shopGlass = new THREE.MeshStandardMaterial({color:'#87bad1',roughness:.14,metalness:.28,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  readonly interior = new THREE.MeshStandardMaterial({color:'#928675',roughness:.78,emissive:'#9e7650',emissiveIntensity:.13});
  readonly neutralLight = new THREE.MeshStandardMaterial({color:'#dce4e7',emissive:'#c0d9e8',emissiveIntensity:1.65,roughness:.4});
  readonly palmLeaf = new THREE.MeshStandardMaterial({color:'#314a45',roughness:.76,side:THREE.DoubleSide});
  readonly leaves: THREE.MeshStandardMaterial[] = [];
  readonly facades = [facade(43, '#11243e', false), facade(76, '#26223b', true, true), facade(18, '#24263e', true), facade(31, '#172e49', false)];
  readonly cyan = new THREE.MeshStandardMaterial({ color:'#1eb5e6', emissive:'#05beff', emissiveIntensity:3, roughness:.3 });
  readonly pink = new THREE.MeshStandardMaterial({ color:'#e82caa', emissive:'#ff13ad', emissiveIntensity:3, roughness:.3 });
  readonly violet = new THREE.MeshStandardMaterial({ color:'#7055eb', emissive:'#6840ff', emissiveIntensity:2.5, roughness:.3 });
  readonly ad: THREE.MeshBasicMaterial;
  readonly adRects: UVRect[];
  readonly sign: THREE.MeshStandardMaterial;
  readonly signRects: UVRect[] = [];
  constructor() {
    for (const color of ['#b69acb','#f2b2cc','#d6b2d4']) { const leaf=this.leaf.clone(); leaf.color.set(color); this.leaves.push(leaf); }
    const ads = neonSigns(); this.adRects = ads.rects; this.ad = new THREE.MeshBasicMaterial({map:ads.map, color:new THREE.Color(1.5,1.5,1.5)});
    const c = canvas(1024), a = c.getContext('2d')!;
    a.fillStyle = '#173f42'; a.fillRect(0, 0, 1024, 1024);
    signs.forEach((label, i) => { const x = (i % 4) * 256, y = Math.floor(i / 4) * 128; a.fillStyle = i < 16 ? ['#102b43', '#301338', '#151e43', '#342137'][i % 4] : '#24514c'; a.fillRect(x, y, 256, 128); a.strokeStyle = '#c8d6c2'; a.lineWidth = 2; a.strokeRect(x + 7, y + 11, 242, 106); a.fillStyle = '#e3e3cc'; a.font = `600 ${label.length > 17 ? 16 : 20}px sans-serif`; a.textAlign = 'center'; a.fillText(label, x + 128, y + 73, 234); this.signRects.push([x / 1024, 1 - (y + 128) / 1024, .25, .125]); });
    const map = texture(c); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; this.sign = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 1.2, roughness: .57 });
    for(const material of [this.shopGlass,this.palmLeaf,this.neutralLight,...this.leaves]) material.userData.castShadow=false;
    for (const m of [this.cyan, this.pink, this.violet]) { m.polygonOffset=true; m.polygonOffsetFactor=-1; m.polygonOffsetUnits=-1; }
    for (const m of [this.terrain, this.road, this.pavement, this.sign, this.leaf, this.landscape, this.roadWhite, this.roadAmber, this.cyan, this.pink, this.violet]) m.userData.castShadow = false;
  }
  dispose(): void {
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    for (const value of Object.values(this)) if (value instanceof THREE.Material) materials.add(value); else if (Array.isArray(value)) for (const m of value) if (m instanceof THREE.Material) materials.add(m);
    for (const m of materials) { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); } for (const t of textures) t.dispose();
  }
}
