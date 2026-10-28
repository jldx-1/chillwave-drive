export const RADIO_VIDEO_ID='wOMwO5T3yT4';
export const youtubeVideoURL=(id:string):string=>'https://www.youtube.com/watch?v='+id;
export const RADIO_VIDEO_URL=youtubeVideoURL(RADIO_VIDEO_ID);
/** Only a YouTube identity is stored/embedded; arbitrary URLs can never become iframe sources. */
export function youtubeVideoId(input:string):string|undefined {
  const value=input.trim();if(/^[\w-]{11}$/.test(value))return value;
  try {
    const url=new URL(value);if(url.protocol!=='https:'&&url.protocol!=='http:')return;
    const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
    const id=host==='youtu.be'?parts[0]:['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com'].includes(host)?parts[0]==='watch'?url.searchParams.get('v'):['embed','live','shorts'].includes(parts[0])?parts[1]:undefined:undefined;
    return id&&/^[\w-]{11}$/.test(id)?id:undefined;
  }catch{return;}
}
