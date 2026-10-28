# Cyberpunk city environment

The city is playable Three.js geometry. The [supplied 100-building catalog](BUILDING_CATALOG.md) is implemented as procedural architectural assets, with shared construction components and materials. These assets are built locally; no model downloads or image-generation services run during gameplay.

## Catalog architecture

`src/drive/building-catalog.ts` preserves all 100 names, IDs, floor counts, approximate heights, footprints, entrance programs and rooftop programs. `catalog-architecture.ts` authors a separate massing recipe for every ID. These recipes drive both the streamed streets and the signature distant skyline. The older ten-form module remains available for legacy structures/tests; new catalog parcels use the 100-asset builder.

| IDs | Architectural family | Modeled examples |
| --- | --- | --- |
| 001–010 | Premium glass | Curved corner, faceted crown, terraces, unequal sails, hexagonal notch, bridged atrium |
| 011–020 | Neon commercial | Recessed portrait wall, projecting signs, palm forum, mall podium, cinema wedge, arcade bridges |
| 021–030 | Streetfront | Market overhang, pharmacy bay, restaurant balconies, hotel lounge, open parking slabs and sloped ramps |
| 031–040 | Residential | Alternating balconies, U-shaped courtyard, twin bridge apartments, offset microresidences, garden level |
| 041–050 | Technology | Slanted blade, four pillars, data ventilation, layered research veil, cross-shaped wings, diagonal frame |
| 051–060 | Entertainment | CHILLWAVE sign tower, resort, overlapping opera shells, aquarium cylinder, arena, terrace hotel |
| 061–070 | Industrial | Sawtooth loft roofs, service spines, tanks/conduits, cargo platforms, motorworks, ducts and loading bays |
| 071–080 | Civic/transit | Station circulation, terminal bridges, protected civic entrances, clinic wings, library, radar and observation ring |
| 081–090 | Skyline | Stepped needle, twin spires, monolith recess, rotating fins, triangular needle, skywell and gate bridge |
| 091–100 | Landmarks | Forest terraces, waterfall channel, supported canopy, crescent, split prism, supported orbit ring, hanging gardens, beacon and Nexus |

Major setbacks, open courtyards, connecting bridges, cantilevers, curved/concave footprints, folded panels and crowns are real geometry. Rings have thickness and angled supports. Roofs include mechanical plant, screens, antennas, skylights, pavilions, gardens, landing decks and planted pergolas. Some architectural curves and shell roofs use segmented procedural approximations suited to real-time driving.

`catalog-frontage.ts` lays out twelve ground-floor uses. A podium can combine a central office or residential lobby with independent shops, restaurant seating and a cafe. Hotels have reception/drop-off frontage, stations have gates and stairs, malls have visible interior walkways, civic buildings have broad steps and reception/shelves, and industrial facilities have recessed loading/shutter bays. Ground floors contain modeled floors, ceilings, interior walls, counters, shelves, furniture, door frames, canopies and columns. The first drive is composed around Portrait Hall and the CHILLWAVE Signature Tower; the remaining city mixes shuffled catalog assets rather than following numeric order.

## Scale, streets and placement

Dimensions are in metres. Large footprints occupy fewer, larger plots; they are never scaled down into the former 20–30 m lots. Each 120 m streaming chunk contains six to twelve buildings across both sides and three rows. The fixed fourteen-chunk window extends six chunks behind and seven ahead of the current chunk, independently of the direction the camera faces. Rows are 110 m apart, with neighborhood streets outside the largest plot. Plot reservations include balconies, canopies, larger podiums and ring crowns. Twin-tower entries reserve a shared site for both wings. Road and ramp corridors, cross streets and overpass approaches are resolved before buildings are placed. Parcels remain inside their owning chunk, including projection margins, preventing cross-chunk collisions.

The shuffled catalog is deterministic for the seed and repeats only after a complete 100-entry cycle. Smaller infill fits the remaining space around overpasses. Fuel forecourts remain in the street mix. Thirty far landmark sites instance the twenty signature silhouettes, with their real dimensions and distinctive crowns. More distant, instanced background districts sit outside the detailed city and fade into haze. World coordinates remain stable across streaming and kilometre origin changes.

Streets include curb edges, drainage grates, access covers, benches, bollards, planting boxes and layered dividers. Decorative assets do not add vehicle collision bodies or change the driveable road graph.

## Materials, road and lighting

Blue/smoked glass, graphite metal, metallic framing, concrete and shared normal/roughness maps provide the material palette. Occupied office floor clusters mix warm, neutral and cool light; apartment windows vary individually and favor warm interiors. Advertising concentrates on commercial and entertainment assets. Corporate/industrial buildings remain more restrained. Original portrait, CHILLWAVE, sunset/palm and Japanese sign art shares a static atlas.

`wet-surface.ts` supplies a common world-distance wetness field for the asphalt and reflection glaze. Saturation variation, irregular puddles and tire-worn bands vary roughness. Normal distortion, roughness-dependent blur and partial coverage break up reflections. This field remains static across chunk seams and kilometre rebases. Tire spray responds to speed, braking and steering; rain and spray stay outside solid ambient-occlusion passes.

`CityLighting` limits physical environmental lights to six shared slots, matching actual road and entrance fixtures. Ownership and range changes fade. Static road illumination carries distant warm pools and neon spill, including on Low. Building fog shaders use only the atmospheric background color, never the sun disc or halo; fog cannot paint the sun over a facade. A small environment capture of the actual city supplies shared glass, metal and paint reflections during loading. This is an approximation rather than per-window dynamic ray tracing.

## Endless mist and neon sunset

`atmosphere.ts` integrates low-lying violet mist along the view ray. Gentle foreground haze becomes denser through street-level banks, while upper architecture stays clearer. Fog banks use stable world coordinates, including after a kilometre rebase. There are no camera-crossing fog planes or randomly respawning cloud cards.

Between 420 and 680 m, every opaque urban surface blends completely into the same directional color as the sky. This finishes before either end of the streaming window can become visible, including from a phone chase camera or when looking behind. Fully hidden chunks are culled with camera-offset headroom. Ambient occlusion fades out before the haze becomes opaque, preventing hidden building edges from darkening the fog. The sky follows each rendered camera, including reflection and mirror cameras.

The neon sunset is a soft analytic disc, static synthwave bands and diffuse halo behind a violet veil. It occupies a fixed world bearing at celestial distance, directly down the forward highway. Camera rotation changes its screen position naturally; rear-facing views and mirrors face away from it. It is part of the sky and the distant haze, with normal depth occlusion by all buildings, including fully fog-covered geometry, rather than a graphic attached to the vehicle or camera. It remains present on Low and does not depend on bloom or adaptive settings. Both sky and sunset are excluded from solid depth/normal AO passes.

## Vegetation and transport

Flowering trees have branched trunks, secondary twigs and asymmetrical blossom clusters with gaps. Palms use curved fronds and separate leaflets. Planters appear on selected terraces as well as sidewalks.

Enclosed glass bridges, open pedestrian crossings and maintenance/sign gantries use decks, frames, railings and supports. The first expressway crossing is 100 metres ahead. Covered deck positions feed the rain-shelter query. Original vehicle overpasses remain in place.

Fifteen instanced hovercars, transports and drones follow separate world-space flight layers. Reduced motion freezes their animation. They stay above the bridges and ground-driving view.

## Three distance-detail tiers

- **Far:** The permanent batch preserves native-scale massing, recesses, bridges, distinctive crowns, primary windows, entrance structure and prominent signs.
- **Mid:** Adds structural floor bands, mullions, balcony railings, service screens, roof equipment and secondary entrance structure while the plot is still fully concealed by the fog.
- **Near:** Adds furniture, stocked shelves, door hardware, seating, ticket gates and selected terrace palms before any part of the plot emerges from the fog.

The latter two tiers are enabled beyond the visible mist boundary, with a 160 m minimum margin for the plot diagonal and 35 m hysteresis. All visible buildings therefore emerge with their complete geometry together. They are additive material batches per row; no models rebuild when a distance threshold changes. The distance test also follows lateral driving onto service roads. Shared materials, merged geometry, bounded streaming and instanced far silhouettes limit resource growth.

Distance detail is independent of frame rate. Image resolution, reflection quality and selected rendering passes stay at the user's chosen graphics preset. There is no automatic quality adjustment or FPS target. Hardware FPS remains dependent on the device, browser and preset.

## Verification

Unit checks build and bound every asset, verify 100 distinct structural recipes, mixed-use frontage, concave caps, native-scale placement, all twenty instanced far silhouettes, stable rebasing and distance hysteresis. Existing checks cover road reserves, materials, lighting, vegetation and gameplay.

Browser checks compare the exact same forward/rear camera before and after 120 m streaming boundaries and kilometre origin boundaries, and sample the sunset through its veil and verify that it is absent from rear-facing views. They also capture chase, architecture without LEDs/ads, driving and cockpit views. They inspect actual catalog IDs/detail groups, physical lights, moving aircraft, MPH, fixed resolution, phone input, crash/power-up behavior and streamed resource cleanup over a 100 km window sweep. Render stability tests sample pavement during movement. Screenshots are written to `test-results/city-overhaul-*.png`.
