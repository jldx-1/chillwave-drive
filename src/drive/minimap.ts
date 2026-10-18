import type { Vehicle } from './vehicle';
import type { Traffic } from './traffic';
import { road } from './road';
/** North-up navigation uses logical world coordinates, independent of origin rebasing. */
export function drawNavigation(ctx: CanvasRenderingContext2D, player: Vehicle, traffic: Traffic, time: number): void {
  const w = ctx.canvas.width, h = ctx.canvas.height, sx = 2.5, sy = .36;
  const x = (v: number) => w * .51 + (v - player.x) * sx, y = (s: number) => h * .73 - (s - player.s) * sy;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#08131db3'; ctx.fillRect(0, 0, w, h);
  for (const [a,b] of [[-16,-.6],[.6,16]]) { ctx.fillStyle = '#49617055';ctx.fillRect(x(a), 0, (b-a)*sx, h); }
  ctx.strokeStyle = '#a2b5bf55'; ctx.lineWidth = 1;
  for (const lane of [-16,-.6,.6,16]) {ctx.beginPath();ctx.moveTo(x(lane),0);ctx.lineTo(x(lane),h);ctx.stroke();}
  ctx.setLineDash([3,5]);ctx.strokeStyle = '#afbdc32b';for(const lane of [-11.9,-8.3,-4.7,4.7,8.3,11.9]){ctx.beginPath();ctx.moveTo(x(lane),0);ctx.lineTo(x(lane),h);ctx.stroke();}ctx.setLineDash([]);
  ctx.strokeStyle = '#ccad86'; ctx.lineWidth = 5; ctx.beginPath(); let started = false;
  for (let py = -10; py < h+10; py+=2) { const s = player.s+(h*.73-py)/sy, center=road.branchCenter(s); if(center===undefined){started=false;continue;}if(!started){ctx.moveTo(x(center),py);started=true;}else ctx.lineTo(x(center),py); }ctx.stroke();
  const drawCar=(px:number,py:number,yaw:number,color:string,police:boolean,active:boolean)=>{
    ctx.save();ctx.translate(px,py);ctx.rotate(yaw);ctx.fillStyle=active? '#162635':color;
    ctx.beginPath();ctx.roundRect(-3,-6,6,12,1.5);ctx.fill();ctx.strokeStyle=police?'#d4e4ed':'#18242b';ctx.lineWidth=.7;ctx.stroke();
    ctx.fillStyle='#14202c';ctx.fillRect(-2,-3.5,4,2);ctx.fillRect(-2,2,4,1.5);
    if(police){const phase=Math.floor(time*5)%2===0;ctx.fillStyle=active?(phase?'#ff4a65':'#3f8fff'):'#8faec5';ctx.fillRect(-4,-1,8,2);if(active){ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;ctx.fillRect(-3,-1,6,2);}}
    ctx.restore();
  };
  for(const a of traffic.agents){const py=y(a.s),px=x(a.x);if((py<0||py>h)&&!a.active)continue;drawCar(Math.max(7,Math.min(w-7,px)),Math.max(18,Math.min(h-12,py)),a.yaw,a.kind==='police'?'#a2c7df':'#8d9aa4',a.kind==='police',a.active);}
  drawCar(x(player.x),y(player.s),player.yaw,'#ffe0b1',false,false);
  ctx.font='8px sans-serif';ctx.fillStyle='#c5d4de';ctx.fillText('N ↑',10,13);ctx.textAlign='right';ctx.fillStyle=traffic.level?'#ed969d':'#94bacb';ctx.fillText(traffic.level?`${traffic.activePolice.length} PURSUING`:'PATROLS',w-8,13);ctx.textAlign='left';
}
