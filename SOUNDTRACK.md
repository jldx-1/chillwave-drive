# Chillwave Drive — Sunset Sessions

Two original arrangements ship locally: **Sunset Circuit** (Chillwave, the default) and **Afterimage Avenue** (Vaporwave). Mixed alternates them each eight-bar cycle. The compositions use warm chorus pads, jazzy FM electric piano, smooth bass, a mellow reed lead, swung percussion and delayed upper piano answers. Vaporwave adds whole-stem cassette wow/flutter, 2.8 kHz filtering and saturation.

## Adaptive arrangement

All stems share 72 BPM, 32 beats, 24 kHz mono PCM and exactly 640,000 samples (26.6666667 s). Speed never changes playback rate. Intensity combines cruising speed, pursuit level and nearby police pressure, then is clamped to 0–100.

| Intensity | Layers |
| --- | --- |
| 0–<25 | Electric piano, warm pads, quiet kick and tape texture |
| 25–<50 | Bass, backbeat and swung shaker |
| 50–<75 | Mellow reed melody, echo and kick accents |
| 75–100 | Upper piano answers, chord wash, claps and drum fills |

Layer rise/release time constants are 0.85 / 1.8 s; style crossfades use 1.5 s. All loops share an AudioContext clock and start/offset, preserving phrase and beat through intensity changes. Wrapped note/echo tails avoid encoded silence at the loop boundary. Runtime convolution adds a small shared stereo room.

Music is lazy-loaded and decoded after Start/Resume gestures. No AudioContext or soundtrack request occurs on page load. Pause fades the master output, then suspends the clock. Resume continues the phrase without duplicate sources. M toggles music independently of vehicle effects. Disabling music on a fresh page avoids fetching it. Saved preferences use the new `chillwave-drive:settings:v1` namespace.

## Driving audio

`src/drive/audio.ts` adds original synthesized idle/load/RPM harmonics, rain, wet tire hiss, slip noise, impacts, spatial passing traffic and police sirens. Each siren uses its actual car's position with HRTF panning and inverse distance attenuation. A low-pass cabin filter and voice balance distinguish cockpit and exterior views. Driving sounds are placeholders, not high-quality recorded engines. No recordings were borrowed from commercial games.

One arrangement is about 4.9 MiB; both total about 9.8 MiB. Eight decoded mono loops at 48 kHz require about 39 MiB. Music sources remain bounded at eight. Traffic voices are bounded at six; police voices at four. A shared compressor protects combined output. Audio failure leaves driving usable.

## Rights and regeneration

All music compositions, recordings and the generator were originally synthesized for this project. There are no third-party samples or melodies. The [MIT audio license](public/audio/LICENSE.txt) includes the original contributor notice, which is retained after the game rename. Font and Three.js licenses remain separate.

```bash
# Optional regeneration; requires Python 3 and NumPy.
python3 tools/generate_soundtrack.py
npm test
npm run build
```

Rebuild all stems together if tempo, frame count or arrangement length changes. The generator writes soundtrack metadata to `src/audio/manifest.json`, which Vite bundles with the music code. WAV files remain in `public/audio` and are copied to `dist/audio`; runtime audio URLs use Vite's relative base.

## Verification

Unit tests check exact mix boundaries, gain automation, synchronized sources, phase-aligned style changes, bounded sources, load retry, suspended-clock behavior, equal PCM durations, safe levels and loop boundary continuity. Browser checks measure real output with an analyser and render an actual loop boundary with OfflineAudioContext. They exercise pause/resume, independent volumes, both styles, Mixed, disable/mute, persistence and repository-subdirectory loading.

Manual listening is still required to judge engine timbre, music taste, siren balance and comfort. Test on headphones/speakers and real Chrome, Firefox and Safari devices before release. Verify the actual GitHub Pages URL after publishing; local production tests do not establish hosted deployment success.
