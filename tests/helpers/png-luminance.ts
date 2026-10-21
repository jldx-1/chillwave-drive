import { inflateSync } from 'node:zlib';
/** Decode trusted, non-interlaced 8-bit RGB/RGBA browser screenshots for temporal image checks. */
export function patchLuminance(png:Buffer,x:number,y:number,w:number,h:number):number {
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
  let total=0,count=0;
  for(let row=y;row<Math.min(height,y+h);row++)for(let col=x;col<Math.min(width,x+w);col++){
    const at=(row*width+col)*channels;total+=pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722;count++;
  }
  return total/(count*255);
}
