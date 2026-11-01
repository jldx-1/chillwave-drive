# Chillwave Drive

**One highway. A neon night. A city that never ends. Keep driving.**

A real, client-only 3D driving game built with Three.js, TypeScript and Vite. Drive a sports car down a rain-soaked, procedurally streamed expressway, weave through traffic, take a service loop and overtake highway patrols to trigger police pursuits. Switch between the cockpit and chase camera without changing the simulation.

## Procedural cyberpunk buildings

The streamed neighbourhoods now use the HIVE residential megablocks, ARCOLOGY corporate towers,
and CAPSULE pod towers from [CyberPunkProceduralBuildingsThreeJS](https://github.com/achrefelouafi/CyberPunkProceduralBuildingsThreeJS).
Six seeded variants retain cantilevered rooms, AC units, rooftop props, neon tube lettering,
blade signs, animated screens, stepped crowns, capsule portholes and market podiums.
Geometry is generated once and instanced across the city; measured bounds include projecting signs
and fit inside the existing road/collision parcels. Origin shifts reuse the same geometry.
The existing plot catalog remains the layout authority; its previous detailed models are no longer rendered.

Only the required MIT generator modules are compiled into the game. The full reference checkout
is ignored by Git and excluded from the Pages artifact; no external generator service or source
repository is required at runtime. The [license notice](public/licenses/cyberpunk-buildings-MIT.txt)
is included in the published assets. Procedural surfaces are used without the reference demo's PBR scans.

The city batches surface parameters and neon colors into vertex attributes and static signs into padded
texture atlases. Small fixtures use preset-specific distance detail with hysteresis; building
shells, windows and signs remain visible through the city mist. Tube/porthole tessellation
is tuned for the driving camera. Loading waits for asynchronous shader warmup before drawing
the city, and reflection capture retains the environment's shader layout. Streamed parcel
specs and instance buffers are reused across origin-only changes.

Run `npx playwright test tests/browser/city-performance.spec.ts` to report startup time,
shader/capture timings, frame-time percentiles, complete per-frame draw/triangle counts,
and geometry/texture allocations for 1440p Ultra/High, desktop Medium and phone-sized Low.
The Ultra driving test exercises actual animation frames and chunk boundaries on the native GPU.

Camera-dependent rendering uses native Three.js `InstancedMesh` for individual building parts,
skyline objects, distant vehicles and aerial traffic. Every main, mirror, reflected and
shadow camera builds its own culled draw list. Detailed traffic rigs are loaded for a
padded set of active views, use projected-size LOD, and retire after two seconds offscreen;
shared coarse models cover rapid camera changes. This is the Three.js visibility/LOD
implementation of the requested Nanite-style behavior. Geometry templates remain cached.
Each camera retains its own instance matrices and reuses unchanged GPU buffers. Streetscape
chunks use a reserved `BatchedMesh` ring to combine unique geometry without rebuilding it.
Future streetscape chunks are generated in a worker and transferred without copying vertex buffers;
the synchronous builder remains available as a fallback. High/Ultra use GTAO with the resolved
scene depth, avoiding a second full-city normal/depth render. Display resolution, preset detail,
reflection targets, shadows, bloom and multisample antialiasing are preserved.
Asynchronous GPU timing and CPU frame/update percentiles are available in QA diagnostics.
On the local RTX 4070 Ti (D3D11), the 2560×1440 Ultra driving benchmark with normal traffic
recorded a 16.7 ms 95th-percentile frame interval, with 0.8% of frames over 25 ms.
This measures 660 real animation frames through streamed chunk boundaries, rather than
synthetic simulation advances; results depend on the GPU, browser and scene.

Vehicles use clear-coated metallic paint, filtered microflake roughness, reflective tinted
glass, brighter functional LEDs and alloy/rotor/rubber finishes. Player damage and rain
shaders remain active. The car lighting and city neon are brighter, with a wider bloom halo
on Medium and higher; Low keeps the brighter emitters without a bloom pass.

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
| Hold Shift | Nitro (release to stop) |
| C | Cockpit / chase camera; saved between drives |
| V (hold) | Look behind |
| F | Headlights |
| M | Play / pause YouTube radio |
| Esc | Pause / resume; close settings |
| R | Restart after failure |

To drift, build speed, hold **A or D + S** to rotate the rear into a slide, then release the brake, countersteer and ease onto the accelerator to catch it. Wet roads break traction more readily; **Space + steering** gives a stronger handbrake slide. During a drift, the chase camera follows the direction of travel so the car's slide angle stays visible.

The newest left/right press wins even when both directions overlap; holding an old key does not override a newer command. Releasing steering centers the wheels and preserves your chosen heading. During a handbrake slide, opposite steering redirects the front wheels immediately and reverses the slide progressively.

Hold **Shift** to boost while fuel remains; release to stop immediately and save the remaining fuel. A full tank lasts three seconds and refills from empty in 10 seconds while off boost. Partial tanks can be used immediately; a fully drained tank must recharge before reuse. Nitro accelerates while held, and braking takes priority without wasting fuel. The speedometer and held phone NITRO button show the charge percentage. Press **Q** to launch a homing missile at the nearest car ahead or **E** to fire behind, within 100 m. Missiles destroy vehicles on impact; each launch starts a shared five-second recharge. Drive up illuminated ramps at 40 mph or faster to launch over traffic. Momentum controls jump height and pitch; a high enough jump can clear medians or strike overhead signs and overpasses. Green shield and amber turbo pickups are spaced 480 m apart.

Phones have large thumb controls: hold GO on the right and slide your other thumb across the left steering pad. The center of the pad gives neutral steering. BRAKE, DRIFT (handbrake), CAM, NITRO, and FRONT / REAR missile controls are separate buttons, and simultaneous touches are supported. Pointer cancellation, releasing one finger, and pausing clear only the appropriate held inputs. Controls support portrait/landscape and screen safe areas. New phone installs start on Low with lighter traffic; new desktop installs start on Medium. Saved preferences take priority. The game pauses on blur or when the tab is hidden.

## Implemented systems

- Fixed 60 Hz force-based driving with quick speed-sensitive steering, fast left/right transitions, cornering grip reserved while accelerating, the newest held direction taking priority, preserved heading after releasing steering, momentum inertia, drag, rolling resistance, automatic gears, shared braking/cornering wet traction, brake-induced oversteer, prompt handbrake countersteering and handbrake slides, visual body roll/pitch and continuous relative collision checks. Mass-dependent impulses transfer longitudinal/lateral momentum between player, police and traffic vehicles, with model-measured convex bumper/fender footprints, oriented continuous contact checks, angular response, penetration correction, barrier scrapes and illuminated jump ramps.
- Driving score earns points for forward progress. Every 250 m without a hit raises the multiplier by ×0.5, up to ×3. Vehicle or barrier impacts deduct 100–600 points based on impact speed, reset the multiplier and keep the score at or above zero. Continuous rubbing counts as one impact episode; reversing over old ground earns no points. The HUD shows score/multiplier, and high scores save alongside distance records.
- Clean close passes give a punchy **+4 m/s (about 9 mph) burst** once your rear bumper clears the other vehicle. Clearance is measured from the actual body outlines; touching, an unsafe hairline gap, or a distant pass earns no reward. Boosts preserve your momentum heading, respect the normal speed cap and braking, and have a 1.25-second cooldown. Blue/orange flame ribbons behind the rear wheels show the burst for about 0.32 seconds, then fade.
- Four forward lanes and an oncoming carriageway, with 84 m retractable median crossovers every 600 m. Gates cycle open, warn in amber, and close; signals and the minimap show the same state as collision geometry. An occupied crossover stays open until the car clears the median. Traffic uses headway braking, guarded lane changes and bounded recycling. Vehicles face their actual travel direction.
- Collect glowing green shield pickups for **8 seconds of damage and explosion protection**, or amber turbo pickups for **6 seconds of stronger acceleration and a 103 m/s (230 mph) speed ceiling**. Powers activate automatically, can run together, and refresh their own timer on collection. Hold W / GO to use turbo; braking retains priority. The HUD shows both timers, a cyan bubble shows the shield, and rear flame ribbons show turbo thrust. Shielded vehicle impacts preserve the player’s momentum and shove traffic sideways out of the lane, including heavier vehicles. Barrier impacts still stop the car, and collisions still deduct score. Pickups stream along the highway without respawning when reversing.
- Hard frontal impacts (at least 22 m/s closing speed), and vehicle impacts from any direction at 30 m/s or faster, explode unshielded cars, with a fireball, smoke, sparks and body fragments, then end the drive. This includes high-speed impacts into slower traffic as well as oncoming cars. Gentle bumps, sideswipes and barrier scrapes remain survivable. Explosion shaders and GPU buffers warm during loading, and contact particles reuse a fixed pool. The explosion and smoke advance in real time even when a frame is delayed. The centered results window appears after the four-second smoke effect clears; record writes happen then. Press R or choose Drive Again to restart.
- Police use the VORTEX-9 interceptor, PHANTOM-6 undercover coupe, SENTINEL-X armored SUV and BARRICADE-12 tactical truck. Quiet patrols activate their own lights, spatial police sirens and pursuit AI when overtaken or struck. Chase speeds and acceleration are higher; units close gaps sooner, overtake more decisively and attempt aligned rear-quarter rams with shorter cooldowns. Passing lanes remain reserved until the blocker is clear, and service-road speed/steering limits still apply. Models retain distinct performance: VORTEX 112 m/s, PHANTOM 118 m/s, SENTINEL 102 m/s, BARRICADE 88 m/s. Active units persist, use actual force-based movement and stay inside their selected road corridor. Pursuit escalates to level five; sirens follow real vehicle positions. Low-speed capture requires five seconds near police. Nonfatal body damage leaves the player’s controls available; an unshielded hard frontal impact ends the drive.
- A seeded, streamed highway and city, road signs, lighting and overpasses. Fourteen 120 m chunks surround the car, with six behind and seven ahead of the current chunk; scene coordinates rebase every kilometer while logical distance stays continuous.
- Northbound side streets exit right first at 800 m and then every 1.8 km. Three routes vary their bends and distance from the highway; each runs for 900 m before merging back. They have connected lanes, traffic, road bounds and map guidance. Normal top speed is 180 mph; turbo raises it to 230 mph.
- A cyan, magenta and violet cyberpunk interface with neon instrument accents, glowing controls and legible dark panels.
- Fifteen original futuristic vehicle prefabs with native dimensions, distinct sculpted bodies, six wheel families, recessed LED assemblies, functional brake/turn/reverse/emergency lights, shared geometry and two distant LODs. The cyan NEBULA XR is playable with its own cockpit, dashboard, steering, mirrors and wipers. Weighted traffic mixes commuters, luxury cars, taxis, delivery vans, pickups, rare hypercars, articulated semis, buses, police and emergency vehicles. See [the fleet](docs/CYBER_FLEET.md). The reference-inspired rebuild includes curved panels, real wheel openings, detailed wheels and underbodies. Open `/vehicles.html` to inspect and download each model; `npm run models:export` reproduces all 46 GLB files (three LODs per vehicle plus the player rig).
- Layered violet street mist and a soft neon sunset fixed far ahead down the highway, visible through the fog in forward views and absent when looking behind. Buildings fade completely into the matching horizon before streaming boundaries; ambient occlusion fades out inside the mist so distant geometry leaves no outlines.
- A procedural cyberpunk city with instanced HIVE, ARCOLOGY and CAPSULE buildings, mapped onto the reserved plots from the [100-building catalog](docs/BUILDING_CATALOG.md), plus varied flowering trees and curved-frond palms. Enclosed/open skybridges, expressway gantries and moving hovercars/transports/drones add transport layers. A cyberpunk night palette with an indigo sky, pink horizon disc, taller glass towers, cyan/magenta architectural LEDs, illuminated windows, amber streetlamps, glazed skywalks, purple foliage and palms. Original holographic portrait, CHILLWAVE DRIVE, vaporwave sunset and vertical Japanese signs share one generated atlas. Sparse aerial vehicles follow continuous world-space routes above the bridges.
- Photographic CC0 asphalt color/normal/roughness maps and subdued HDR fill, world-anchored neon light streaks on every preset and irregular wetness/puddle masks, varied physical roughness, distorted and blurred Fresnel reflections blended over the lit asphalt with stable depth bias, a camera-relative plane and mipmapped filtering, stable sun-shadow projection, smooth traffic-light ownership/range transitions, shared world-aligned textures across clipped highway/ramp junctions, flat road paint, local shadows, preset-controlled SSAO and restrained bloom. Post-processing uses multisampled color buffers; ambient occlusion tracks the live camera projection and excludes transparent overlays. Chase-view depth precision, off-screen reflection fading, a fog-covered reflection extent, stable tire-spray seeds and per-frame cockpit mirrors reduce shimmer, flashing and judder. Environment and asphalt maps finish loading before driving; color reflections ignore normal/depth passes. Local police illumination crossfades while the actual lightbar signals. Six pooled physical roadway/storefront lights fade between fixed fixtures, and a small loading-time capture of the actual city supplies shared reflection lighting. Procedural towers have stepped crowns, cantilevered rooms, pod stacks, roof machinery, animated advertising and interior-mapped windows. A distant skyline/road proxy fades into haze beyond streamed chunks. World-relative rain follows gravity, wind and vehicle motion; overpasses shelter the road and cabin. Small tire wakes and road ripple rings replace floating splash dots. Water beads are shaded on the actual windshield, flow with gravity/airflow and are cleared by the animated blades, without covering the dashboard or HUD. Contact sparks/splashes, impact camera feedback and four presets complete the presentation.
- Rendering follows the display refresh rate, including 120 Hz displays, with interpolated 60 Hz physics. Graphics and resolution stay at the selected preset; there is no automatic quality adjustment or FPS target. Choose a preset in Settings to balance detail and performance. Fixed preset pixel caps, fewer low-preset rain/spray updates, cached streaming windows, 30 Hz HUD/map updates and 60 Hz audio control updates reduce work between frames. Actual FPS depends on the GPU, browser, display and chosen quality. Low omits expensive rendering passes.
- Load/RPM-dependent engine voices, wet tire/wind/rain layers, collision sounds, positional passing traffic and police sirens. Cockpit audio filters external sound. Music and effects have independent volume controls.
- YouTube radio plays the supplied video in a compact top-right banner with a small thumbnail, animated level bars, play/pause, expandable video controls, provider playback status and independent saved volume. It continues through game menus and pause; M toggles playback. The previous music-style controls and synthesized soundtrack are no longer used by the driving game. See [SOUNDTRACK.md](SOUNDTRACK.md).
- Garage, controls, settings, pause and failure screens; speed in MPH/gear/RPM, damage, pursuit/capture, a heading-aware nearby traffic map with vehicle silhouettes, quiet patrol markers and flashing red/blue pursuit units, near misses, distance, records and small achievement notifications.

## Assets, renderer and validation limits

The active futuristic fleet is original procedural geometry authored for Chillwave Drive. Previously bundled contemporary vehicle assets and their notices remain archived for provenance and authoring regression tests. Asphalt 02 maps and Venice Sunset HDR are **CC0 Poly Haven** assets. Full notices and original source URLs are in [asset credits](public/CREDITS.md). YouTube music is streamed by the official embedded player and is not redistributed in this repository.

Runtime vehicles use the original [cyber fleet](docs/CYBER_FLEET.md), cached procedural prefabs and model-specific collision envelopes. Legacy contemporary GLBs and their authoring instructions remain archived under `public/assets/vehicles`. Architecture combines reusable geometry with generated facade textures. Handling remains a planar single-track vehicle controller coupled to a mass/inertia contact solver; it is not a full six-degree-of-freedom suspension solver. There are no vertical vehicle launches or soft-body deformations. There is no soft-body dent or glass-fracture simulation; crash effects use bounded sparks, splash particles, smoke, a stylized fireball and rigid body fragments. Damage changes paint roughness and scratches. Steering, braking and engine power remain available at maximum accumulated body damage, unless a fatal frontal impact destroys the car. Impacts still transfer momentum, with quick recovery from collision spin. Driving audio is synthesized, including load/RPM voices, shift envelopes and filtered crash noise; it is not a recorded production engine.

WebGPU was investigated against the [official Three.js migration guide](https://threejs.org/manual/pages/webgpurenderer). Its material/postprocessing API requires porting this code's GLSL reflection and weather shaders to TSL; a renderer switch by itself would not improve those assets or physics. This build keeps **WebGL2**, with configurable SSAO/bloom/shadows/reflections and fixed preset resolution. The renderer is not advertised as WebGPU or as matching Forza Horizon. See [UPGRADE_PLAN.md](UPGRADE_PLAN.md).

The fleet library adds about 36 MB across the player and all traffic LODs, with source assets retained for reproducible offline export. Model preparation happens before play; the loading indicator keeps Start disabled until the required assets decode. Higher presets need a capable GPU. A headless Chromium renderer-resource test sweeps 100 km of actual streamed chunks and checks bounded geometry/texture counts; it is not a human-driven endurance session or a measurement of process RAM. Human handling/listening judgment, longer driving sessions, other GPU/browser combinations and the actual GitHub-hosted deployment still require separate checks.

## Checks

```bash
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Unit checks cover all 100 catalog identities and generated meshes, mixed-use frontage, compact frontage plot reservations, silhouette and parcel bounds, batched geometry, tree variation, elevated crossings, environmental-light rebasing, aerial route continuity, fixed user-selected resolution caps, shader-warmup visibility, pooled explosion lifetime, mobile preference defaults, shield shoves, live ambient-occlusion projection changes, offscreen antialiasing, fractional-scale render sizes, transparent-effect exclusion, median gate timing, occupied-crossing safety, oncoming-road access, concrete end caps, swept pickup collection, shield protection/expiry, frontal explosions, turbo speed/braking/expiry, and driving/steering/braking, wet grip, handbrake, damage cooldown, swept impacts, deterministic timesteps, graph connections, driving a complete detour, coordinate rebasing, seeded traffic spacing, opposing flow, a long recycling simulation, two-body momentum/rotation, traffic-to-traffic and roadside contacts, overtake-triggered patrol activation and persistence, timed capture, contact-free close-pass boosts and contact rejection, rotated police containment through impact recovery and full detours, road texture/paint integration, collision score penalties and record migration, handbrake direction reversal, heading persistence, stable illumination/reflection passes, records, authored cyber vehicle geometry/rigging and the archived native music loops.

Browser tests compare identical forward/rear views across chunk and origin boundaries, check the sun through mist, and check the neon night palette and road visibility on High/Low, fixed resolution during slow frames, real simultaneous touch input, sliding steering, pointer cancellation, portrait/landscape control reachability, explosion/smoke/results timing and centering, local pavement-tile brightness changes during driving, live graphics-preset changes, per-frame cockpit mirror updates, and the production build: automatic shield/turbo collection, power timers, frontal explosions and restart, median map openings/closures, actual keyboard driving, cockpit/chase/rear look, steering, pause/resume, patrol overtaking, pursuit and restart, garage/settings, persistence, touch layout, Web Audio output/lifecycle and assets under `/chillwave-drive/`. `?qa&seed=SUNSET` exposes state observations and diagnostic fast stepping of the same fixed-step simulation using actual input. A camera-only city preview checks fog boundaries without moving the simulated car. A separate streaming-window control exercises the real chunk builder/resource disposal for the soak test. Its draw uses a one-pixel scissor: the same geometry and material maps still upload to WebGL, while full-screen shading is reserved for the separate graphics checks. These diagnostics are present only with the QA query; ordinary gameplay does not teleport vehicles. UI and audio checks pause the rendering clock; driving uses actual held inputs and the same fixed-step simulation, with separate rendered camera checks. This avoids spending the CI timeout rendering hundreds of software-GPU frames. Failed CI runs retain screenshots, traces and error context as a workflow artifact. Screenshots and failures go to ignored `test-results/`.

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

City blocks use four closely packed building rows per side with 4 m plot gaps. Three neighborhood detours turn through market, foundry and canal blocks, pass beneath building arcades, and reconnect to the highway. Street geometry, parcel clearances, camera framing, minimap and police route following share the same curved road graph. Curvature-based speed limits keep traffic and pursuing police within the narrow streets.

Q and E launch visible forward/rear homing missiles with a shared 5-second recharge. Targets remain in traffic until a swept projectile collision; rockets have bounded flight time and pooled exhaust trails. The shield follows the same interpolated render pose as the player, including jump height, and fades smoothly at expiry.
