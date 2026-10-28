# Futuristic vehicle fleet

`cyber-vehicles.ts` defines fifteen reusable native-metre models, traffic weights, handling values and chamfered collision envelopes. `cyber-prefabs.ts` authors each exterior from new lofted body sections, modeled canopy framing, separate light housings and LED segments, wheels, aero or utility equipment. No contemporary vehicle mesh is used by the runtime fleet.

| Model | Role | Size (length × width × height, m) |
| --- | --- | --- |
| VORTEX-9 | Standard police interceptor | 4.9 × 2.05 × 1.35 |
| SENTINEL-X | Heavy police SUV | 5.3 × 2.2 × 1.9 |
| PHANTOM-6 | Undercover pursuit coupe | 4.7 × 1.98 × 1.3 |
| BARRICADE-12 | Six-wheel tactical response | 6.4 × 2.45 × 2.5 |
| AURORA LX | Luxury electric sedan | 5.2 × 2 × 1.45 |
| LUMEN-E | Common commuter | 4.65 × 1.86 × 1.48 |
| NEBULA XR | Player / performance coupe | 4.55 × 2 × 1.25 |
| VECTOR GT | Rare hypercar | 4.75 × 2.15 × 1.12 |
| MIRA-5 | Autonomous taxi | 4.8 × 1.95 × 1.72 |
| PULSE CARGO | Delivery van | 5.5 × 2.1 × 2.45 |
| TITAN-X | Articulated six-axle semi | 17 × 2.5 × 3.95 |
| CARGO-6 | Commercial freight truck | 8 × 2.4 × 3.2 |
| ORBIT SHUTTLE | Transit bus | 10.5 × 2.5 × 3.2 |
| NOVA-4 | Utility pickup | 5.6 × 2.1 × 1.85 |
| AEGIS-7 | Emergency rescue SUV | 5.4 × 2.2 × 2.05 |

Each identity has full, medium and distant cached prefabs. Geometry and the source material library are shared; near rigs clone only materials that need per-car paint and light state. Distant vehicles are instanced from their own simplified model, including wheels. Tire rubber is dark, wheel-hub lighting restrained, and smoked traffic glazing opaque for stable depth, with transparent bus glazing to reveal lit seating. Detailed cockpit glazing is transparent. Police lights are concealed on the PHANTOM and embedded in the other response vehicles. Rescue warning timing differs from police timing.

Ordinary traffic uses weighted model selection, emphasizing commuters, sedans, taxis, delivery vehicles and utility pickups. Hypercars, large freight trucks and shuttles are rare. Police use separate patrol/pursuit spawning; tactical trucks enter the response pool at high pursuit levels. Per-model acceleration, cruise speed, steering agility, mass and collision dimensions feed the existing traffic/contact system. Police retain force-based pursuit with stronger acceleration and wet grip, higher model-specific chase speeds, quicker re-engagement and aligned rear-quarter attacks. Overtaking holds its chosen lane until the blocker is clear; attack targets remain subordinate to detour speed and steering limits. The trailer coachwork and its rear axles share a hitch pivot, with limited articulation during lane changes; collisions use the full vehicle's conservative convex envelope, updated for trailer articulation, rather than a separate trailer physics simulation. There are no newly scripted roadblock or rescue missions.

Shared wet-road reflections include the new traffic geometry. Headlight pool placement follows native vehicle length; emergency illumination follows roof height. Spray emission uses body width/length. Long and heavy models drive more slowly with gentler lane changes. The full fleet is warmed during the loading screen; no quality changes occur in response to measured frame rate.

The playable NEBULA has an original seat/dashboard, steering wheel, two wipers, mirrored surfaces and the existing rain-glass and boost effects. Its handling and collision size match the new body.

Unit tests cover every model and LOD for finite geometry, native bounds, tire contact, wheel/axle count, distinct geometry, reduced distant complexity, independent dynamic lights, cockpit rigging, weighted distribution and collision dimensions. Browser QA photographs every model from front, rear, left, right and three-quarter views on the actual wet expressway and checks its distant model. `?qa` exposes this turntable only for verification.

## Reference-sheet reconstruction (version 2)

The supplied sheets contain several overlapping lineups with different names. The game keeps its existing fifteen identities, dimensions, traffic weights and behavior. The following visual mapping guides the reconstruction; additional aircraft, motorcycles and construction vehicles pictured in the sheets are not introduced into the traffic roster.

| Game identity | Reference used for its exterior |
| --- | --- |
| NEBULA XR / player | Detailed NEXUS racing coupe sheet: wide haunches, open arches, curved canopy, hood extractors, side intakes, thin cambered wing, central twin exhaust |
| VORTEX-9 | Detailed ENFORCER interceptor and VORTEX fleet panels: contrasting police doors, pushbar, roof emitters, wing and rear diffuser |
| SENTINEL-X | Armored SENTINEL fleet panels and VOLTERA crossover proportions: broad hood, upright cabin, roof rails, steps and reinforced arches |
| PHANTOM-6 | PHANTOM fleet panels: seamless low coupe, dark glazing, tapered deck and hidden warning emitters |
| BARRICADE-12 | ENFORCER-R / tactical fleet panels: six wheels, armored equipment module, rear double doors and protected cab |
| AURORA LX | Detailed ORION sedan and APEX / ZENITH fleet panels: flowing executive body, four-door canopy and turbine-style luxury wheels |
| LUMEN-E | PULSE / VECTOR city-car panels: short commuter nose, taller cabin and compact aerodynamic wheels |
| VECTOR GT | NOVA / TORRENT / NEBULA hypercar panels: pinched center body, low canopy, wide fenders and high rear aero |
| MIRA-5 | RAVEN taxi and compact passenger panels: generous glazed cabin, roof availability module and taxi markings |
| PULSE CARGO | CARGO-VAN / CARGO-X panels: continuous high roof, front-only side glazing, sliding door rails and rear loading doors |
| TITAN-X | TITAN / HAULER-X / GRAVITY freight panels: raised cab, under-cab steps, articulated long trailer and multiple axles |
| CARGO-6 | Box/freight truck panels: separate cab, beveled cargo box, external ribs and loading hardware |
| ORBIT SHUTTLE | SHUTTLE / HORIZON bus panels: broad rounded windshield, panoramic side glazing, passenger seating and rooftop equipment |
| NOVA-4 | Detailed NEXUS utility-truck sheet: four-door cabin, open ribbed bed, cargo box, bed rails and reinforcement bars |
| AEGIS-7 | VOLTERA / STRATUS SUV panels adapted to the existing rescue identity: high cabin, roof equipment and rescue warning circuits |

`reference-coachwork.ts` generates the new curved exterior surfaces, actual wheel-well openings, separately framed glazing, recessed beveled intake housings, door seams, cambered wings, utility modules and suspension links. The wheels have revolved tire shoulders and tread channels, open metal spokes, separate brake rotors, calipers and hub fasteners. Police livery and lettering are geometry rather than screen-facing images. Opaque traffic glass and transparent cockpit / bus glass follow the existing rig behavior. These are stylized, reference-inspired reconstructions, not exact copies of every inconsistent concept illustration.

The game uses the source prefabs directly, with shared geometry and merged material batches. It does not download GLBs at runtime. Reusable exports of those same prefabs are in [`public/models/cyber`](../public/models/cyber/manifest.json): fifteen full models, fifteen medium models, fifteen distant models, and `nebula-player.glb` including cockpit, mirrors, steering wheel and wipers. Each GLB retains material circuit roles, wheel pivots and the truck's trailer pivot. Native dimensions and conservative collision envelopes remain in `cyber-vehicles.ts` and in the export manifest. Full models remain under 35,000 vertices; distant models use approximately 1,600–2,400 triangles. No automatic quality reduction is introduced.

Run `npm run models:export` to reproduce all 46 GLBs and their hash/statistics manifest, without a browser, network request or listening server. Binary exports follow the repository's existing Git LFS rule. Original archived assets and their provenance are preserved.

Open `/vehicles.html` on the development server or the built site to inspect the actual exported GLBs. The studio supports all six principal views, orbit, zoom, automatic rotation, LOD selection, player cockpit selection and individual downloads. `/models/cyber/manifest.json` lists filenames, hashes, counts, native bounds and collision dimensions. On a repository subpath, both routes inherit that subpath.

Validation includes empty wheel-well raycasts, all fifteen native-bound checks, light and axle contracts at every LOD, and decoding/rigging every delivered GLB. The game turntable checks each identity from the front, rear, both sides and a three-quarter perspective on the wet expressway. The existing handling, nitro, jump and collision systems continue to operate on the same model identities.
