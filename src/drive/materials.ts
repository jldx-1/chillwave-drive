import * as THREE from 'three';
import { Random } from '../core/random';
export function facadeMaterial(seed: number, color: string): THREE.MeshStandardMaterial {
  const r = new Random(seed), c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = e.width = 512; c.height = e.height = 512;
  const ctx = c.getContext('2d')!, em = e.getContext('2d')!;
  ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 512); em.fillStyle = '#000'; em.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const px = x * 128, py = y * 64;
    ctx.fillStyle = '#080f16'; ctx.fillRect(px + 13, py + 9, 102, 48);
    const lit = r.next() > .73, warm = r.next() > .4;
    const grad = ctx.createLinearGradient(0, py + 10, 0, py + 55);
    grad.addColorStop(0, lit ? (warm ? '#9e8a70' : '#768d98') : '#25323b'); grad.addColorStop(1, lit ? '#424a4e' : '#10212a');
    ctx.fillStyle = grad; ctx.fillRect(px + 17, py + 12, 94, 41);
    ctx.fillStyle = '#0a151c'; ctx.fillRect(px + 62, py + 12, 3, 41); ctx.fillRect(px + 17, py + 30, 94, 2);
    ctx.fillStyle = '#0005'; ctx.fillRect(px + 13, py + 9, 102, 4); ctx.fillStyle = '#b9c9cd33'; ctx.fillRect(px + 13, py + 56, 102, 2);
    if (lit) { em.fillStyle = warm ? '#bfa17b' : '#8eacba'; em.fillRect(px + 18, py + 13, 92, 39); em.fillStyle = '#000'; em.fillRect(px + 62, py + 13, 3, 39); }
  }
  const map = new THREE.CanvasTexture(c), emission = new THREE.CanvasTexture(e); map.colorSpace = emission.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = emission.wrapS = emission.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: emission, emissive: '#ffffff', emissiveIntensity: .35, roughness: .38, metalness: .35 }); m.userData.facade = true; return m;
}
export function roadTextures(): { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } {
  const loader = new THREE.TextureLoader(), base = `${import.meta.env.BASE_URL}textures/`;
  const color = loader.load(`${base}asphalt-diff.jpg`), normal = loader.load(`${base}asphalt-normal.jpg`), rough = loader.load(`${base}asphalt-rough.jpg`);
  color.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [color, normal, rough]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(8.25, 30); texture.anisotropy = 8; }
  return { color, normal, rough };
}
