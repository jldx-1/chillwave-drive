// Verify the actual static artifact: Pages never serves TypeScript or Vite's dev server.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const root = resolve('dist');
const base = process.env.VITE_BASE_PATH || './';
const prefix = base === './' ? '/' : base;
assert(prefix.startsWith('/') && prefix.endsWith('/'), 'VITE_BASE_PATH must start and end with /');
const origin = 'https://pages.invalid';
const pageURL = new URL(`${prefix}index.html`, origin);
let checked = 0;
async function fileAt(path) {
  const file = resolve(root, path);
  assert(file.startsWith(root + sep), `Asset escapes dist: ${path}`);
  // Windows accepts the wrong casing; GitHub Pages/Linux does not.
  let current = root;
  for (const part of path.split('/')) {
    assert((await readdir(current)).includes(part), `Missing or incorrectly capitalized Pages asset: ${path}`);
    current = resolve(current, part);
  }
  assert((await stat(file)).isFile(), `Pages asset is not a file: ${path}`); checked++;
  return file;
}
async function asset(ref, from = pageURL) {
  const url = new URL(ref, from);
  if (url.origin !== origin || url.protocol === 'data:') return;
  assert(url.pathname.startsWith(prefix), `Asset leaves Pages prefix ${prefix}: ${ref}`);
  const relative = decodeURIComponent(url.pathname.slice(prefix.length));
  assert(!relative.startsWith('src/') && !relative.endsWith('.ts'), `Uncompiled source in Pages artifact: ${ref}`);
  return fileAt(relative);
}
const html = await readFile(await fileAt('index.html'), 'utf8');
assert(!html.includes('/src/main.ts'), 'Pages artifact still points at the TypeScript source; publish dist, not the repository root.');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m => m[1]);
assert(scripts.some(src => /\/assets\/[^/]+\.js$/.test(new URL(src, pageURL).pathname)), 'Pages artifact has no compiled JavaScript entry.');
for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
  const file = await asset(match[1]);
  if (file?.endsWith('.css')) {
    const cssURL = new URL(match[1], pageURL), css = await readFile(file, 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) await asset(m[1], cssURL);
  }
}
for (const path of ['.nojekyll', 'models/porsche-911-gt3/model.glb', 'textures/asphalt-diff.jpg', 'textures/asphalt-normal.jpg', 'textures/asphalt-rough.jpg', 'textures/venice-sunset.hdr']) await fileAt(path);
for (const style of ['chillwave','vaporwave']) for (const stem of ['atmosphere','bass','melody','lift']) await fileAt(`audio/${style}-${stem}.wav`);
for (const path of ['CREDITS.md','models/porsche-911-gt3/LICENSE.md','models/car-concept/LICENSE.md']) {
  const text = await readFile(await fileAt(path), 'utf8');
  for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|#)/.test(m[1])) continue;
    const target = resolve(root, dirname(path), m[1]);
    await fileAt(target.slice(root.length + 1).split(sep).join('/'));
  }
}
console.log(`Pages artifact verified: compiled entry, ${checked} asset/link checks, base ${base}`);
