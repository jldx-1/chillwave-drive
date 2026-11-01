import {buildCityChunk} from './city-chunk';
import {cityChunk} from './world-layout';
import {buildChunkMaterialPlaceholders,packChunk,chunkTransfers,type MaterialSchema} from './chunk-codec';
let materials:ReturnType<typeof buildChunkMaterialPlaceholders>|undefined;
let epoch=0,seed='',queue:number[]=[],scheduled=false;
function next() {
  scheduled=false;const id=queue.shift();if(id===undefined||!materials)return;
  try {
    const spec=cityChunk(seed,id),group=buildCityChunk(spec,materials.materials,materials.asphalt),data=packChunk(group,materials.byMaterial);
    self.postMessage({epoch,id,data,spec}, {transfer:chunkTransfers(data)});
  }catch(error){self.postMessage({epoch,id,error:String(error)});}
  if(queue.length){scheduled=true;setTimeout(next,0);}
}
self.onmessage=(event:MessageEvent<{type:string;schema?:MaterialSchema;epoch:number;seed:string;ids:number[]}>)=>{
  const message=event.data;
  if(message.schema)materials=buildChunkMaterialPlaceholders(message.schema);
  else {epoch=message.epoch;seed=message.seed;queue=message.ids;if(!scheduled){scheduled=true;setTimeout(next,0);}}
};
