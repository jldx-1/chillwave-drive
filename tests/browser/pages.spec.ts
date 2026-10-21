import { test, expect } from '@playwright/test';

for (const prefix of ['/chillwave-drive/', '/vaporwave-parkour/']) {
  test(`Pages serves compiled game, models, textures and music under ${prefix}`, async ({ page, request }) => {
    await page.setViewportSize({ width: 800, height: 500 });
    const host = 'http://127.0.0.1:4174', errors: string[] = [], loaded: string[] = [];
    const html = await request.get(host + prefix);
    expect(html.status()).toBe(200);
    expect(await html.text()).not.toContain('src/main.ts');
    const entry = (await html.text()).match(/<script\b[^>]*\bsrc="([^"]+\.js)"/)?.[1];
    expect(entry).toBeTruthy();
    const script = await request.get(new URL(entry!, host + prefix).href);
    expect(script.status()).toBe(200);
    expect(script.headers()['content-type']).toMatch(/(?:application|text)\/(?:javascript|ecmascript)/);
    expect(await script.text()).not.toContain('/src/main.ts');
    expect(await html.text()).toMatch(/type="module"[^>]*src="[^"]+\.js"/);
    // This server cannot compile source or fall back to Vite's dev index.
    expect((await request.get(host + prefix + 'src/main.ts')).status()).toBe(404);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => {
      const path = new URL(r.url()).pathname;
      if (r.status() >= 400) errors.push(`${r.status()} ${path}`);
      if (r.status() === 200) loaded.push(path);
    });
    await page.addInitScript(() => localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', musicEnabled: true })));
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.goto(`${host}${prefix}?qa&seed=PAGES`);
    await expect.poll(() => page.evaluate(() => window.__drive.inspect().fleetReady),{timeout:30000}).toBe(true);
    await page.getByRole('button', { name: 'START DRIVE' }).click();
    await expect.poll(() => loaded.filter(p => p.endsWith('.wav')).length).toBeGreaterThanOrEqual(4);
    await page.keyboard.down('w');
    await page.evaluate(() => window.__drive.advance(2));
    await page.keyboard.up('w');
    const speed = await page.evaluate(() => window.__drive.inspect().speed);
    expect(speed).toBeGreaterThan(8);
    expect(loaded.some(p => p.endsWith('/assets/vehicles/player/sports-car.glb'))).toBe(true);
    expect(loaded.some(p => p.endsWith('/textures/venice-sunset.hdr'))).toBe(true);
    expect(loaded.some(p => p.endsWith('/textures/asphalt-diff.jpg'))).toBe(true);
    expect(loaded.filter(p => /\.(?:js|css|woff2?|wav|glb|hdr|jpg)$/.test(p)).every(p => p.startsWith(prefix))).toBe(true);
    expect((await request.get(host + prefix + 'favicon.svg')).headers()['content-type']).toMatch(/image\/svg\+xml/);
    const audit = await (await request.get(host + prefix + 'assets/vehicles/geometry-audit.json')).json();
    for (const spec of Object.values(audit.files) as {path: string}[]) {
      expect(loaded, spec.path).toContain(prefix + spec.path);
    }
    expect(errors).toEqual([]);
  });
}
