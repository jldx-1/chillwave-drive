/** Forward progress earns points; a collision breaks the clean-driving streak. */
export class DriveScore {
  points=0; cleanDistance=0; hits=0;
  private distance=0;
  get multiplier():number { return 1+Math.min(4,Math.floor(this.cleanDistance/250))*.5; }
  get value():number { return Math.floor(this.points); }
  reset():void { this.points=0;this.cleanDistance=0;this.hits=0;this.distance=0; }
  advance(distance:number):void {
    if(!Number.isFinite(distance))return;
    let remaining=Math.max(0,distance-this.distance);
    this.distance=Math.max(this.distance,distance);
    // Split tier crossings so scoring is independent of frame rate or QA step size.
    while(remaining>1e-9){
      const tier=Math.floor(this.cleanDistance/250);
      const segment=tier>=4?remaining:Math.min(remaining,(tier+1)*250-this.cleanDistance);
      this.points+=segment*this.multiplier;this.cleanDistance+=segment;remaining-=segment;
    }
  }
  breakStreak():void { this.cleanDistance=0; }
  collide(relativeSpeed:number):number {
    const penalty=Math.round(100+Math.min(500,Math.max(0,relativeSpeed)*12));
    const lost=Math.min(this.points,penalty);
    this.points-=lost;this.cleanDistance=0;this.hits++;
    return Math.round(lost);
  }
}
