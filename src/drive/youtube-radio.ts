import type { Preferences } from './storage';

import { RADIO_VIDEO_ID,RADIO_VIDEO_URL,youtubeVideoId,youtubeVideoURL } from './youtube-source';
export { RADIO_VIDEO_ID,RADIO_VIDEO_URL } from './youtube-source';
type RadioSettings=Pick<Preferences,'musicEnabled'|'musicVolume'>&Partial<Pick<Preferences,'musicVideoUrl'>>;
interface Player {
  playVideo():void;pauseVideo():void;setVolume(value:number):void;destroy():void;
  getVideoData?():{title?:string};getIframe():HTMLIFrameElement;
}
interface PlayerOptions {
  events:{onReady:(event:{target:Player})=>void;onStateChange:(event:{data:number})=>void;onError:(event:{data:number})=>void;onAutoplayBlocked:()=>void};
}
interface YouTubeAPI {Player:new(element:HTMLIFrameElement,options:PlayerOptions)=>Player}
declare global {interface Window {YT?:YouTubeAPI;onYouTubeIframeAPIReady?:()=>void}}
let apiLoading:Promise<YouTubeAPI>|undefined;
function loadAPI():Promise<YouTubeAPI> {
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(apiLoading)return apiLoading;
  apiLoading=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady,script=document.createElement('script');
    const timer=setTimeout(()=>fail(),15000);
    const fail=()=>{clearTimeout(timer);script.remove();apiLoading=undefined;reject(new Error('YouTube unavailable'));};
    window.onYouTubeIframeAPIReady=()=>{previous?.();clearTimeout(timer);if(window.YT?.Player)resolve(window.YT);else fail();};
    script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=fail;document.head.append(script);
  });
  return apiLoading;
}
export type RadioState='idle'|'loading'|'playing'|'paused'|'buffering'|'blocked'|'error'|'ended';
/** The official embed owns playback; the banner provides compact controls and an optional video view. */
export class YouTubeRadio {
  readonly card:HTMLElement;
  private videoId=RADIO_VIDEO_ID;
  private errorCode?:number;
  private player?:Player;
  private starting?:Promise<void>;
  private ready=false;
  private requested=false;
  private volume=.36;
  private enabled=false;
  private state:RadioState='idle';
  private disposed=false;
  private epoch=0;
  private openedForPlayback=false;
  private watchdog?:ReturnType<typeof setTimeout>;
  private status:HTMLElement;
  private button:HTMLButtonElement;
  private poster:HTMLElement;
  private visibility=()=>{
    if(document.hidden&&this.ready)this.player?.pauseVideo();
    else if(this.requested&&this.ready)this.player?.playVideo();
  };
  constructor(root:HTMLElement,private toggle:()=>void) {
    this.card=document.createElement('aside');this.card.className='radio-card';this.card.setAttribute('aria-label','YouTube radio');
    this.card.innerHTML=`<div class="radio-banner">
      <button class="radio-art" type="button" aria-label="Show YouTube video" aria-expanded="false" aria-controls="radio-player"><img src="https://i.ytimg.com/vi/${RADIO_VIDEO_ID}/hqdefault.jpg" alt="YouTube music video thumbnail" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></button>
      <div class="radio-copy"><div class="radio-heading"><span>CHILLWAVE RADIO</span><span class="radio-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div><a class="radio-status" aria-live="polite" href="${RADIO_VIDEO_URL}" target="_blank" rel="noopener" aria-label="Open music on YouTube">READY TO PLAY</a></div>
      <button type="button" class="radio-toggle" aria-label="Play YouTube music" title="Play / pause music">▶</button></div>
      <div id="radio-player" class="radio-video" hidden><div class="radio-player-heading"><span>YOUTUBE PLAYER</span><button class="radio-close" type="button" aria-label="Hide YouTube video">×</button></div><div class="radio-player-host"></div></div>`;
    root.append(this.card);this.status=this.card.querySelector('.radio-status')!;this.poster=this.card.querySelector('.radio-art')!;
    this.button=this.card.querySelector('.radio-toggle')!;this.button.addEventListener('click',this.toggle);
    this.poster.addEventListener('click',()=>this.showPlayer(this.card.querySelector<HTMLElement>('.radio-video')!.hidden));
    this.card.querySelector('.radio-close')!.addEventListener('click',()=>this.showPlayer(false));
    this.card.addEventListener('keydown',e=>{if(e.key==='Escape'){this.showPlayer(false);e.stopPropagation();}else if(e.key===' '||e.key==='Enter')e.stopPropagation();});
    document.addEventListener('visibilitychange',this.visibility);
    this.show('idle');
  }
  configure(settings:RadioSettings):void {
    const id=youtubeVideoId(settings.musicVideoUrl??RADIO_VIDEO_URL);let resume=false;
    if(id&&id!==this.videoId){
      resume=this.requested;this.epoch++;this.ready=false;this.player?.destroy();this.player=undefined;this.starting=undefined;if(this.watchdog)clearTimeout(this.watchdog);
      this.videoId=id;this.errorCode=undefined;this.poster.hidden=false;this.poster.querySelector('img')!.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
      this.card.querySelector('a')!.href=youtubeVideoURL(id);this.show('idle');
    }
    const enabling=settings.musicEnabled&&!this.enabled;this.enabled=settings.musicEnabled;
    this.volume=Math.round(Math.min(1,Math.max(0,settings.musicVolume))*100)/100;
    if(this.ready)this.player?.setVolume(Math.round(this.volume*100));
    if(!settings.musicEnabled){this.requested=false;if(this.ready)this.player?.pauseVideo();if(this.state!=='idle')this.show('paused');}
    else if(resume||enabling&&this.state!=='idle')this.play(settings);
  }
  /** Called from a user action; failed/unavailable embeds never prevent starting a drive. */
  play(settings:RadioSettings):void {
    this.configure(settings);if(!settings.musicEnabled)return;
    this.requested=true;
    if(this.ready){this.player?.playVideo();return;}
    if(this.starting)return;
    this.show('loading');
    const pending=this.initialize().catch(()=>{if(!this.disposed)this.show('error');});this.starting=pending;
    void pending.finally(()=>{if(this.starting===pending)this.starting=undefined;});
  }
  private async initialize():Promise<void> {
    this.errorCode=undefined;
    const epoch=++this.epoch,api=await loadAPI();if(this.disposed||epoch!==this.epoch)return;
    if(this.watchdog)clearTimeout(this.watchdog);
    this.player?.destroy();this.ready=false;
    this.card.querySelector('iframe')?.remove();
    const frame=document.createElement('iframe'),url=new URL('https://www.youtube.com/embed/'+this.videoId);
    for(const [key,value]of Object.entries({enablejsapi:'1',origin:location.origin,playsinline:'1',controls:'1',autoplay:'0',rel:'0'}))url.searchParams.set(key,value);
    frame.src=url.href;frame.title='Chillwave Drive YouTube music player';frame.width='320';frame.height='200';
    frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    this.card.querySelector('.radio-player-host')!.append(frame);
    this.watchdog=setTimeout(()=>{if(!this.disposed&&epoch===this.epoch&&!this.ready)this.show('error');},15000);
    this.player=new api.Player(frame,{events:{
      onReady:({target})=>{if(this.disposed||epoch!==this.epoch)return;if(this.watchdog)clearTimeout(this.watchdog);this.ready=true;target.setVolume(Math.round(this.volume*100));if(this.requested&&!document.hidden)target.playVideo();else this.show('paused');},
      onStateChange:({data})=>{
        if(this.disposed||epoch!==this.epoch)return;
        if(data===1){if(document.hidden){this.player?.pauseVideo();return;}this.requested=true;this.show('playing');}
        else if(data===2){if(!document.hidden)this.requested=false;this.show('paused');}else if(data===3)this.show('buffering');else if(data===0)this.show('ended');
        else if(data===5)this.show('paused');
      },
      onError:({data})=>{if(!this.disposed&&epoch===this.epoch){this.errorCode=data;if(this.watchdog)clearTimeout(this.watchdog);this.ready=false;this.show('error');}},
      onAutoplayBlocked:()=>{if(!this.disposed&&epoch===this.epoch)this.show('blocked');},
    }});
  }
  private show(state:RadioState):void {
    this.state=state;this.card.dataset.playback=state;
    const text:Record<RadioState,string>={idle:'READY TO PLAY',loading:'CONNECTING…',playing:'NOW PLAYING',paused:'PAUSED',buffering:'BUFFERING…',blocked:'TAP PLAY IN VIDEO',error:'UNAVAILABLE · RETRY',ended:'FINISHED · PLAY AGAIN'};
    this.status.textContent=state==='error'&&[101,150].includes(this.errorCode??0)?'PLAY ON YOUTUBE':text[state];
    const playing=state==='playing'||state==='buffering'||state==='loading';
    this.button.textContent=playing?'Ⅱ':state==='error'?'↻':'▶';
    this.button.setAttribute('aria-label',playing?'Pause YouTube music':state==='error'?'Retry YouTube music':'Play YouTube music');
    if(state==='blocked'&&this.card.querySelector<HTMLElement>('.radio-video')!.hidden)this.showPlayer(true,true);
    if(state==='playing'&&this.openedForPlayback)this.showPlayer(false);
    document.querySelector('[data-action="mute"]')?.setAttribute('aria-pressed',String(playing));
  }
  private showPlayer(open:boolean,automatic=false):void {
    this.openedForPlayback=open&&automatic;
    this.card.querySelector<HTMLElement>('.radio-video')!.hidden=!open;
    this.poster.setAttribute('aria-expanded',String(open));this.poster.setAttribute('aria-label',open?'Hide YouTube video':'Show YouTube video');
  }
  get diagnostics(){return {videoId:this.videoId,errorCode:this.errorCode,state:this.state,ready:this.ready,requested:this.requested,volume:this.volume};}
  dispose():void {this.disposed=true;this.epoch++;if(this.watchdog)clearTimeout(this.watchdog);document.removeEventListener('visibilitychange',this.visibility);this.player?.destroy();this.button.removeEventListener('click',this.toggle);this.card.remove();}
}
