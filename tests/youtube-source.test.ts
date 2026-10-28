import {describe,it,expect} from 'vitest';
import {youtubeVideoId,RADIO_VIDEO_ID,RADIO_VIDEO_URL} from '../src/drive/youtube-source';
import {Records} from '../src/drive/storage';
describe('YouTube radio source',()=>{
  it.each([
    'wOMwO5T3yT4','https://youtu.be/wOMwO5T3yT4?si=abc',
    'https://www.youtube.com/watch?v=wOMwO5T3yT4&t=20',
    'https://youtube.com/live/wOMwO5T3yT4?feature=share',
    'https://m.youtube.com/watch?v=wOMwO5T3yT4',
    'https://www.youtube.com/embed/wOMwO5T3yT4',
  ])('accepts a video identity from %s',value=>expect(youtubeVideoId(value)).toBe(RADIO_VIDEO_ID));
  it.each(['https://evil.example/watch?v=wOMwO5T3yT4','javascript:alert(1)','https://youtube.com.evil.example/embed/wOMwO5T3yT4','https://youtube.com/playlist?list=wOMwO5T3yT4','<iframe>','https://youtu.be/bad-id'])('rejects unrelated URLs and invalid video IDs: %s',value=>expect(youtubeVideoId(value)).toBeUndefined());
  it('migrates old settings and stores only a validated canonical YouTube URL',()=>{
    const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    data.set('chillwave-drive:settings:v1',JSON.stringify({musicStyle:'mixed',musicVideoUrl:'https://youtu.be/M7lc1UVf-VE?si=abc',musicVolume:.2}));
    const records=new Records(storage,false);expect(records.settings.musicVideoUrl).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');expect(records.settings.musicVolume).toBe(.2);records.save();
    expect(JSON.parse(data.get('chillwave-drive:settings:v1')!).musicStyle).toBeUndefined();
    data.set('chillwave-drive:settings:v1',JSON.stringify({musicVideoUrl:'https://evil.example/" onfocus="alert(1)'}));
    expect(new Records(storage,false).settings.musicVideoUrl).toBe(RADIO_VIDEO_URL);
  });
});
