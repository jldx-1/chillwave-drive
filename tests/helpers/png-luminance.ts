import { inflateSync } from 'node:zlib';
/** Decode trusted, non-interlaced 8-bit RGB/RGBA browser screenshots for temporal image checks. */
function decodePNG(png:Buffer) {
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===6?4:png[25]===2?3:0;
  if(png[24]!==8||!channels||png[28]!==0)throw new Error('Unsupported screenshot PNG format');
  const chunks:Buffer[]=[];
  for(let offset=8;offset<png.length;){
    const length=png.readUInt32BE(offset),tag=png.toString('ascii',offset+4,offset+8);
    if(tag==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));
    offset+=length+12;
  }
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=new Uint8Array(stride*height);
  const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
  for(let row=0;row<height;row++){
    const filter=raw[row*(stride+1)];
    for(let col=0;col<stride;col++){
      const at=row*stride+col,a=col>=channels?pixels[at-channels]:0,b=row?pixels[at-stride]:0,c=row&&col>=channels?pixels[at-stride-channels]:0;
      const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):NaN;
      if(!Number.isFinite(predictor))throw new Error('Invalid screenshot PNG row filter');
      pixels[at]=(raw[row*(stride+1)+1+col]+predictor)&255;
    }
  }
  return { width, height, channels, pixels };
}
export function patchLuminance(png:Buffer,x:number,y:number,w:number,h:number):number {
  const { width, height, channels, pixels } = decodePNG(png);
  let total=0,count=0;
  for(let row=y;row<Math.min(height,y+h);row++)for(let col=x;col<Math.min(width,x+w);col++){
    const at=(row*width+col)*channels;total+=pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722;count++;
  }
  return total/(count*255);
}

/** Small tiles expose local flashing that can cancel out in a whole-road average. */
export function luminanceTiles(png:Buffer,x:number,y:number,w:number,h:number,columns=6,rows=4):number[] {
  const { width, height, channels, pixels } = decodePNG(png);
  const totals = new Array<number>(columns*rows).fill(0), counts = new Array<number>(columns*rows).fill(0);
  for(let row=y;row<Math.min(height,y+h);row++)for(let col=x;col<Math.min(width,x+w);col++){
    const tile=Math.min(rows-1,Math.floor((row-y)*rows/h))*columns+Math.min(columns-1,Math.floor((col-x)*columns/w));
    const at=(row*width+col)*channels;
    totals[tile]+=(pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722)/255;counts[tile]++;
  }
  return totals.map((value,i)=>value/Math.max(1,counts[i]));
}

/** Broad color coverage checks guard the night art direction without a brittle golden image. */
export function neonCoverage(png: Buffer) {
  const { width, height, channels, pixels } = decodePNG(png);
  let cyan = 0, magenta = 0, dark = 0;
  for (let i = 0; i < width * height; i++) {
    const at = i * channels, r = pixels[at], g = pixels[at + 1], b = pixels[at + 2];
    if (b > 95 && g > 80 && b > r * 1.25 && g > r * 1.3) cyan++;
    if (r > 100 && b > 80 && r > g * 1.3 && b > g * 1.2) magenta++;
    if (r + g + b < 180) dark++;
  }
  return { cyan: cyan / (width * height), magenta: magenta / (width * height), dark: dark / (width * height) };
}

export function imageDifference(first:Buffer,second:Buffer):number {
  const a=decodePNG(first),b=decodePNG(second);
  if(a.width!==b.width||a.height!==b.height||a.channels!==b.channels)throw new Error('Image size mismatch');
  let total=0;for(let i=0;i<a.pixels.length;i++)total+=Math.abs(a.pixels[i]-b.pixels[i]);
  return total/(a.pixels.length*255);
}
