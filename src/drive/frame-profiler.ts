interface TimerExtension {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}
/** Asynchronous GPU queries never wait for a result; CPU timings include submission work. */
export class FrameProfiler {
  private extension:TimerExtension|null;
  private rendererName:string;
  private pending:WebGLQuery[]=[];
  private active?:WebGLQuery;
  private started=0;
  private cpu:number[]=[];
  private gpu:number[]=[];
  private updates:number[]=[];
  constructor(private gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');this.rendererName=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}
  restore():void {this.pending=[];this.active=undefined;this.gpu=[];this.extension=this.gl.getExtension('EXT_disjoint_timer_query_webgl2');}
  begin():void {
    const gl=this.gl,ext=this.extension;
    if(ext) {
      const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
      while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)) {
        const query=this.pending.shift()!;
        if(!disjoint)this.record(this.gpu,gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);
        gl.deleteQuery(query);
      }
      if(this.pending.length<6&&!gl.isContextLost()) {
        const query=gl.createQuery();if(query){this.active=query;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
      }
    }
    this.started=performance.now();
  }
  end():void {
    this.record(this.cpu,performance.now()-this.started);
    if(this.active){this.gl.endQuery(this.extension!.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=undefined;}
  }
  update(ms:number):void {this.record(this.updates,ms);}
  private record(values:number[],ms:number){values.push(ms);if(values.length>120)values.shift();}
  private stats(values:number[]){const sorted=values.slice().sort((a,b)=>a-b);return {p50:sorted[Math.floor(sorted.length*.5)]??0,p95:sorted[Math.floor(sorted.length*.95)]??0};}
  get diagnostics(){return {renderer:this.rendererName,gpuTimer:!!this.extension,cpuRenderMs:this.stats(this.cpu),gpuRenderMs:this.stats(this.gpu),updateMs:this.stats(this.updates)};}
}
