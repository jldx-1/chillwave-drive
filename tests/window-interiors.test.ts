import {Builder} from '../src/drive/procedural-buildings/builder';
import {framedWindow} from '../src/drive/procedural-buildings/facade';
import {Rng} from '../src/drive/procedural-buildings/rng';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {LinearMipmapLinearFilter} from 'three';
import {createWindowInteriors} from '../src/drive/window-interiors';

it('generates deterministic bounded room panels with mipmaps and padded tile borders',()=>{
  const first=createWindowInteriors(),second=createWindowInteriors();
  const a=first.image as {data:Uint8Array;width:number;height:number},b=second.image as {data:Uint8Array};
  expect(a.width).toBe(768);expect(a.height).toBe(768);expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  expect(first.generateMipmaps).toBe(true);expect(first.minFilter).toBe(LinearMipmapLinearFilter);expect(first.anisotropy).toBe(4);
  const value=(x:number,y:number)=>a.data[(y*a.width+x)*4];
  const signatures=new Set<string>();
  for(let tile=0;tile<64;tile++) {
    const x=tile%8*96,y=Math.floor(tile/8)*96;
    for(const offset of [0,15,32,63]) {
      expect(value(x,y+16+offset)).toBe(value(x+16,y+16+offset));
      expect(value(x+95,y+16+offset)).toBe(value(x+79,y+16+offset));
      expect(value(x+16+offset,y)).toBe(value(x+16+offset,y+16));
    }
    const hash=createHash('sha256');
    for(let row=0;row<64;row++){const at=((y+16+row)*768+x+16)*4;hash.update(a.data.subarray(at,at+64*4));}
    signatures.add(hash.digest('hex'));
  }
  expect(signatures.size).toBeGreaterThan(12);first.dispose();second.dispose();
});

it('keeps window grid counts on each pane while retaining only the solid outer frame geometry',()=>{
  const builder=new Builder();framedWindow(builder,new Rng(1),0,2,0,3,2,{cols:4,rows:2,sill:false});
  const glass=builder.parts.get('win')![0],grid=glass.getAttribute('aFrame');
  expect(grid.count).toBe(glass.getAttribute('position').count);
  for(let i=0;i<grid.count;i++){expect(grid.getX(i)).toBe(4);expect(grid.getY(i)).toBe(2);}
  expect(builder.parts.get('frame')).toHaveLength(4);
});
