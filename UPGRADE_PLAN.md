# Realism and pursuit upgrade

## Audit

The previous build has fixed-step driving and endless chunks, but: police start behind the player in pursuit; traffic-to-traffic contact has no impulse solver; player contact simply scales speed and snaps longitudinal positions; the map uses dots; bodies/city use simple geometry; wet road has no source PBR textures; directional light casts no shadows; and there is no postprocessing or measured resolution controller.

## Implementation sequence

1. Convert police into normal forward patrols. Trigger by a genuine relative overtake, activate lights/sirens only after detection, retain active agents during streaming. Track joins and trigger/capture with deterministic tests.
2. Add a reusable swept-contact/impulse solver for vehicle pairs, including relative lateral velocity, effective mass, restitution, angular impulses, penetration correction, traffic collisions and barrier impacts. Drive damage, steering/power loss, sparks/splash/debris, camera feedback and impact audio from contact severity.
3. Replace the player exterior/interior with the attributed Car Concept glTF asset; animate the actual steering and wheel nodes and retain live instruments/wipers/mirrors. Upgrade traffic bodies to curved vehicle geometry and material detail.
4. Add licensed CC0 road textures and environment lighting, modular building styles/setbacks/crowns/roof plant/facades, bounded background skyline, road-length fog coverage, local shadows, bloom/AO by preset, and adaptive resolution. Research WebGPU migration constraints; retain the tested WebGL2 renderer while its custom reflection/weather shaders and postprocessing have no TSL equivalents in this codebase.
5. Draw a heading-aware minimap with vehicle silhouettes, blue patrol indicators and alternating red/blue active police; show roads and service-loop connectors around and behind the player. Preserve cockpit/chase controls and adaptive music.
6. Run unit tests (including long deterministic drives), actual production browser scenarios, visual screenshots, asset checks under the repository prefix, and a renderer-resource soak. State real hardware/hosted deployment limits explicitly.

## Asset provenance and release conditions

Car Concept: Eric Chadwick / Darmstadt Graphics Group GmbH, 2024, CC-BY-4.0, distributed by Khronos glTF Sample Assets; embedded logos retain separate trademark terms and imply no endorsement. Poly Haven textures/HDR are CC0; source URLs and licenses ship with assets. No commercial racing-game assets.

Browser WebGPU is investigated against official Three.js documentation. It is not enabled by relabeling the current WebGL renderer. Physics and gameplay take precedence over optional rendering passes; Low remains available. A new local build or prefix test does not establish that GitHub's deployed site has been updated.


## Verified result

- 30 unit tests pass: handling, wet grip, two-body momentum/energy, side impacts and angular response, swept contacts, traffic collisions, roadside obstacles, damage performance/alignment, patrol triggers/persistence/joins, capture timer, road/detour/origin behavior and music transport.
- Ten production Chromium checks have passed across the full suite and focused final reruns. They cover actual keyboard driving and view switching, pause/records/restart, actual overtake activation and failure, readback of both red and blue minimap flashes, silence during patrol, real siren panners at an alerted car’s coordinates, rendered high-quality assets/shaders, settings/touch controls, music output/lifecycle and repository-prefix asset loading.
- The actual renderer/window sweep covered over 100 km, retaining 14 chunks; geometry counts varied from 198 to 228 and texture counts from 30 to 31. These are observed renderer resources, not an estimate of process RAM or real-device FPS.
- Main/chase/cockpit screenshots were inspected. Mirror sightline, duplicate instruments and dashboard color management were corrected. Static hero meshes are merged by compatible material/attribute layout; moving wheel/steering/wiper assemblies remain separate. Restart clears obsolete traffic render rigs. Service-loop lamps and bridge supports sit outside the drivable branch.
- Active pursuit is capped at eight persistent units for a bounded simulation/audio budget; patrols beyond that budget remain ordinary traffic. Earlier prototype documentation in SOUNDTRACK.md referred to a four-unit budget; that open user file was preserved.

Remaining release checks: human driving/listening, measured 60 FPS/frame pacing on real GPUs, prolonged process-memory/device soak, Firefox/Safari and the actual public GitHub Pages deployment. The custom model remains planar, and engine sound effects remain synthesized. WebGPU was researched but is not enabled in this build; see the linked official migration guidance in README.
