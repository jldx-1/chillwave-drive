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
rotating cube signs are disabled; animated sign/ticker/neon shaders remain active.

Performance adaptations: neon color/intensity/flicker are per-vertex attributes so tubes
share a draw; static sign faces use padded 256px atlas tiles. Tube and porthole tessellation
is reduced for the driving camera. Small fixtures form additive distance-detail batches
with preset-specific ranges and 24m hysteresis; their shadows are omitted. Surface
programs share a cache key per pattern, since grime and scale are uniforms. Legacy
facade textures are created only when requested. Origin-only updates reuse instance buffers.

Window room attributes use flat interpolation so camera movement cannot alter room hashes.
Blinds and curtains fade to their average below pixel resolution; distant interiors converge
to steady illumination. Whole-room TV flicker is replaced by a constant cool glow.
