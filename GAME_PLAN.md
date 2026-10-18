# Chillwave Drive implementation plan

The project has been converted from a runner into a playable, static-hosted 3D driving game. The existing Three.js/Vite/TypeScript setup, seeded random helper, bundled original music and GitHub Pages workflow are reusable. The old runner collision, generation, avatar and UI were removed once the driving implementation was connected.

## Architecture and dependencies

- `src/drive/vehicle.ts`: fixed 60 Hz single-track handling, longitudinal force/drag, automatic gears, wet grip, slip, damage and swept collisions. The accessible custom model is used instead of adding a large physics runtime; suspension presentation is a damped body response, not a four-wheel rigid-body simulation.
- `src/drive/road.ts`: deterministic road graph, four forward lanes, opposing carriageway, explicit exit/rejoin connectors and bounds; logical world distance is independent of renderer coordinates.
- `src/drive/traffic.ts`: bounded traffic pool, headway control, safe lane changes, oncoming vehicles, pursuit state machine, rear-only reinforcements and collision recovery.
- `src/drive/scene.ts`, `car.ts`, `camera.ts`: streamed highway/city chunks, reusable procedural car placeholder and cockpit, rear mirror, wet road reflections, sky, rain, lights, camera interpolation and origin rebasing.
- `src/drive/audio.ts`: load/RPM engine synthesis, tires/rain, spatial pursuit sirens and the existing synchronized multi-stem music transport.
- `src/drive/ui.ts`, `storage.ts`, `game.ts`: driving menus, HUD, settings, capture/failure, progression and separate saved records/preferences.

No external runtime services or backend. Geometry and sound effects are project-original placeholders; higher quality licensed vehicle and recorded engine assets remain an art-production task. Hyperrealism and real-device 60 FPS are targets, not promises.

## Milestones

1. Branding, plan, driving simulation and deterministic handling tests.
2. Car exterior/cockpit, same-world camera switching and controls.
3. Flowing/opposing traffic, pursuit, damage, capture and restart.
4. Endless chunks, bounded world/traffic, origin rebasing, working exit/rejoin route.
5. Rain, wet reflections, city, signs, mirrors, wipers and presets.
6. Spatial driving audio, adaptive Chillwave and persistent settings.
7. Complete menus/HUD/garage/statistics; unit and production-browser checks.
8. Static Pages build/workflow; actual repository rename and hosted deployment require repository credentials/configuration.

## Risks and validation

Test steering inertia, braking distance, wet grip, swept collision at high speed, road/branch continuity, safe spawning, opposite traffic orientation, rear-only pursuit, capture duration, bounded traffic, origin rebasing, records and music. Browser checks cover actual movement, both cameras, rear look, failure/restart, pause, sound unlock, preference persistence, small screens and a production build under `/chillwave-drive/`.

Keep controls available when assets/audio fail. Pause on blur. Avoid rendering every building with individual meshes. Use merged geometry, pooled rain and bounded chunks. Compare visual screenshots to check cockpit clipping and road readability. Record checks actually run and any environmental limits in the final report.

## Implementation and verification status

Implemented locally: all driving/gameplay milestones, including a procedural car and cockpit, four-lane/opposing traffic, rear-only police spawning with timed capture, a physically drivable exit/rejoin route, streamed city, origin rebasing, rain/spray, shared live mirror views, softened wet reflections, spatial sound and adaptive music. The custom handling model and procedural geometry are explicitly prototype approximations, not production-grade licensed car assets or a full suspension solver.

Verified: 20 unit tests, TypeScript/production build and eight production Chromium tests. Browser checks include high-quality shader compilation/screenshots and cover movement, both views/rear look, capture/report/restart, menu/garage/settings, pause and records, touch layout, music energy/loops/controls and `/chillwave-drive/` asset layout. Screenshots were inspected for cockpit clipping and overly sharp reflections, then those issues were corrected. A deterministic test drives the full detour with ordinary steering; graph connections are checked across 100 loops. Traffic runs through 9,000 simulation ticks with bounded population; this is not an hours-long GPU memory test.

Not release-verified: human handling/listening judgment, production car and recorded engine assets, calibrated real-device FPS/long GPU memory soak, other browser engines and GitHub-hosted deployment. The repository remote has not been renamed and no changes have been pushed. README contains the manual rename/Pages steps.


## Realism/patrol upgrade

See [UPGRADE_PLAN.md](UPGRADE_PLAN.md) for the new audit, implementation and renderer research. This supersedes the initial prototype notes about always-active rear-spawned police and placeholder hero car. The new model is an attributed local glTF; patrol activation is tied to genuine relative overtakes/contact; collision impulses affect both participants and roadside obstacles; the minimap renders heading-aware vehicle icons and flashing active units. The environment now uses local photographic maps/HDR, architectural modules, shadows, ambient occlusion, bloom, horizon coverage and resolution adaptation. New tests cover momentum conservation/dissipation, side impacts/rotation, continuous contacts, patrol joins/persistence, architecture variation and 100 km streamed resource disposal.
