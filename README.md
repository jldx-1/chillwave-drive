# Chillwave Drive

**One highway. An endless sunset. A city that never ends. Keep driving.**

A real, client-only 3D driving game built with Three.js, TypeScript and Vite. Drive a sports car down a rain-soaked, procedurally streamed expressway, weave through traffic, take a service loop and overtake highway patrols to trigger police pursuits. Switch between the cockpit and chase camera without changing the simulation.

## Run locally

Requires Node.js 22 or later, npm and [Git LFS](https://git-lfs.com/). After cloning, download the bundled media before building:

```bash
git lfs install
git lfs pull
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

The newest left/right press wins even when both directions overlap; holding an old key does not override a newer command. Releasing steering centers the wheels and preserves your chosen heading. During a handbrake slide, opposite steering redirects the front wheels immediately and reverses the slide progressively.

Touch screens also have steering, accelerator, brake and camera buttons. Keyboard and a desktop browser are the primary target. The game pauses on blur or when the tab is hidden.

## Implemented systems

- Fixed 60 Hz force-based driving with quick speed-sensitive steering, fast left/right transitions, cornering grip reserved while accelerating, the newest held direction taking priority, preserved heading after releasing steering, momentum inertia, drag, rolling resistance, automatic gears, shared braking/cornering wet traction, brake-induced oversteer, prompt handbrake countersteering and handbrake slides, visual body roll/pitch and continuous relative collision checks. Mass-dependent impulses transfer longitudinal/lateral momentum between player, police and traffic vehicles, with model-measured convex bumper/fender footprints, oriented continuous contact checks, angular response, penetration correction, barrier scrapes and roadside maintenance obstacles.
- Driving score earns points for forward progress. Every 250 m without a hit raises the multiplier by ×0.5, up to ×3. Vehicle or barrier impacts deduct 100–600 points based on impact speed, reset the multiplier and keep the score at or above zero. Continuous rubbing counts as one impact episode; reversing over old ground earns no points. The HUD shows score/multiplier, and high scores save alongside distance records.
- Clean close passes give a punchy **+4 m/s (about 14 km/h) burst** once your rear bumper clears the other vehicle. Clearance is measured from the actual body outlines; touching, an unsafe hairline gap, or a distant pass earns no reward. Boosts preserve your momentum heading, respect the normal speed cap and braking, and have a 1.25-second cooldown. Blue/orange flame ribbons behind the rear wheels show the burst for about 0.32 seconds, then fade.
- Four forward lanes and a separated oncoming carriageway. Traffic uses headway braking, guarded lane changes and bounded recycling. Vehicles face their actual travel direction.
- White police utility SUVs have smoothly crowned roofs/hoods, tapered bodywork, curved glazing, black steel wheels, tinted windows, large POLICE side markings, a green rocker stripe, front push bars, a driver-side spotlight and slim roof lightbars. Police use the same vehicle dynamics and contact solver as the player, with an SUV mass, wheelbase and pursuit tuning. Police cruise as quiet forward patrols. Overtaking or hitting one activates that same vehicle’s lights, siren and pursuit AI. Later patrols can join; active units remain in the simulation rather than being respawned. Pursuit units accelerate harder, have a speed reserve above the player’s maximum, retain a passing lane until clear of slower traffic, and aim at the player’s rear quarter for physical ramming attempts when traffic and road alignment permit. After an impact they recover, then try again. The whole rotated SUV stays inside its selected highway or service-road corridor during steering and collision recovery. Pursuit escalates to level five; sirens use actual active vehicle positions. Low-speed capture requires five seconds near police. Body damage accumulates without disabling the player’s controls; a crash alone does not end the drive.
- A seeded, streamed highway and city, road signs, lighting and overpasses. Fourteen 120 m chunks surround the car; scene coordinates rebase every kilometer while logical distance stays continuous.
- A 900 m service loop exits right at 800 m and repeats every 3 km. It has explicit entry/rejoin connectors, traffic, separate road bounds and map guidance. Follow it around to rejoin at 1.7 km.
- A locally bundled, attributed Porsche 911 GT3 GLB with metallic cyan clearcoat, rounded coupe bodywork, oval headlights, dark multi-spoke wheels, a fixed rear wing and a detailed interior. The first-person view keeps a level, fixed eye and field of view, with no artificial vibration, impact shake or cabin pitch/roll. Same-world cockpit and chase cameras animate its wheel and steering geometry, wipers, working dashboard, rear-view rendering, headlights and brake lights. Water-bead shading and damage scratches affect the bodywork.
- Photographic CC0 asphalt color/normal/roughness maps and sunset HDR lighting, wet-road Fresnel reflections blended over the lit asphalt with stable depth bias, an anchored plane and mipmapped filtering, stable sun-shadow projection, smooth traffic-light ownership/range transitions, shared world-aligned textures across clipped highway/ramp junctions, flat road paint, local shadows, preset-controlled SSAO and restrained bloom. Environment and asphalt maps finish loading before driving; color reflections ignore normal/depth passes. Local police illumination crossfades while the actual lightbar signals. Modular towers have varied setbacks, crowns, balconies, roof machinery, structural details and lit facade atlases. A distant skyline/road proxy fades into haze beyond streamed chunks. World-relative rain follows gravity, wind and vehicle motion; overpasses shelter the road and cabin. Small tire wakes and road ripple rings replace floating splash dots. Water beads are shaded on the actual windshield, flow with gravity/airflow and are cleared by the animated blades, without covering the dashboard or HUD. Contact sparks/splashes, impact camera feedback and four presets complete the presentation. Sustained slow frames lower resolution; Low omits expensive rendering passes.
- Load/RPM-dependent engine voices, wet tire/wind/rain layers, collision sounds, positional passing traffic and police sirens. Cockpit audio filters external sound. Music and effects have independent volume controls.
- Two original bundled arrangements and Mixed mode, synchronized seamless loops and pursuit-adaptive layers at fixed 72 BPM. Audio starts after a user gesture. See [SOUNDTRACK.md](SOUNDTRACK.md).
- Garage, controls, settings, pause and failure screens; speed/gear/RPM, damage, pursuit/capture, a heading-aware nearby traffic map with vehicle silhouettes, quiet patrol markers and flashing red/blue pursuit units, near misses, distance, records and small achievement notifications.

## Assets, renderer and validation limits

The primary sports car/interior is **Porsche 911 GT3** by ChevroletSS, CC-BY-4.0, redistributed in a simplified meshopt format by pedrosoandre/carros and adapted to the supplied cyan car reference. The previous Car Concept asset and its notices remain available in the asset folder. Asphalt 02 maps and Venice Sunset HDR are **CC0 Poly Haven** assets. All are served locally, including under a repository prefix. Full notices, original source URLs and runtime adaptations are in [asset credits](public/CREDITS.md). The Garage links to the shipped notices. No assets were extracted from a commercial racing game.

All traffic uses independently bundled GLBs: sedan, SUV, pickup, box truck, hatchback, sports coupe and police SUV. Geometry and textures are shared; mutable paint and lights belong to each vehicle. Near rigs animate actual wheel pivots, steering, braking, indicators and body motion. Separate LODs and distant instancing retain each category’s silhouette. See the [vehicle library and rebuild/replacement instructions](public/assets/vehicles/README.md). The generic passenger source models are deliberately simple browser art; the police and truck are original authored assets. Architecture combines reusable geometry with generated facade textures. Handling remains a planar single-track vehicle controller coupled to a mass/inertia contact solver; it is not a full six-degree-of-freedom suspension solver. There are no vertical vehicle launches or soft-body deformations. There is no soft-body dent or glass-fracture simulation; crash fragments are bounded sparks and splash particles. Damage changes paint roughness and scratches. Steering, braking and engine power remain available even at maximum body damage. Impacts still transfer momentum, with quick recovery from collision spin. Driving audio is synthesized, including load/RPM voices, shift envelopes and filtered crash noise; it is not a recorded production engine.

WebGPU was investigated against the [official Three.js migration guide](https://threejs.org/manual/pages/webgpurenderer). Its material/postprocessing API requires porting this code's GLSL reflection and weather shaders to TSL; a renderer switch by itself would not improve those assets or physics. This build keeps **WebGL2**, with configurable SSAO/bloom/shadows/reflections and adaptive resolution. The renderer is not advertised as WebGPU or as matching Forza Horizon. See [UPGRADE_PLAN.md](UPGRADE_PLAN.md).

The fleet library adds about 36 MB across the player and all traffic LODs, with source assets retained for reproducible offline export. Model preparation happens before play; the loading indicator keeps Start disabled until the required assets decode. Higher presets need a capable GPU. A headless Chromium renderer-resource test sweeps 100 km of actual streamed chunks and checks bounded geometry/texture counts; it is not a human-driven endurance session or a measurement of process RAM. Human handling/listening judgment, calibrated hardware FPS, Safari/Firefox verification and the actual GitHub-hosted deployment still require separate checks.

## Checks

```bash
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Unit checks cover driving/steering/braking, wet grip, handbrake, damage cooldown, swept impacts, deterministic timesteps, graph connections, driving a complete detour, coordinate rebasing, seeded traffic spacing, opposing flow, a long recycling simulation, two-body momentum/rotation, traffic-to-traffic and roadside contacts, overtake-triggered patrol activation and persistence, timed capture, contact-free close-pass boosts and contact rejection, rotated police containment through impact recovery and full detours, road texture/paint integration, collision score penalties and record migration, handbrake direction reversal, heading persistence, stable illumination/reflection passes, records and native music loops.

Browser tests exercise the production build: actual keyboard driving, cockpit/chase/rear look, steering, pause/resume, patrol overtaking, pursuit and restart, garage/settings, persistence, touch layout, Web Audio output/lifecycle and assets under `/chillwave-drive/`. `?qa&seed=SUNSET` exposes state observations and diagnostic fast stepping of the same fixed-step simulation using actual input. A separate streaming-window control exercises the real chunk builder/resource disposal for the soak test. Its draw uses a one-pixel scissor: the same geometry and material maps still upload to WebGL, while full-screen shading is reserved for the separate graphics checks. These diagnostics are present only with the QA query; ordinary gameplay does not teleport vehicles. UI and audio checks pause the rendering clock; driving uses actual held inputs and the same fixed-step simulation, with separate rendered camera checks. This avoids spending the CI timeout rendering hundreds of software-GPU frames. Failed CI runs retain screenshots, traces and error context as a workflow artifact. Screenshots and failures go to ignored `test-results/`.

## Git LFS media

The `.gitattributes` rules store GLB models (including original export sources), WAV soundtrack stems, HDR lighting and asphalt JPEG maps in Git LFS. Keep these rules committed. New matching assets use LFS automatically; ordinary source, metadata, notices and licenses stay in Git. The local pre-push hook installed by `git lfs install` uploads media objects during a normal `git push`. Do not skip that hook. Existing commit history has not been rewritten.

Use `git lfs ls-files` to inspect tracked media and `git lfs fsck` to verify local objects. If a model or audio file contains a short `version https://git-lfs.github.com/spec/v1` text instead of binary data, run `git lfs pull` before running the game.

## GitHub Pages

GitHub Pages must publish the **compiled `dist/` folder**. Publishing the repository root serves the development `index.html`, which references `src/main.ts`; Pages does not compile TypeScript, causing a main.ts 404 or a module MIME error (video/mp2t means the server treated .ts as an MPEG transport stream). Changing MIME headers cannot compile TypeScript.

1. Commit and push the project **including `.github/workflows/deploy.yml`** to `main`. The `.github` folder must be included; it is the deployment workflow.
2. In the GitHub repository, open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**. Use this source instead of “Deploy from a branch”. [GitHub setup instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
3. Open **Actions → Chillwave Drive — build, test and deploy** and run the workflow (or push another change to `main`). Wait for both `build` and `deploy` to pass. A failed browser test stops deployment and leaves the previous site in place; pushing source alone does not update the hosted game.
4. Open the URL shown by the deployment / **Settings → Pages**. After changing deployment sources, refresh the page with the browser cache bypassed.

The workflow uses [LFS-enabled checkout](https://github.com/actions/checkout#usage), verifies downloaded media with `git lfs fsck`, installs dependencies, runs unit and Chromium gameplay tests, builds the site, checks the compiled entry, fonts, audio, models, textures and local credit links, and publishes only `dist/`. The artifact guard rejects unresolved LFS pointers anywhere in the output. Pages serves ordinary binary files from that built artifact; it never has to resolve Git LFS pointers itself. Pull requests validate without deploying. The final build reads GitHub Pages' actual base path, so an existing `/vaporwave-parkour/` repository, a renamed `/chillwave-drive/` repository, an account site or a custom domain gets the appropriate URLs without editing the source. A repository rename is optional and is separate from this fix.

To check the static build locally:

```bash
npm run build:pages
npm run preview
```

Local builds use relative asset URLs. To reproduce a specific production path, set `VITE_BASE_PATH=/chillwave-drive/` (including both slashes) when building. See [Vite's Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).

Browser tests serve the compiled site under both `/chillwave-drive/` and `/vaporwave-parkour/` without a dev server or fallback routing. The local checks verify the deployment layout; they do not publish or change your GitHub settings. After the workflow deploys, check the actual hosted URL by starting a drive, switching cameras, playing audio and reloading preferences.

See [GAME_PLAN.md](GAME_PLAN.md) for architecture, milestones and validation limits.
