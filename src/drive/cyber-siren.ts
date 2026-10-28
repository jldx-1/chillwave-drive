/** Smooth scanner sweeps with a fifth above the carrier and restrained frequency modulation. */
export function cyberSirenTone(time:number,id:number,urgent:boolean) {
  const phase=(time+id*.137)/(urgent?.74:1.65),sweep=.5-.5*Math.cos(phase*Math.PI*2);
  const carrier=(urgent?420:360)+(urgent?470:390)*sweep;
  return {carrier,harmony:carrier*1.5+Math.sin(time*4+id)*5,modulation:27+sweep*12,depth:9+sweep*14,
    level:(urgent?.085:.072)*(.8+.2*Math.sin(time*Math.PI*2*(urgent?6:3)+id))};
}

/** One bounded spatial voice per alerted unit; no sample loading or per-frame node creation. */
export class CyberSiren {
  readonly panner:PannerNode;
  private carrier:OscillatorNode;
  private harmony:OscillatorNode;
  private modulator:OscillatorNode;
  private modulation:GainNode;
  private mix:GainNode;
  private harmonicGain:GainNode;
  private filter:BiquadFilterNode;
  private stopped=false;
  constructor(private context:BaseAudioContext,output:AudioNode) {
    this.carrier=context.createOscillator();this.harmony=context.createOscillator();this.modulator=context.createOscillator();
    // A rounded harmonic spectrum avoids the piercing edges of a square/triangle alarm.
    this.carrier.setPeriodicWave(context.createPeriodicWave(new Float32Array(5),new Float32Array([0,1,.18,.08,.025])));
    this.harmony.type='sine';this.modulator.type='sine';
    this.modulation=context.createGain();this.modulation.gain.value=12;
    this.modulator.connect(this.modulation);this.modulation.connect(this.carrier.frequency);
    this.harmonicGain=context.createGain();this.harmonicGain.gain.value=.22;
    this.mix=context.createGain();this.mix.gain.value=0;
    this.filter=context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=2300;this.filter.Q.value=.55;
    this.carrier.connect(this.filter);this.harmony.connect(this.harmonicGain);this.harmonicGain.connect(this.filter);this.filter.connect(this.mix);
    this.panner=context.createPanner();this.panner.panningModel='HRTF';this.panner.distanceModel='inverse';this.panner.refDistance=8;this.panner.maxDistance=450;this.panner.rolloffFactor=1.25;
    this.mix.connect(this.panner);this.panner.connect(output);
    this.carrier.start();this.harmony.start();this.modulator.start();
  }
  update(time:number,id:number,urgent:boolean,x:number,z:number,when=this.context.currentTime):void {
    const tone=cyberSirenTone(time,id,urgent);
    this.carrier.frequency.setTargetAtTime(tone.carrier,when,.035);this.harmony.frequency.setTargetAtTime(tone.harmony,when,.045);
    this.modulator.frequency.setTargetAtTime(tone.modulation,when,.08);this.modulation.gain.setTargetAtTime(tone.depth,when,.08);
    this.mix.gain.setTargetAtTime(tone.level,when,.05);
    this.panner.positionX.setValueAtTime(x,when);this.panner.positionY.setValueAtTime(1.4,when);this.panner.positionZ.setValueAtTime(z,when);
  }
  dispose():void {
    if(this.stopped)return;this.stopped=true;
    for(const source of [this.carrier,this.harmony,this.modulator]){source.stop();source.disconnect();}
    for(const node of [this.modulation,this.harmonicGain,this.filter,this.mix,this.panner])node.disconnect();
  }
}
