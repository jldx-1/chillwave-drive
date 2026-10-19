import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const verifier = fileURLToPath(new URL('../tools/verify-pages.mjs', import.meta.url));
function failure(html: string, assets: string[] = []): string {
  const cwd = mkdtempSync(join(tmpdir(), 'chillwave-pages-'));
  try {
    mkdirSync(join(cwd, 'dist/assets'), { recursive: true });
    writeFileSync(join(cwd, 'dist/index.html'), html);
    for (const name of assets) writeFileSync(join(cwd, 'dist/assets', name), '');
    try { execFileSync(process.execPath, [verifier], { cwd, env: { ...process.env, VITE_BASE_PATH: './' }, stdio: 'pipe' }); }
    catch (e) { return String((e as { stderr: Buffer }).stderr); }
    throw new Error('Invalid Pages artifact unexpectedly passed');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
describe('GitHub Pages artifact guard', () => {
  it('rejects the source HTML responsible for the main.ts 404', () => {
    expect(failure('<script type="module" src="./src/main.ts"></script>')).toContain('publish dist, not the repository root');
  });
  it('rejects asset names that only work on a case-insensitive local filesystem', () => {
    expect(failure('<script type="module" src="./assets/App.js"></script>', ['app.js'])).toContain('incorrectly capitalized Pages asset: assets/App.js');
  });
});
