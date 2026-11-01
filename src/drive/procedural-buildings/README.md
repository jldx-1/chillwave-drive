Adapted from achrefelouafi/CyberPunkProceduralBuildingsThreeJS (MIT).
Source: https://github.com/achrefelouafi/CyberPunkProceduralBuildingsThreeJS

Only the geometry, props, signs, neon font and procedural material modules are vendored.
The standalone React configurator, Blender files, texture scans, deployment configuration,
and reference checkout are not part of the shipped game. The MIT notice ships at
public/licenses/cyberpunk-buildings-MIT.txt.

Local adaptations: procedural surfaces only (no PBR texture downloads), Three.js type
compatibility, and instanced world positions/normals. procedural-city.ts handles template
creation, static extra merging, seeded family selection, parcel bounds, instance reuse,
world-origin rebasing, and shared animated shader time. Moving elevators/holograms and
rotating cube signs are disabled. Sign, billboard and neon lighting remains steady.

Performance adaptations: neon colour and intensity are constant per-piece vertex attributes so tubes
share a draw; static sign faces use padded 256px atlas tiles. Tube and porthole tessellation
is reduced for the driving camera. Small fixtures form additive distance-detail batches
with preset-specific ranges and 24m hysteresis; their shadows are omitted. Surface
programs share a cache key per pattern, since grime and scale are uniforms. Legacy
facade textures are created only when requested. Origin-only updates reuse instance buffers.

Window room attributes use flat interpolation so camera movement cannot alter room hashes.
Room panels are generated once into a shared 768px grayscale atlas with 16px gutters,
trilinear mipmaps and anisotropic filtering. Per-pane colours remain seeded and steady;
subpixel rooms fade to their average illumination. This replaces view-dependent ray-marched
interior lights. Window depth bias separates panes from their backing walls, and rougher
glass softens moving reflection highlights.

Inner mullions use area-filtered shader coverage with the original pane grid counts,
rather than thin opaque strips that shimmer at driving distances. Solid outer frames remain.

Neon and sign emissions are steady and view-independent. The imported broken-tube,
chaser, billboard glitch and scanline effects are disabled. Batched sign colours and
intensities use flat interpolation; lightbox faces have depth bias against their boards.
