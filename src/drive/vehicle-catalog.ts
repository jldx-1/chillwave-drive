/** Archived GLB provenance and authoring fixtures. Runtime models live in cyber-vehicles.ts. */
export type FleetKind = 'sedan' | 'suv' | 'pickup' | 'truck' | 'hatchback' | 'sport' | 'police';
export interface VehicleAssetSpec {
  path: string; length: number; width: number; height: number; wheelRadius: number; wheelbase: number; mass: number;
  lod1Path?: string; lod2Path?: string; author: string; license: string; source: string;
}
const packSource='https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5';
const entry=(path:string,length:number,width:number,height:number,wheelRadius:number,wheelbase:number,mass:number,author:string,license:string,source:string):VehicleAssetSpec=>({
 path:'assets/vehicles/'+path+'.glb',lod1Path:'assets/vehicles/'+path+'-lod1.glb',lod2Path:'assets/vehicles/'+path+'-lod2.glb',length,width,height,wheelRadius,wheelbase,mass,author,license,source
});
export const VEHICLE_CATALOG:Record<FleetKind,VehicleAssetSpec>={
 sedan:entry('traffic/sedan',4.8,1.9,1.4764,.3379,2.8823,1600,'Comrade1280','CC-BY-4.0',packSource),
 suv:entry('traffic/suv',4.85,2,1.8236,.3955,2.873,2200,'Comrade1280','CC-BY-4.0',packSource),
 pickup:entry('traffic/pickup-truck',5.7,2.03,1.8681,.4151,3.5274,2450,'Comrade1280','CC-BY-4.0',packSource),
 truck:entry('traffic/box-truck',7.4,2.45,3.3971,.4644,4.4723,7500,'Chillwave Drive','MIT','tools/vehicle-author.ts'),
 hatchback:entry('traffic/hatchback',4.25,1.78,1.3781,.2996,2.6768,1220,'rifdanzz','CC-BY-4.0','https://sketchfab.com/3d-models/1991-honda-civic-eg6-f81da34570b145deb463fa091604d251'),
 sport:entry('traffic/sports-coupe',4.6,1.95,1.3124,.3335,2.5691,1450,'Lexyc16','CC-BY-4.0','https://sketchfab.com/3d-models/nissan-200sx-silvia-s14-f2a917a924734a89a020e7f970e55e7c'),
 police:entry('police/police-suv',5.35,2.06,2.0617,.4131,3.0702,2250,'Chillwave Drive','MIT','tools/vehicle-author.ts')
};
export const PLAYER_ASSET_PATH='assets/vehicles/player/sports-car.glb';
