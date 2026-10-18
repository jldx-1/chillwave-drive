import * as THREE from 'three';
/** Continuous curved cross sections produce real highlights across car bodywork. */
export function coachwork(length = 4.6, width = 1.95, height = .8): THREE.BufferGeometry {
  const zs = [-.5, -.47, -.37, -.23, .06, .3, .43, .5], widths = [.66, .85, .98, 1, 1, .99, .91, .74];
  const positions: number[] = [], indices: number[] = [];
  for (let ring = 0; ring < zs.length; ring++) {
    const w = width / 2 * widths[ring], top = height * ([.8, .89, .98, 1, 1, 1, .98, .86][ring]);
    for (const [x, y] of [[-.82, .34], [-1, .45], [-.98, .82], [-.8, 1], [.8, 1], [.98, .82], [1, .45], [.82, .34]]) positions.push(x * w, y * top, zs[ring] * length);
  }
  for (let z = 0; z < zs.length - 1; z++) for (let i = 0; i < 8; i++) { const a = z * 8 + i, b = z * 8 + (i + 1) % 8; indices.push(a, a + 8, b, b, a + 8, b + 8); }
  for (const end of [0, (zs.length - 1) * 8]) for (let i = 1; i < 7; i++) indices.push(end, end + i + (end ? 0 : 1), end + i + (end ? 1 : 0));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function quad(points: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));g.setIndex([0, 1, 2, 0, 2, 3]);g.computeVertexNormals();return g;
}
