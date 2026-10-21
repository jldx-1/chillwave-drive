# Vehicle assets and continuous city overhaul

## Audit before implementation

Baseline: commit 57c448b; 66 unit tests and 14 Chromium checks passed in the preceding change. The existing player uses a licensed, detailed GT3 GLB. Police and other traffic are still constructed at runtime from procedural surfaces and primitives. Police use the common swept rigid-body contact solver but not the player's vehicle dynamics. The city has no broad terrain under its buildings; its distant boxes move with a short proxy window. The service route is one lateral sine function rather than connected lanes. Visible overpasses and rain shelter use inconsistent placement rules.

## Sequence and acceptance gates

1. **Asset production first.** Create `public/assets/vehicles/` with independent player, police SUV, sedan, family SUV, pickup, box truck, hatchback and sports coupe GLBs. Prefer verified original-author CC-BY/CC0 sources. Preserve attribution, embedded notices, source URLs and checksums. Reject extracted commercial-game assets and unclear redistribution. For missing suitable art, build an authored mesh asset offline, document its art-quality limitation, and support replacement without changing gameplay. No non-player runtime box coachwork in the finished integration.
2. **Canonical asset contract.** Model units are metres, +Y up, nose toward -Z, road contact at Y=0. Root body and four wheel pivots are separate. Canonical wheel groups are `Wheel_FL`, `Wheel_RL`, `Wheel_FR`, `Wheel_RR`; meshes rotate inside those pivots. Materials/nodes carry paint, glass, tire, headlight, brake, turn-signal, red/blue emergency roles. Embed appropriate mapped surface detail and retain source maps. Catalog records dimensions, mass, wheelbase/radius, asset paths, provenance and available LODs. Offline normalization/export is reproducible. An import/replace command and validation checks keep the library maintainable.
3. **Vehicle integration.** Load GLBs through GLTFLoader using the configured Pages base URL; cache source geometry/textures and clone only per-car mutable materials/rig transforms. Replace generic sedan boxes at near and far ranges with distinct category silhouettes. Render appropriate model detail at each distance. Preserve the existing detailed player cockpit, wipers, mirrors and handling. Animate actual wheel pivots, front steering, stop/turn lamps and damped suspension presentation. Pool a bounded number of red/blue lights for active police so nearby road/car surfaces receive their light.
4. **Shared police dynamics.** Parameterize the existing Vehicle controller rather than add a second physics engine. Default player tuning remains unchanged. Give police an SUV profile with their actual dimensions/mass and a pursuit speed reserve. AI emits throttle/brake/steer inputs to that controller; the shared contact solver feeds momentum back into it. Preserve genuine overtake/contact activation, no police teleportation, controlled following/braking, persistent passing and capture. Expose actual steering/pitch/roll/braking/signals for the visual rig.
5. **Road graph and layout authority.** Retain existing public road wrappers while adding deterministic lane nodes/edges/successors and phase samples. Each occasional 800–1700 m detour contains deceleration, exit, service, return and acceleration phases. Shared endpoints/tangents, lane successors, vehicle clearance and return reachability are validated. AI commits before the fork, follows the lane, and yields during merge. Road corridor and overpass queries are authoritative for scenery placement, barriers, rain shelter and collision bounds.
6. **Continuous urban environment.** Add deterministic city parcel specifications and material-batched chunk geometry. Continuous terrain extends beneath highway, detours and city blocks, with a distant ground continuation. Reserve all driving corridors before placing buildings. Add architectural families with podiums/curtain walls/setbacks/masonry/garages/warehouse loading bays, mapped facades and frames, shop entrances/awnings, signs, parking, fuel islands, fences, planting and street infrastructure. Bound material/atlas caches. Distant districts retain seeded world positions and overlap the detailed region instead of jumping with the camera.
7. **Presentation and streaming.** Preserve HDR/PBR asphalt, wet-road reflections, AO, anti-aliasing and tone mapping; improve material balance and reflected emergency lights. Keep the sunset as the principal aesthetic. Bound chunk, model, light and particle pools, and use geometry/material sharing and category-specific distance detail. Keep camera and origin rebasing continuous. Rain shelters must match actual overpass decks.
8. **Production verification.** Validate every independent GLB, dimensions/pivots/finite attributes/material roles and individual loader operation. Test lane topology/clearance, deterministic non-overlapping parcels, terrain coverage, AI detour/merge and shared physics. Drive both views, brake/drift/collide, trigger pursuit, and load audio/models/textures under both Pages prefixes. Inspect vehicle showroom and chase/cockpit/exit/district/merge screenshots. Repeat the 100 km renderer resource sweep and report actual results, visual-art limits and unverified real-device/hosted/browser targets.

## Work boundaries

- Asset production: source/license acquisition, offline normalization/export, vehicle catalog and asset tests.
- Vehicle runtime owner: GLB cache/rig/LOD integration, bounded emergency-light rendering, readiness and production verification.
- Road/physics owner: `road.ts`, `vehicle.ts`, `traffic.ts`, dynamics configuration, and route/physics tests.
- City owner: layout/architecture/material/chunk/backdrop modules and scene environment integration; retain the scene's vehicle loop for the runtime owner.

These are coordinated implementation boundaries, not separate shipped features. Integration and screenshot review are required before declaring completion. Forza is the visual reference, not a claim that this browser renderer or authored assets match that production's art budget, suspension simulation or measured hardware performance.

## Integration and corrective model review — 2026-10-20

All eight canonical vehicle categories are integrated through GLTFLoader. The player retains the cockpit/wiper/mirror rig; traffic uses per-car mutable lamp materials with shared source buffers, separate near LODs and instanced distant silhouettes. Police use the shared Vehicle controller with an SUV profile. City parcels, terrain, deterministic skyline and connected service-route phases are implemented and covered by the new unit checks.

The model review found reversed generic fleet bodies, supplemental lamps placed from mirror-inclusive bounding boxes, incorrectly combined coupe head/reverse optics, an opaque skin behind police/truck glazing, truck wheel/step interference, and a runtime pivot-type assumption. Exports now face -Z; supplemental lenses conform to raycast body surfaces; headlights and rear optics have separate roles; glazing has real apertures; truck wheel arches, steps and lamp supports are explicit; and GLTFLoader Object3D pivots bind directly. The police source wheel dimensions are independent of exported measurements so repeated exports cannot shift the tires off the road.

Validation includes 91 unit tests, actual browser GLB decoding for all LODs, individual material/pivot checks, raycast lamp mounting, tire clearance under body tilt, independent emergency lamps, source-buffer sharing, canonical player cockpit binding, both cameras and the 100 km streaming resource sweep. Browser UI/audio checks pause the rendering clock; simulation tests use real held input and the same fixed steps, and graphics checks still render all high-preset passes. Failure screenshots, traces and context are retained by CI.

The live Pages inspection confirmed that the currently hosted HTML references src/main.ts (served as video/mp2t) and the root favicon is missing. The build checks now include every fleet GLB, both repository prefixes, JavaScript MIME and the favicon. The workflow publishes dist only after all checks pass. The repository's Pages publishing source must be GitHub Actions; changing MIME headers cannot make the source tree a compiled application.

Art limits remain explicit: the generic passenger source is simplified game art, and the original police/truck are authored browser assets rather than scanned or manufacturer-licensed models. Calibrated hardware FPS and the hosted result after deployment are not established by local software-rendered tests.

### Final local verification

- npm test: 91 passed.
- npm run test:browser: all 14 passed in 2.7 minutes, including real input/regular frame stepping, both cameras, police pursuit/capture/restart, drift, touch UI, native Web Audio and both Pages repository prefixes.
- npm run build:pages: compiled JavaScript and 84 asset/link checks passed. An additional build with VITE_BASE_PATH=/chillwave-drive/ passed the real Chromium static-subdirectory test; the final dist was restored to the portable relative-base build.
- The 100 km sweep retained 14 chunks, 415–450 GPU geometries and exactly 44 textures. Scissoring its draws retained the same resource range as full-frame sampling while reducing the local sweep to 48.2 seconds. This tests allocation/disposal, not hardware FPS or a human-driven endurance session.
- All 22 final GLBs in public and dist match the audited SHA-256 hashes. Reviewed neutral previews are saved in test-results/model-review/. The police and truck previews include their final window/step/lamp corrections.
- No deployment or remote repository settings were changed here. Commit/push the new assets and code, use GitHub Actions as the Pages source, and rerun the checked-in workflow to replace the currently hosted source HTML.

## Collision footprints and damage control revision

Collision geometry now comes from the shipped LOD0 bumper/fender meshes, including each model's origin offset. tools/vehicle-colliders.mjs generates src/drive/collision-profiles.ts; the vehicle exporter refreshes it automatically. Thin mirrors, wings and wheel assemblies are excluded from the primary solid-body footprint. Simplification stays within 15 mm of the measured convex outline, and independent GLTFLoader tests verify the fit and source checksums for all eight vehicles.

The contact solver uses continuous SAT along the oriented hull edges. Swept world bounds are used only to reject distant pairs. Actual support features determine contact lever arms, avoiding the previous world-box false hits and incorrect off-center torque. Cached orientations and the rejection stage retain dense-traffic performance.

Player damage no longer adds permanent steering alignment error, reduces engine power, or triggers disabled/immobilized game-over states. Collision momentum and visible damage remain; collision spin recovers promptly with steering. Police retain their separate power-loss tuning and the existing capture end condition.

Validation: all 105 unit tests and all 15 production Chromium tests passed; the complete browser run took 2.8 minutes. A new browser regression reaches 100% damage through real seeded traffic impacts and verifies left/right steering, braking, renewed acceleration and continued play without injected damage or poses. Its rendered result is saved in test-results/maximum-damage-driving.png. Type checking and the Pages build passed with 84 asset/link checks. The 100 km sweep remained bounded at 415–450 GPU geometries and 44 textures.


## Close-pass rewards, road integration and pursuit containment

Close passes track the minimum swept convex-body clearance throughout the encounter. Actual contacts, including low-speed touches, invalidate the encounter; the reward waits until the entire player body clears the other vehicle. A clean 8–85 cm gap above 12 m/s with at least 2 m/s relative forward speed earns a near miss. An immediate 4 m/s boost preserves momentum heading, observes the regular speed cap, never opposes braking, and cannot stack within 1.25 seconds. Abandoned approaches are discarded.

Highway and ramp paving share one height and world-space asphalt UV scale. Ramp geometry is clipped at the highway edge to remove coplanar overlap. Lane markings are flat paint rather than raised boxes/cylinders; merge hatching stays on pavement. The reflection layer blends over the lit asphalt and fades at its edges and into atmospheric haze; it uses the same fixed world-space texture phase and no duplicate shadow plane.

Police steering previews a target inside the committed road corridor. Their measured body hull, yaw and local root offsets determine permissible positions at every simulation step and again after contact resolution. Highway units cannot switch onto a disconnected service road through the generic nearest-corridor clamp; detour units still traverse the connected exit and merge. Outward impact velocity is damped at the boundary.

Regression checks cover clean passes on both sides, wider trucks, no premature/duplicate rewards, collision and tiny-gap rejection, boost heading/braking/speed-cap behavior, swept clearance, highway chase containment under lateral impulses, the full police detour, ramp UVs across chunk seams and flat paint geometry.


## Fluid illumination and driver-directed handling

Sun shadows use a fixed direction, a volume above the city roofs and world-anchored texel snapping that survives origin rebasing. Asphalt does not cast a redundant shadow onto itself. Traffic light slots retain their vehicle owners, use distance fades and fade out before reassignment; lamp positions interpolate with their cars. Police illumination crossfades continuously while the lightbar itself retains its signal. Normal/depth rendering cannot overwrite the wet-road color reflection. HDR and asphalt loading finish before Start becomes available, with the existing environment fallback on HDR failure.

The main car has quicker steering response and slew, independently of the SUV tuning. The newest pressed direction wins across arrows, WASD and touch, and keyboard repeat cannot reclaim priority. Handbrake countersteering immediately moves the front wheels to the requested side, redirects the drift target and restores front lateral authority during reversal. The automatic yaw correction toward world-forward has been removed. Neutral steering returns the wheels without applying drift alignment torque or changing the chosen heading; momentum, tire tracking and barrier reactions remain.

## Aggressive pursuit and driving score

When road alignment and traffic clearance permit, an active cop within 55 m behind the player closes at a controlled 5–10 m/s speed advantage and targets a rear quarter. Actual SUV steering, hull contact impulses and recovery provide the attack; no forced player-control shutdown or fabricated collision is used. After contact an attack cooldown prevents continuous repeat strikes. Detour attacks are restricted to the straight service stretch, and the whole SUV remains inside its committed corridor. Arrest still requires five seconds nearby at low speed.

Forward progress earns driving points. The clean-distance multiplier increases by 0.5 every 250 m up to 3; collision penalties are 100–600 points based on relative impact speed, floored at zero. A collision resets the streak. Sustained rubbing breaks the streak continuously but does not deduct a new penalty every physics frame. Reverse/backtracking does not farm points. HUD/results show score and multiplier, with a separate persisted high score that preserves previous distance records.


## Wet-road reflection stability, boost cue and steady cockpit

The requested reflection correction concerns the buildings mirrored on the pavement. The road glaze uses a consistent polygon depth bias rather than relying on a 1 mm geometric gap at grazing angles. Its plane stays anchored in the rebased scene, and the reflection target is 1024 square on High/Ultra and 512 on Medium, with generated mipmaps, a broader reconstruction filter and reduced normal-map distortion. Reflection glazes and flame ribbons are excluded from the AO solid-surface depth pass, with visibility restored after the pass; the existing color-pass guard remains.

A qualifying close pass now delivers an immediate 4 m/s burst, capped by normal maximum speed and blocked by braking. The existing cooldown prevents stacking. A 0.32-second cue drives two short blue/orange crossed flame ribbons mounted behind the actual rear-wheel pivots. One geometry/material pair is reused, no particles or point lights are allocated per reward, and the cue fades without pulsing the scene lighting.

Cockpit view fixes eye height, horizon and field of view. Procedural road vibration, impact head shake and speed-driven zoom are removed from first person. The visible cabin's sprung pitch/roll is suppressed in cockpit view while chase view retains suspension tilt. Steering/yaw and world translation still follow the actual car.

Verification adds a moving-frame road luminance check from real high-quality GPU screenshots, a browser check of the stable cockpit through acceleration/turning, a visible boost-flame duration check, and unit checks of fixed eye/FOV, instant burst timing, effect reuse and AO visibility restoration.


## Git LFS and Pages release preparation

All 41 model, audio, HDR and asphalt-map files use committed Git LFS attributes, including the original vehicle sources retained for offline export. The current revision converts the existing media to pointers without rewriting earlier commits. Local pointer hashes and sizes are checked against the complete binary working files. Git LFS installs the normal pre-push upload hook.

The Pages workflow checks out LFS content before tests/builds, runs git lfs fsck, validates the compiled artifact and publishes only dist. The artifact guard scans every output file for unresolved LFS pointers, including files not referenced by the entry HTML. Regression checks reject source TypeScript entries, incorrect filename casing and unresolved media pointers. Repository Pages settings must still select GitHub Actions. No remote settings or deployment are changed by local commits.
