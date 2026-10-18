#!/usr/bin/env python3
"""Original Chillwave Drive soundtrack. MIT; see public/audio/LICENSE.txt.
Rebuild with Python 3 + NumPy: python3 tools/generate_soundtrack.py
All instruments and compositions are synthesized here; no samples are used.
"""
from pathlib import Path
import json
import wave
import numpy as np

RATE = 24000
BPM = 72
BEATS = 32
FRAMES = round(RATE * BEATS * 60 / BPM)
BEAT = FRAMES / RATE / BEATS
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio'
MANIFEST = ROOT / 'src' / 'audio' / 'manifest.json'
CHORDS = [(48, 55, 59, 62, 64), (45, 52, 55, 59, 62), (41, 48, 52, 55, 57), (43, 50, 53, 57, 60)]
NAMES = ['atmosphere', 'bass', 'melody', 'lift']


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def add(track, audio, beat):
    """Wrap tails around the boundary so every stem is a continuous circular mix."""
    offset = round(beat * BEAT * RATE)
    np.add.at(track, (offset + np.arange(len(audio))) % FRAMES, audio)


def synth(midi, seconds, kind='pad', vapor=False):
    t = np.arange(round(seconds * RATE)) / RATE
    freq = hz(midi)
    wobble = .0045 if vapor else .0007
    phase = 2 * np.pi * freq * (t + wobble * np.sin(2 * np.pi * .4 * t) / (2 * np.pi * .4))
    if kind == 'pad':
        signal = np.sin(phase) + .28 * np.sin(phase * 2 + .1) + .11 * np.sin(phase * 3)
        signal += (.48 if vapor else .25) * np.sin(2 * np.pi * freq * 1.003 * t)
        envelope = np.minimum(t / .65, 1) * np.minimum((seconds - t) / 1.3, 1)
    elif kind == 'keys':
        # Soft FM tine piano: a rounded body and a short, metallic hammer.
        signal = np.sin(phase + .7 * np.sin(phase * 2) * np.exp(-t * 4))
        signal += .18 * np.sin(phase * 3) * np.exp(-t * 5)
        envelope = (1 - np.exp(-t * 180)) * np.exp(-t * .85) * np.minimum((seconds - t) / .3, 1)
    elif kind == 'reed':
        # Breath-like, mellow lead with a slow attack rather than an arcade bell.
        vibrato = phase + .045 * np.sin(2 * np.pi * 4.8 * t) * np.minimum(t * 2, 1)
        signal = np.sin(vibrato) + .22 * np.sin(vibrato * 2) + .08 * np.sin(vibrato * 3)
        envelope = (1 - np.exp(-t * 12)) * np.exp(-t * .8) * np.minimum((seconds - t) / .35, 1)
    elif kind == 'bass':
        signal = np.sin(phase) + (.42 if vapor else .25) * np.sin(phase * 2) + .08 * np.sin(phase * 3)
        envelope = (1 - np.exp(-t * 90)) * np.exp(-t * 2.7) * np.minimum((seconds - t) / .09, 1)
    elif kind == 'bell':
        signal = np.sin(phase + (1.3 if vapor else .6) * np.sin(phase * 2) * np.exp(-t * 2))
        signal += .22 * np.sin(phase * 2.002)
        envelope = (1 - np.exp(-t * 65)) * np.exp(-t * 2.5) * np.minimum((seconds - t) / .2, 1)
    else:
        signal = np.sin(phase) + .30 * np.sin(phase * 2) + .14 * np.sin(phase * 3) + .05 * np.sin(phase * 5)
        envelope = (1 - np.exp(-t * 24)) * np.exp(-t * 2.3) * np.minimum((seconds - t) / .2, 1)
    return signal * np.clip(envelope, 0, 1)


def drum(kind, rng):
    seconds = {'kick': .5, 'snare': .27, 'hat': .11, 'shaker': .09}[kind]
    t = np.arange(round(seconds * RATE)) / RATE
    if kind == 'kick':
        return np.sin(2 * np.pi * (48 * t + 4.8 * (1 - np.exp(-t * 24)))) * np.exp(-t * 12) * np.minimum(t * 700, 1)
    noise = rng.normal(0, .35, len(t))
    if kind in ('hat', 'shaker'):
        noise -= np.roll(noise, 1)
        return noise * np.exp(-t * (55 if kind == 'hat' else 70)) * np.minimum(t * 1800, 1)
    return (noise * .8 + .15 * np.sin(2 * np.pi * 180 * t)) * np.exp(-t * 18) * np.minimum(t * 900, 1)


def echo(track, amount):
    # Circular stereo-style delay/reverb tails are already present at loop start.
    original = track.copy()
    for delay, gain in [(BEAT * .75, .27), (BEAT * 1.5, .15), (BEAT * 2.25, .08), (.071, .10), (.113, .08)]:
        track += np.roll(original, round(delay * RATE)) * gain * amount
    return track


def render(style):
    vapor = style == 'vaporwave'
    rng = np.random.default_rng(1987 if vapor else 1984)
    tracks = [np.zeros(FRAMES, dtype=np.float64) for _ in NAMES]
    for index, chord in enumerate(CHORDS):
        beat = index * 8
        # The first layer already sounds like a slowed mall-jazz record.
        for note in chord[1:]:
            add(tracks[0], synth(note, 8 * BEAT + 2, 'pad', vapor) * .016, beat)
        for offset, velocity in [(0, 1), (2.65, .52), (4.1, .8), (6.7, .46)]:
            for voice, note in enumerate(chord[1:]):
                add(tracks[0], synth(note, 3.8, 'keys', vapor) * .045 * velocity,
                    beat + offset + voice * .018)
        for offset, interval, length in [(0, 0, 1.4), (1.7, 7, .65), (3.35, 12, .55),
                                          (4, 0, 1.3), (5.7, 7, .7), (7.25, 2, .6)]:
            add(tracks[1], synth(chord[0] - 12 + interval, length * BEAT, 'bass', vapor) * .19,
                beat + offset)
        phrase = [(1.2, chord[3], 1.3), (3.0, chord[4], .8),
                  (4.7, chord[2], 1.4), (6.5, chord[1], 1.1)]
        for offset, note, length in phrase:
            add(tracks[2], synth(note + 12, length * BEAT, 'reed', vapor) * .075, beat + offset)
        # High pursuit intensity adds syncopated piano answers and a lush upper chord wash.
        # It does not turn the track into a straight synthwave arpeggio.
        for offset in [1.7, 3.5, 5.7, 7.4]:
            for note in chord[2:]:
                add(tracks[3], synth(note + 12, 2.2, 'keys', vapor) * .035, beat + offset)
        for note in chord[2:]:
            add(tracks[3], synth(note + 12, 7 * BEAT, 'pad', vapor) * .014, beat + .3)
    for bar in range(8):
        beat = bar * 4
        for offset, velocity in [(0, 1), (2.65, .55)]:
            add(tracks[0], drum('kick', rng) * .105 * velocity, beat + offset)
        for offset in [1.04, 3.04]:
            add(tracks[1], drum('snare', rng) * .13, beat + offset)
        for step in range(8):
            swing = .065 if step % 2 else 0
            add(tracks[1], drum('shaker', rng) * (.026 if step % 2 else .017),
                beat + step * .5 + swing)
        add(tracks[2], drum('kick', rng) * .065, beat + 2)
        for offset in [1.05, 3.05]:
            clap = drum('snare', rng)
            for flam in [0, .018, .035]:
                add(tracks[3], clap * .038, beat + offset + flam)
        if bar % 2:
            for offset in [3.45, 3.78]:
                add(tracks[3], drum('snare', rng) * .04, beat + offset)
    # A periodic, low-level tape bed avoids random discontinuities at the seam.
    t = np.arange(FRAMES) / RATE
    duration = FRAMES / RATE
    texture = sum(np.sin(2 * np.pi * round(f * duration) / duration * t + f) for f in [67, 103, 719, 1741])
    tracks[0] += texture * (.0013 if vapor else .0007)
    for name, track in zip(NAMES, tracks):
        echo(track, (1.25 if vapor else .8) if name in ('atmosphere', 'melody') else .25)
        if vapor:
            # Circular resampling of the entire mix gives drums and keys the
            # same worn-cassette wow/flutter, with no discontinuity at the loop.
            positions = np.arange(FRAMES, dtype=np.float64)
            drift = 20 * np.sin(2 * np.pi * 9 * positions / FRAMES)
            drift += 2 * np.sin(2 * np.pi * 137 * positions / FRAMES)
            track[:] = np.interp((positions + drift) % FRAMES,
                                 positions, track, period=FRAMES)
            spectrum = np.fft.rfft(track)
            frequencies = np.fft.rfftfreq(FRAMES, 1 / RATE)
            spectrum *= 1 / np.sqrt(1 + (frequencies / 2800) ** 6)
            track[:] = np.fft.irfft(spectrum, n=FRAMES)
            track[:] = np.tanh(track * 1.5) / 1.5
        track -= track.mean()
        assert np.max(np.abs(track)) < .8, 'Unexpected stem peak'
        with wave.open(str(OUT / f'{style}-{name}.wav'), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes((np.clip(track, -1, 1) * 32767).astype('<i2').tobytes())
    mix = sum(t * g for t, g in zip(tracks, [.9, .8, .72, .62]))
    print(f'{style}: {duration:.6f}s, full mix peak {np.max(np.abs(mix)):.3f}, seam delta {abs(mix[0] - mix[-1]):.5f}')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for style in ['chillwave', 'vaporwave']:
        render(style)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        'bpm': BPM, 'beats': BEATS, 'sampleRate': RATE, 'frames': FRAMES,
        'duration': FRAMES / RATE, 'stems': NAMES,
        'tracks': {'chillwave': 'Sunset Circuit', 'vaporwave': 'Afterimage Avenue'},
        'license': 'MIT', 'generator': 'tools/generate_soundtrack.py'
    }, indent=2) + '\n')
