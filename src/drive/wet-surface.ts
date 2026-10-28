/** Shared world-space wetness field for PBR asphalt and its reflection glaze. No time input. */
export const wetSurfaceGLSL = `
float wetHash(vec2 p) { p=fract(p*vec2(.1031,.11369)); p+=dot(p,p.yx+19.19); return fract(p.x*p.y); }
float wetNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(wetHash(i),wetHash(i+vec2(1.,0.)),f.x),mix(wetHash(i+vec2(0.,1.)),wetHash(i+vec2(1.)),f.x),f.y);
}
// x = surface saturation, y = irregular standing water, z = physical roughness.
vec3 roadWetState(vec2 p) {
  float broad=wetNoise(p*vec2(.17,.065));
  float detail=wetNoise(p*vec2(.47,.23)+vec2(18.,32.));
  float curb=smoothstep(11.5,16.4,abs(p.x));
  float wheelWear=exp(-pow((mod(abs(p.x)-2.9+1.8,3.6)-1.8)*1.8,2.));
  float puddle=smoothstep(.54,.76,broad*.74+detail*.26+curb*.14-wheelWear*.055);
  float saturation=.45+.45*broad;
  float rough=mix(.29+.26*(1.-detail),.045+.055*detail,puddle);
  return vec3(saturation,puddle,rough);
}
`;
