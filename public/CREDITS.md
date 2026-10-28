# Active futuristic fleet

The 15 cyber vehicle prefabs, wheels, cockpit and lighting geometry in `src/drive/cyber-prefabs.ts` and `src/drive/reference-coachwork.ts` were authored for Chillwave Drive using the supplied concept sheets as visual references. The original geometry follows the project license. [Reusable GLB exports](models/cyber/manifest.json) include all fifteen identities at three detail levels and the player cockpit rig. Runtime traffic and the playable NEBULA XR use these prefabs. Contemporary GLBs listed below are retained as archived assets and authoring fixtures.

Music is played from YouTube in its official embedded player and is not bundled or relicensed. Original sound effects remain project assets.

# Chillwave Drive — asset credits

## Main car — Porsche 911 GT3

Model: **ChevroletSS**, [Porsche 911 GT3](https://sketchfab.com/3d-models/porsche-911-gt3-78d5c47ab2554c2592b7e499179a0792), **Creative Commons Attribution 4.0 International**. [Author](https://sketchfab.com/ChevroletSS), [full license](licenses/CC-BY-4.0.txt).

The retained source [GLB](models/porsche-911-gt3/model.glb) is redistributed from [pedrosoandre/carros](https://github.com/pedrosoandre/carros/blob/main/assets/porsche-911-gt3.glb), which simplified and meshopt-compressed the source. Embedded attribution is retained. Chillwave Drive adapts scale/orientation, metallic cyan PBR paint and other materials, lamp controls, wheel/caliper/steering/wiper rigging, live gauges and mirror rendering. [Source metadata and checksum](models/porsche-911-gt3/metadata.json), [model notice](models/porsche-911-gt3/LICENSE.md).

The game loads the normalized [canonical player GLB](assets/vehicles/player/sports-car.glb), exported offline from that source with its wheel, steering, wiper and mirror rig preserved.

Porsche names and marks identify the depicted vehicle; no affiliation or endorsement is implied.

## Car Concept — retained previous model

Model and textures: **Eric Chadwick**, © 2024 **Darmstadt Graphics Group GmbH**, distributed in the Khronos glTF Sample Assets collection under **Creative Commons Attribution 4.0 International**.

- Source and authoring notes: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
- Source GLB: https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb
- Full license: [CC-BY-4.0](licenses/CC-BY-4.0.txt)
- Original metadata and notices: [metadata](models/car-concept/metadata.json), [notice](models/car-concept/LICENSE.md)
- Separate logo/trademark terms: [Khronos legal mark](licenses/LicenseRef-LegalMark-Khronos.txt)

The model originates from a public-domain concept car by Unity Fan and was cleaned, optimized and textured by the credited artist. Chillwave Drive adapts orientation, scale, paint, lamps, steering/wheel/wiper rigging, gauges and mirror views at runtime; original geometry/textures are distributed in the local GLB. The steering emblem and license-plate image are suppressed at runtime. No affiliation or endorsement by Khronos, DGG, or any car manufacturer is implied.

## Poly Haven — CC0 materials and lighting

The following assets are freely available from Poly Haven under **CC0 1.0**. Poly Haven asset licensing: https://polyhaven.com/license . They are not proprietary game assets.

- Asphalt 02 color, OpenGL normal and roughness maps, 1K JPEG, from https://polyhaven.com/a/asphalt_02
- Venice Sunset HDR lighting environment, 1K Radiance HDR, from https://polyhaven.com/a/venice_sunset

Original download URLs:

- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_diff_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_rough_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr

## Integrated vehicle fleet

The local [vehicle library](assets/vehicles/README.md) documents all eight independent GLBs, their LODs, units and rig contract. [Provenance](assets/vehicles/provenance.json) records original download URLs and authors; [geometry audit](assets/vehicles/geometry-audit.json) records the delivered bounds, wheel measurements and SHA-256 checksums.

- Sedan, family SUV and pickup: **Comrade1280**, [Generic passenger car pack](https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5), [CC BY 4.0](assets/vehicles/licenses/CC-BY-4.0.txt).
- Hatchback: **rifdanzz**, [1991 Honda Civic EG6](https://sketchfab.com/3d-models/1991-honda-civic-eg6-f81da34570b145deb463fa091604d251), CC BY 4.0.
- Sports coupe: **Lexyc16**, [Nissan 200SX Silvia S14](https://sketchfab.com/3d-models/nissan-200sx-silvia-s14-f2a917a924734a89a020e7f970e55e7c), CC BY 4.0.
- Police SUV and delivery truck: original offline authored meshes by Chillwave Drive contributors, [MIT](assets/vehicles/licenses/Original-MIT.txt).

Third-party models were redistributed through the pedrosoandre/carros project. Adaptations include selecting the relevant body and four wheels, correcting orientation/scale, baking transforms, re-rigging independent pivots, splitting front/rear/side lamp controls, fitting supplemental signals to body surfaces, PBR adjustments and producing separate LODs. The police SUV is inspired by the supplied reference and is not an officially licensed Ford asset. No models were extracted from commercial games.

## Original content

The police utility SUV, its authored geometry and fleet livery, the delivery truck, the procedural 100-building catalog interpreting the supplied architectural brief, architectural modules, facade and billboard atlases, modeled storefront interiors, skybridges, procedural flowering trees and palms, aerial vehicles, particles, sound effects and driving code were created for this project. The two original soundtrack compositions and recordings retain their separate [MIT audio notice](audio/LICENSE.txt). Three.js and the packaged fonts retain their respective upstream licenses.
