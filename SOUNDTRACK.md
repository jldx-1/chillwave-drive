# YouTube radio

The driving game uses the official YouTube IFrame Player API to play [the supplied video](https://www.youtube.com/watch?v=wOMwO5T3yT4) (`wOMwO5T3yT4`). It does not extract audio, download the stream, or route YouTube audio through the sound-effects mixer.

A compact top-right banner keeps a small thumbnail visible alongside animated playing-state level bars and play/pause. Clicking the thumbnail opens the full video controls; closing that view keeps the music running. The expanded player is at least 200 × 200 px. Blocked playback opens the native controls until playback starts. The YouTube link remains available in the banner status. The playing indicator follows actual provider events; connecting, buffering, blocked playback, errors and the end of a video have separate states. The game does not assume the selected video is permanently live.

Start Drive or Play requests music after a user gesture. Browsers may require pressing Play again or using the native video controls. Playback needs an internet connection and permission from the video's uploader to embed it. Failed loading provides a retry and a link to YouTube; it never prevents driving. The embed includes the host origin, inline playback and a referrer policy that sends the origin.

The banner, header music button and M shortcut control playback. Music volume and sound-effect volume remain independent and persist locally. Settings includes a saved YouTube video-link field; watch, short, embed and livestream links are normalized to a validated video ID. Changing the source updates the same mini-player. Music continues through game pause, settings, results and menus. It pauses when the document is hidden. There is no music-style selector or pursuit-adaptive soundtrack in the driving game. Existing saved style preferences are ignored.

Engine, tire, rain, impact and positional siren audio still use Web Audio and follow the driving game's pause/resume lifecycle. The original synthesized arrangements, generator and licenses remain archived in `public/audio` and `src/effects`; the driving entry point no longer imports them.

Browser tests substitute a deterministic YouTube API/provider fixture to check integration, playback states, retries, volume, persistence, and zero soundtrack WAV requests. These do not prove availability of the remote video in every region or browser. Test the actual video on the deployed HTTPS origin before publishing.

API reference: https://developers.google.com/youtube/iframe_api_reference

The earlier requested video (`GBUCmMxmup0`) returned provider error 150 in the live browser check. The default was replaced with the user’s new selection (`wOMwO5T3yT4`), which reached the real YouTube player’s PLAYING state in the local browser check. For restricted videos the player reports the issue and offers the YouTube link; the saved video-link setting can select another source.

Police sirens use original layered scanner tones: a rounded carrier, fifth harmony, restrained frequency modulation and a faster close-pursuit alert. Each unit retains a spatial panner and bounded reusable nodes. The siren browser check renders six seconds of actual Web Audio to `test-results/cyber-police-siren.wav` and checks signal levels and continuity.
