import { test, expect } from '@playwright/test';

interface AudioQA {
  contexts: AudioContext[];
  panners: PannerNode[];
  gains: GainNode[];
  sources: AudioBufferSourceNode[];
  starts: { when: number; offset: number; duration: number }[];
  analyser?: AnalyserNode;
}
declare global { interface Window { audioQA: AudioQA } }

// Observe real Web Audio nodes; the production game exposes no testing API.
async function observeAudio(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const qa: AudioQA = window.audioQA = { contexts: [], panners: [], gains: [], sources: [], starts: [] };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) { super(options); qa.contexts.push(this); }
      createPanner(): PannerNode { const node=super.createPanner();qa.panners.push(node);return node; }
      createGain(): GainNode { const node = super.createGain(); qa.gains.push(node); return node; }
      createBufferSource(): AudioBufferSourceNode {
        const node = super.createBufferSource(); qa.sources.push(node);
        const start = node.start.bind(node);
        node.start = (when = 0, offset = 0, duration?: number) => { qa.starts.push({ when, offset, duration: node.buffer?.duration ?? 0 }); start(when, offset, duration); };
        return node;
      }
    };
    if (!localStorage.getItem('chillwave-drive:settings:v1')) localStorage.setItem('chillwave-drive:settings:v1', JSON.stringify({ quality: 'low', density: 'low', effectsVolume: .45, musicVolume: .42, musicEnabled: true }));
  });
}
async function rms(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const qa = window.audioQA;
    if (!qa.analyser) { qa.analyser = qa.contexts[0].createAnalyser(); qa.gains[2].connect(qa.analyser); }
    const data = new Float32Array(qa.analyser.fftSize); qa.analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length);
  });
}
async function setSlider(page: import('@playwright/test').Page, name: string, value: string) {
  await page.getByLabel(name, { exact: true }).evaluate((element: HTMLInputElement, value) => { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}

test('music unlocks on Play, loops on a shared clock, and resumes without new sources', async ({ page }) => {
  await observeAudio(page);
  const errors: string[] = [], audioUrls: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().endsWith('.wav')) audioUrls.push(r.url()); });
  await page.goto('http://127.0.0.1:4174/chillwave-drive/?seed=MUSIC');
  expect(await page.evaluate(() => window.audioQA.contexts.length)).toBe(0); expect(audioUrls).toHaveLength(0);
  await page.getByRole('button', { name: 'START DRIVE' }).click();
  await expect.poll(() => page.evaluate(() => window.audioQA.starts.filter(s => s.duration > 20).length)).toBe(4);
  await expect.poll(() => rms(page)).toBeGreaterThan(.00001);
  const start = await page.evaluate(() => window.audioQA.starts.filter(s => s.duration > 20));
  expect(new Set(start.map(s => s.when)).size).toBe(1); expect(new Set(start.map(s=>s.offset)).size).toBe(1); expect(start.every(s=>s.offset>=0&&s.offset<.1)).toBe(true);
  expect(audioUrls).toHaveLength(4); expect(audioUrls.every(u => u.includes('/chillwave-drive/audio/'))).toBe(true);
  const loop = await page.evaluate(async () => {
    const buffer = window.audioQA.sources.find(s => s.buffer && s.buffer.duration > 20)!.buffer!;
    const rate = 8000, boundary = Math.round(buffer.duration * rate);
    const offline = new OfflineAudioContext(1, boundary * 2, rate);
    const source = offline.createBufferSource(); source.buffer = buffer; source.loop = true; source.loopEnd = buffer.duration;
    source.connect(offline.destination); source.start();
    const result = (await offline.startRendering()).getChannelData(0);
    let energy = 0; for (let i = boundary - 200; i < boundary + 200; i++) energy += result[i] ** 2;
    return { jump: Math.abs(result[boundary] - result[boundary - 1]), energy: energy / 400 };
  });
  expect(loop.jump).toBeLessThan(.08); expect(loop.energy).toBeGreaterThan(.00001);
  await page.getByRole('button', { name: 'Pause drive' }).click();
  await expect.poll(() => page.evaluate(() => window.audioQA.contexts[0].state)).toBe('suspended');
  const paused = await page.evaluate(() => window.audioQA.contexts[0].currentTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.audioQA.contexts[0].currentTime)).toBe(paused);
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click();
  await expect.poll(() => page.evaluate(() => window.audioQA.contexts[0].state)).toBe('running');
  expect(await page.evaluate(() => window.audioQA.starts.filter(s => s.duration > 20).length)).toBe(4);
  await expect.poll(() => rms(page)).toBeGreaterThan(.00001);
  await page.getByRole('button', { name: 'Toggle music', exact: true }).click();
  await expect.poll(() => rms(page)).toBeLessThan(.00001);
  await page.getByRole('button', { name: 'Toggle music', exact: true }).click();
  await expect.poll(() => rms(page)).toBeGreaterThan(.00001);
  expect(errors).toEqual([]);
});

test('independent audio controls, style crossfades, disable, and persistence work', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/?seed=MUSIC');
  await page.getByRole('button', { name: 'START DRIVE' }).click();
  await expect.poll(() => page.evaluate(() => window.audioQA.starts.filter(s => s.duration > 20).length)).toBe(4);
  await page.getByRole('button', { name: 'Pause drive' }).click();
  await page.getByRole('button', { name: 'AUDIO & GRAPHICS', exact: true }).click();
  await expect(page.getByLabel('Music style')).toHaveValue('chillwave');
  await setSlider(page, 'Music volume', '.25'); await setSlider(page, 'Sound effects volume', '.1');
  await page.getByLabel('Music style').selectOption('vaporwave');
  await page.getByLabel('Music style').selectOption('mixed');
  await page.getByRole('button', { name: 'ALL SET' }).click();
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click();
  await page.waitForTimeout(650);
  const volumes = await page.evaluate(() => window.audioQA.gains.slice(1, 3).map(g => g.gain.value));
  expect(volumes[0]).toBeCloseTo(.1, 2); expect(volumes[1]).toBeCloseTo(.25, 1);
  expect(await page.evaluate(() => window.audioQA.starts.filter(s => s.duration > 20).length)).toBe(8);
  await page.getByRole('button', { name: 'Pause drive' }).click();
  await page.getByRole('button', { name: 'AUDIO & GRAPHICS', exact: true }).click();
  await page.getByLabel('Music enabled', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'ALL SET' }).click();
  await page.getByRole('button', { name: 'RESUME DRIVE' }).click();
  await expect.poll(() => rms(page), { timeout: 8000 }).toBeLessThan(.00001);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chillwave-drive:settings:v1')!));
  expect(saved.musicStyle).toBe('mixed'); expect(saved.musicEnabled).toBe(false);
  expect(saved.effectsVolume).toBe(.1); expect(saved.musicVolume).toBe(.25);
  await page.reload();
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await expect(page.getByLabel('Music style')).toHaveValue('mixed');
  await expect(page.getByLabel('Music enabled', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Music volume', { exact: true })).toHaveValue('0.25');
});

test('patrols are silent and an alerted unit gets a real position-bound siren',async({page})=>{
  await observeAudio(page);await page.goto('/?qa&seed=CAPTURE');await page.getByRole('button',{name:'START DRIVE'}).click();
  expect(await page.evaluate(()=>window.audioQA.panners.length)).toBe(6);
  await page.keyboard.down('w');await page.evaluate(()=>window.__drive.advance(16));await page.keyboard.up('w');
  await expect.poll(()=>page.evaluate(()=>window.audioQA.panners.length)).toBeGreaterThan(6);
  const spatial=await page.evaluate(()=>{const state=window.__drive.inspect(),unit=state.agents.find(a=>a.kind==='police'&&a.active)!;return {panners:window.audioQA.panners.slice(6).map(p=>({x:p.positionX.value,z:p.positionZ.value})),unit,origin:state.origin};});
  expect(spatial.panners.some(p=>Math.abs(p.x-spatial.unit.x)<.5&&Math.abs(p.z+(spatial.unit.s-spatial.origin))<2)).toBe(true);
});
