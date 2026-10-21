# Local vehicle library

These self-contained glTF 2.0 files are runtime assets, not JavaScript primitive assemblies. Units are metres, +Y is up, the nose points toward -Z, and the road is Y=0. Each car has independent `Wheel_FL`, `Wheel_RL`, `Wheel_FR`, `Wheel_RR` nodes, each with a rotating child named `Spin`. Material `extras.vehicleRole` identifies paint, glass, tires and independently controlled lamps; turn signals also identify `vehicleSide`.

The player file includes the original detailed GT3 cockpit, wheel/caliper rig, steering, wipers and mirror UVs. Its root metadata retains the driver eye and source scale. The other seven models have distinct body silhouettes, source texture maps where provided, and baked LOD1/LOD2 files. The lowest tier uses material-specific convex hulls of the actual vehicle surfaces and wheels. It is a distant silhouette, not a nearby art model.

## Build and replace

`node tools/vehicle-export.mjs` rebuilds the library from the local files in `tools/vehicle-sources/` and the original offline meshes in `tools/vehicle-author.ts`. Install Chromium first with `npx playwright install chromium`. The exporter uses a temporary local Vite authoring page; no remote model services or downloads are needed at runtime or to rebuild from the checked-in sources. Three.js's glTF exporter embeds all geometry, maps and metadata.

To install a separately licensed replacement that already follows this contract:

```
node tools/vehicle-import.mjs --kind police --file /path/to/police.glb --author "Artist" --license CC-BY-4.0 --source https://original.example/model
```

The importer verifies binary completeness, embedded resources, four pivots, spinning children and required material roles. Update the catalog measurements, matching LODs and license notices after art replacement. It intentionally rejects a model that still requires rigging or external texture URLs.

## Art and provenance

See [provenance.json](provenance.json) for authors, original source URLs, redistribution licenses and checksums. [geometry-audit.json](geometry-audit.json) records actual bounds, triangle counts, wheelbase/radius and hashes of the delivered files.

The civilian fleet uses original-author CC BY models. The sedan, family SUV and pickup are individually selected, normalized derivatives of Comrade1280's original generic passenger fleet; their unrelated orphan wheels were removed. The hatchback and coupe preserve their original modelers' curved bodywork. Surface detail and material tuning were added offline. The police SUV and delivery truck are original authored meshes for this project, including their modeled lamps, wheels and interiors where present. The police is inspired by the user's reference; it is not an officially licensed Ford model.

This is game-ready browser art. The simplified generic traffic source models and original police/truck do not have the scan quality, texture density or suspension components of a commercial racing-game asset library. Their source triangle counts and delivered geometry are documented, and the replacement workflow supports higher-quality licensed art without changing gameplay.

## Collision geometry

The game uses measured convex bumper/fender footprints from the canonical LOD0 meshes. Thin mirrors, raised wings and wheel assemblies do not enlarge the heavy-body collider. Footprints retain each model's actual origin offset and rotate with the vehicle. Surface simplification is limited to 15 mm against the measured outline.

The exporter automatically runs tools/vehicle-colliders.mjs after writing the GLBs. Run node tools/vehicle-colliders.mjs after importing a replacement separately. Unit tests check the source checksum and compare the footprint against actual decoded model vertices so stale or badly fitted colliders fail validation.
