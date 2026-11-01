import {DataTexture,LinearFilter,LinearMipmapLinearFilter,RGBAFormat,UnsignedByteType} from 'three';

const ROOM=64,PADDING=16,CELL=ROOM+PADDING*2,COLUMNS=8,COUNT=64;
/** Static linear-light rooms with gutters and mipmaps. No time or view-dependent room illumination. */
export function createWindowInteriors():DataTexture {
  const size=CELL*COLUMNS,data=new Uint8Array(size*size*4);
  for(let tile=0;tile<COUNT;tile++) {
    const style=Math.floor(tile/16),variant=tile%16;
    const pixel=(x:number,y:number)=>{
      const u=(x+.5)/ROOM,v=(y+.5)/ROOM;
      const ceiling=.13+variant%3*.035,floor=.22;
      let light=.16+.12*(1-Math.abs(u-.5)*1.5)*(1-v*.3);
      if(v>1-ceiling)light=.23;
      if(v<floor)light=.07+.04*v/floor;
      // Perspective wall/ceiling boundaries and broad ceiling fixtures survive minification.
      if(u<.1*(1-v)||u>1-.1*(1-v))light*=.65;
      const lampX=.25+(variant%5)*.12;
      if(Math.abs(u-lampX)<(style===2?.17:.09)&&v>.85&&v<.91)light=.85;
      if(style===1&&v<.28&&u>.12&&u<.88)light=.075; // shop counter
      if(style!==1) {
        const furnitureX=.24+variant%4*.14;
        if(Math.abs(u-furnitureX)<.19&&v>.08&&v<.27)light*=.22;
        if(variant%3===0) {
          const px=.67;
          if((u-px)**2+(v-.53)**2<.045**2||(Math.abs(u-px)<.035&&v>.25&&v<.49))light*=.15;
        }
      }
      // Broad shade bands, rather than many high-frequency venetian slats.
      if(variant%4===1&&v>.42)light*=Math.floor(v*12)%2?.7:1;
      if(variant%4===2&&u>.64)light*=.6;
      return Math.round(Math.min(1,Math.max(0,light))*255);
    };
    for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++) {
      const sx=Math.max(0,Math.min(ROOM-1,x-PADDING)),sy=Math.max(0,Math.min(ROOM-1,y-PADDING));
      const at=((Math.floor(tile/COLUMNS)*CELL+y)*size+tile%COLUMNS*CELL+x)*4;
      const value=pixel(sx,sy);data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;
    }
  }
  const texture=new DataTexture(data,size,size,RGBAFormat,UnsignedByteType);
  texture.name='steady-window-interiors';texture.generateMipmaps=true;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}
export const WINDOW_ATLAS_GLSL=/*glsl*/`
uniform sampler2D tRoomInteriors;
vec3 cpInterior(vec2 uv, vec4 win) {
  float seed=win.x,style=win.w;
  vec3 h=cpH3(seed*91.7);
  float litP=style>1.5&&style<2.5?uLit*1.15:(style>0.5&&style<1.5?.92:uLit);
  float lit=step(h.x,litP);
  float group=style>2.5?3.0:floor(style+.5);
  float tile=group*16.0+floor(h.y*16.0);
  vec2 cell=vec2(mod(tile,8.0),floor(tile/8.0));
  // 16px gutters keep neighboring variants out of the mip levels used by visible panes.
  vec2 atlasUv=(cell*96.0+16.0+clamp(uv,0.0,1.0)*64.0)/768.0;
  float interior=texture2D(tRoomInteriors,atlasUv).r;
  vec2 footprint=fwidth(uv);
  interior=mix(interior,.18,smoothstep(.08,.25,max(footprint.x,footprint.y)));
  vec3 color=cpRoomLight(seed,style);
  float dim=style>2.5&&style<3.5?.35:1.0;
  return color*(lit*interior+(1.0-lit)*.008)*uRoomBright*dim;
}
`;
