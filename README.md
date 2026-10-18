# Chillwave Drive

**One highway. An endless sunset. A city that never ends. Keep driving.**

A real, client-only 3D driving game built with Three.js, TypeScript and Vite. Drive a sports car down a rain-soaked, procedurally streamed expressway, weave through traffic, take a service loop and overtake highway patrols to trigger police pursuits. Switch between the cockpit and chase camera without changing the simulation.

## Run locally

Requires Node.js 22 or later and npm.

```bash
npm ci
npm run dev
```

Open Vite's printed URL, select **Start Drive**, and hold **W** to accelerate. There is no automatic acceleration. Select **Low** graphics if reflections are too expensive on your device. Traffic density applies to the next drive.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake; release and press again at rest to reverse |
| A / D / Left / Right | Steer |
| Space | Handbrake |
| C | Cockpit / chase camera; saved between drives |
| V (hold) | Look behind |
| F | Headlights |
| M | Toggle soundtrack |
| Esc | Pause / resume; close settings |
| R | Restart after failure |

To drift, build speed, hold **A or D + S** to rotate the rear into a slide, then release the brake, countersteer and ease onto the accelerator to catch it. Wet roads break traction more readily; **Space + steering** gives a stronger handbrake slide. During a drift, the chase camera follows the direction of travel so the car's slide angle stays visible.

Touch screens also have steering, accelerator, brake and camera buttons. Keyboard and a desktop browser are the primary target. The game pauses on blur or when the tab is hidden.

## Implemented systems

- Fixed 60 Hz force-based driving with quick speed-sensitive steering, fast left/right transitions, cornering grip reserved while accelerating, heading recovery after keyboard lane changes, momentum inertia, drag, rolling resistance, automatic gears, shared braking/cornering wet traction, brake-induced oversteer, countersteering and handbrake slides, visual body roll/pitch and continuous relative collision checks. Mass-dependent impulses transfer longitudinal/lateral momentum between player, police and traffic vehicles, with angular response, penetration correction, barrier scrapes and roadside maintenance obstacles.
- Four forward lanes and a separated oncoming carriageway. Traffic uses headway braking, guarded lane changes and bounded recycling. Vehicles face their actual travel direction.
- White police utility SUVs have black steel wheels, tinted windows, large POLICE side markings, a green rocker stripe, front push bars, a driver-side spotlight and slim roof lightbars. Police cruise as quiet forward patrols. Overtaking or hitting one activates that same vehicle’s lights, siren and pursuit AI. Later patrols can join; active units remain in the simulation rather than being respawned. Pursuit escalates to level five; sirens use actual active vehicle positions. Low-speed capture requires five seconds near police. Accumulated damage and immobilization can also end the drive.
- A seeded, streamed highway and city, road signs, lighting and overpasses. Fourteen 120 m chunks surround the car; scene coordinates rebase every kilometer while logical distance stays continuous.
- A 900 m service loop exits right at 800 m and repeats every 3 km. It has explicit entry/rejoin connectors, traffic, separate road bounds and map guidance. Follow it around to rejoin at 1.7 km.
- A locally bundled, attributed Porsche 911 GT3 GLB with metallic cyan clearcoat, rounded coupe bodywork, oval headlights, dark multi-spoke wheels, a fixed rear wing and a detailed interior. Same-world cockpit and chase cameras animate its wheel and steering geometry, wipers, working dashboard, rear-view rendering, headlights and brake lights. Water-bead shading and damage scratches affect the bodywork.
- Photographic CC0 asphalt color/normal/roughness maps and sunset HDR lighting, wet-road Fresnel reflections, local shadows, preset-controlled SSAO and restrained bloom. Modular towers have varied setbacks, crowns, balconies, roof machinery, structural details and lit facade atlases. A distant skyline/road proxy fades into haze beyond streamed chunks. World-relative rain follows gravity, wind and vehicle motion; overpasses shelter the road and cabin. Small tire wakes and road ripple rings replace floating splash dots. Water beads are shaded on the actual windshield, flow with gravity/airflow and are cleared by the animated blades, without covering the dashboard or HUD. Contact sparks/splashes, impact camera feedback and four presets complete the presentation. Sustained slow frames lower resolution; Low omits expensive rendering passes.
- Load/RPM-dependent engine voices, wet tire/wind/rain layers, collision sounds, positional passing traffic and police sirens. Cockpit audio filters external sound. Music and effects have independent volume controls.
- Two original bundled arrangements and Mixed mode, synchronized seamless loops and pursuit-adaptive layers at fixed 72 BPM. Audio starts after a user gesture. See [SOUNDTRACK.md](SOUNDTRACK.md).
- Garage, controls, settings, pause and failure screens; speed/gear/RPM, damage, pursuit/capture, a heading-aware nearby traffic map with vehicle silhouettes, quiet patrol markers and flashing red/blue pursuit units, near misses, distance, records and small achievement notifications.

## Assets, renderer and validation limits

The primary sports car/interior is **Porsche 911 GT3** by ChevroletSS, CC-BY-4.0, redistributed in a simplified meshopt format by pedrosoandre/carros and adapted to the supplied cyan car reference. The previous Car Concept asset and its notices remain available in the asset folder. Asphalt 02 maps and Venice Sunset HDR are **CC0 Poly Haven** assets. All are served locally, including under a repository prefix. Full notices, original source URLs and runtime adaptations are in [asset credits](public/CREDITS.md). The Garage links to the shipped notices. No assets were extracted from a commercial racing game.

The other traffic vehicles use curved procedural coachwork, glass, rims, lamps and trim. Architecture combines reusable geometry with generated facade textures. Handling remains a planar single-track vehicle controller coupled to a mass/inertia contact solver; it is not a full six-degree-of-freedom suspension solver. There are no vertical vehicle launches or soft-body deformations. There is no soft-body dent or glass-fracture simulation; crash fragments are bounded sparks and splash particles. Damage changes paint roughness/scratches, alignment and engine delivery. Driving audio is synthesized, including load/RPM voices, shift envelopes and filtered crash noise; it is not a recorded production engine.

WebGPU was investigated against the [official Three.js migration guide](https://threejs.org/manual/pages/webgpurenderer). Its material/postprocessing API requires porting this code's GLSL reflection and weather shaders to TSL; a renderer switch by itself would not improve those assets or physics. This build keeps **WebGL2**, with configurable SSAO/bloom/shadows/reflections and adaptive resolution. The renderer is not advertised as WebGPU or as matching Forza Horizon. See [UPGRADE_PLAN.md](UPGRADE_PLAN.md).

The bundled model/texture assets total about 17 MB beyond the original music, including the retained previous car model. Higher presets need a capable GPU. A headless Chromium renderer-resource test sweeps 100 km of actual streamed chunks and checks bounded geometry/texture counts; it is not a human-driven endurance session or a measurement of process RAM. Human handling/listening judgment, calibrated hardware FPS, Safari/Firefox verification and the actual GitHub-hosted deployment still require separate checks.

## Checks

```bash
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Unit checks cover driving/steering/braking, wet grip, handbrake, damage cooldown, swept impacts, deterministic timesteps, graph connections, driving a complete detour, coordinate rebasing, seeded traffic spacing, opposing flow, a long recycling simulation, two-body momentum/rotation, traffic-to-traffic and roadside contacts, overtake-triggered patrol activation and persistence, timed capture, records and native music loops.

Browser tests exercise the production build: actual keyboard driving, cockpit/chase/rear look, steering, pause/resume, patrol overtaking, pursuit and restart, garage/settings, persistence, touch layout, Web Audio output/lifecycle and assets under `/chillwave-drive/`. `?qa&seed=SUNSET` exposes state observations and diagnostic fast stepping of the same fixed-step simulation using actual input. A separate streaming-window control exercises the real chunk builder/resource disposal for the soak test. These diagnostics are present only with the QA query; ordinary gameplay does not teleport vehicles. Screenshots and failures go to ignored `test-results/`.

## GitHub Pages

The static build needs no backend or Node server in production. Vite uses a relative base, so JS, fonts and audio work under either the existing repository path or `/chillwave-drive/`.

The workflow in `.github/workflows/deploy.yml` installs dependencies, runs tests, builds the game, verifies Chromium and uploads/deploys `dist` when pushed to `main` (or manually dispatched). Pull requests validate without deploying.

Manual repository setup:

1. In GitHub repository **Settings → General**, rename `vaporwave-parkour` to `chillwave-drive` if desired. The local directory name does not affect the application.
2. Update your Git remote URL after the rename: `git remote set-url origin git@github.com:jldx-1/chillwave-drive.git`.
3. In **Settings → Pages**, select **GitHub Actions** as the source.
4. Push reviewed changes to `main` and let the workflow finish. Expected renamed URL: `https://jldx-1.github.io/chillwave-drive/`.
5. At that actual hosted URL, check the network panel for missing assets, start a drive, switch cameras, listen, pause, reload and verify preferences.

A local repository-subdirectory test verifies asset layout; it does not verify GitHub's hosted deployment. Repository renaming, remote changes and publishing are not performed by the local build.

See [GAME_PLAN.md](GAME_PLAN.md) for architecture, milestones and validation limits.
