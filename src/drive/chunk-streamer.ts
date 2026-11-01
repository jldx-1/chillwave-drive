import type {CityChunkSpec} from './world-layout';
import type {MaterialSchema,PackedChunk} from './chunk-codec';
/** A small predictive cache coalesces queued jobs, keeping geometry construction off the driving thread. */
export class ChunkStreamer {
  private worker?:Worker;
  private ready=new Map<number,{data:PackedChunk;spec:CityChunkSpec}>();
  private wanted=new Set<number>();
  private epoch=0;private seed='';private error?:string;private hits=0;private misses=0;private built=0;
  constructor(schema:MaterialSchema) {
    try {
      this.worker=new Worker(new URL('./city-worker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=(event:MessageEvent<{epoch:number;id:number;data?:PackedChunk;spec?:CityChunkSpec;error?:string}>)=>{
        const value=event.data;if(value.error){this.error=value.error;this.worker?.terminate();this.worker=undefined;return;}if(value.epoch===this.epoch&&this.wanted.has(value.id)&&value.data&&value.spec){this.ready.set(value.id,{data:value.data,spec:value.spec});this.built++;}
      };
      this.worker.onerror=event=>{this.error=event.message;event.preventDefault();this.worker?.terminate();this.worker=undefined;this.ready.clear();};
      this.worker.postMessage({type:'init',schema});
    }catch {this.worker=undefined;}
  }
  reset(seed:string):void {this.epoch++;this.seed=seed;this.ready.clear();this.wanted.clear();this.hits=this.misses=this.built=0;}
  predict(current:number,ahead:number,behind:number):void {
    if(!this.worker)return;
    this.wanted=new Set([current+ahead+1,current+ahead+2,current+ahead+3,current-behind-1]);
    for(const id of this.ready.keys())if(!this.wanted.has(id))this.ready.delete(id);
    this.worker.postMessage({type:'window',epoch:this.epoch,seed:this.seed,ids:[...this.wanted].filter(id=>!this.ready.has(id))});
  }
  take(id:number):{data:PackedChunk;spec:CityChunkSpec}|undefined {const result=this.ready.get(id);if(result){this.ready.delete(id);this.hits++;}else this.misses++;return result;}
  get diagnostics(){return {worker:!!this.worker,ready:this.ready.size,built:this.built,hits:this.hits,synchronous:this.misses,error:this.error};}
}
