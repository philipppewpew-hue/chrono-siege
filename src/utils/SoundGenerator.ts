// Procedural sound effect generator using Web Audio API

let audioCtx: AudioContext | null = null;

// Global master volume (0..1) — controlled by the in-game slider
let masterVolume = 0.7;
let musicVolume = 0.4; // Music is quieter than SFX by default

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function resumeAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  // Apply immediately to music gain
  if (musicMasterGain) {
    musicMasterGain.gain.value = musicVolume * masterVolume;
  }
}

export function getMasterVolume(): number {
  return masterVolume;
}

interface SoundOptions {
  volume?: number;
  frequency?: number;
  duration?: number;
  type?: OscillatorType;
  decay?: number;
  pitchSlide?: number;
  noise?: boolean;
  filter?: number;
}

function playSound(opts: SoundOptions): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  const {
    volume = 0.15,
    frequency = 440,
    duration = 0.15,
    type = 'square',
    decay = 0.1,
    pitchSlide = 0,
    noise = false,
    filter = 0,
  } = opts;

  const now = ctx.currentTime;
  const effectiveVolume = volume * masterVolume;
  if (effectiveVolume <= 0.001) return;
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(effectiveVolume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  if (noise) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (filter > 0) {
      const biquad = ctx.createBiquadFilter();
      biquad.type = 'lowpass';
      biquad.frequency.setValueAtTime(filter, now);
      biquad.frequency.exponentialRampToValueAtTime(100, now + duration);
      source.connect(biquad);
      biquad.connect(gainNode);
    } else {
      source.connect(gainNode);
    }

    source.start(now);
    source.stop(now + duration);
  } else {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (pitchSlide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequency + pitchSlide),
        now + duration
      );
    }

    if (filter > 0) {
      const biquad = ctx.createBiquadFilter();
      biquad.type = 'lowpass';
      biquad.frequency.setValueAtTime(filter, now);
      source_connect(osc, biquad, gainNode);
    } else {
      osc.connect(gainNode);
    }

    osc.start(now);
    osc.stop(now + duration);
  }
}

function source_connect(osc: OscillatorNode, filter: BiquadFilterNode, gain: GainNode): void {
  osc.connect(filter);
  filter.connect(gain);
}

export const SFX = {
  shoot_arrow(): void {
    playSound({ frequency: 800, duration: 0.08, type: 'square', volume: 0.08, pitchSlide: 400 });
  },

  shoot_cannon(): void {
    playSound({ noise: true, duration: 0.2, volume: 0.12, filter: 800 });
    playSound({ frequency: 120, duration: 0.15, type: 'sine', volume: 0.1, pitchSlide: -80 });
  },

  shoot_frost(): void {
    playSound({ frequency: 1200, duration: 0.12, type: 'sine', volume: 0.07, pitchSlide: -400 });
  },

  shoot_lightning(): void {
    playSound({ frequency: 200, duration: 0.06, type: 'sawtooth', volume: 0.08, pitchSlide: 2000 });
    playSound({ noise: true, duration: 0.08, volume: 0.06, filter: 4000 });
  },

  shoot_poison(): void {
    playSound({ frequency: 300, duration: 0.15, type: 'sine', volume: 0.06, pitchSlide: -150 });
  },

  shoot_chrono(): void {
    playSound({ frequency: 600, duration: 0.25, type: 'sine', volume: 0.07, pitchSlide: -300 });
    playSound({ frequency: 900, duration: 0.2, type: 'sine', volume: 0.04, pitchSlide: -500 });
  },

  enemyDeath(): void {
    playSound({ frequency: 400, duration: 0.12, type: 'square', volume: 0.08, pitchSlide: -300 });
    playSound({ noise: true, duration: 0.1, volume: 0.06, filter: 2000 });
  },

  enemyReachBase(): void {
    playSound({ frequency: 200, duration: 0.3, type: 'sine', volume: 0.12, pitchSlide: -150 });
  },

  towerPlace(): void {
    playSound({ frequency: 500, duration: 0.1, type: 'square', volume: 0.08, pitchSlide: 200 });
  },

  towerSell(): void {
    playSound({ frequency: 600, duration: 0.15, type: 'square', volume: 0.07, pitchSlide: -400 });
  },

  towerUpgrade(): void {
    playSound({ frequency: 400, duration: 0.08, type: 'square', volume: 0.08 });
    setTimeout(() => {
      playSound({ frequency: 600, duration: 0.08, type: 'square', volume: 0.08 });
    }, 80);
    setTimeout(() => {
      playSound({ frequency: 800, duration: 0.12, type: 'square', volume: 0.08 });
    }, 160);
  },

  waveStart(): void {
    playSound({ frequency: 300, duration: 0.15, type: 'square', volume: 0.1 });
    setTimeout(() => {
      playSound({ frequency: 450, duration: 0.2, type: 'square', volume: 0.1 });
    }, 150);
  },

  uiClick(): void {
    playSound({ frequency: 700, duration: 0.05, type: 'square', volume: 0.06 });
  },

  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playSound({ frequency: freq, duration: 0.2, type: 'square', volume: 0.1 });
      }, i * 150);
    });
  },

  defeat(): void {
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playSound({ frequency: freq, duration: 0.3, type: 'sine', volume: 0.1, pitchSlide: -50 });
      }, i * 200);
    });
  },

  goldEarned(): void {
    playSound({ frequency: 1200, duration: 0.06, type: 'square', volume: 0.05, pitchSlide: 200 });
  },

  timeWarp(): void {
    playSound({ frequency: 800, duration: 0.5, type: 'sine', volume: 0.1, pitchSlide: -600 });
    playSound({ frequency: 1200, duration: 0.4, type: 'sine', volume: 0.06, pitchSlide: -900 });
  },

  cantPlace(): void {
    playSound({ frequency: 200, duration: 0.15, type: 'square', volume: 0.08 });
  },
};

// ============================================================
// BACKGROUND MUSIC SYNTHESIZER
// Generates an evolving ambient/melodic background score procedurally.
// Uses Web Audio API oscillators with built-in envelope and reverb-like decay.
// ============================================================

let musicMasterGain: GainNode | null = null;
let musicNoteTimer: number | null = null;
let musicBeat: number = 0;
let musicActive: boolean = false;

// Pentatonic minor scale for an atmospheric feel (root A2, A=110)
// Frequencies in Hz for: A, C, D, E, G across 3 octaves
const MUSIC_SCALE = [
  110.00, 130.81, 146.83, 164.81, 196.00, // A2 octave
  220.00, 261.63, 293.66, 329.63, 392.00, // A3 octave
  440.00, 523.25, 587.33, 659.25, 783.99, // A4 octave
];

// Bass line — slower, deeper notes
const MUSIC_BASS = [55.00, 65.41, 73.42, 82.41, 73.42, 65.41]; // A1, C2, D2, E2 progression

function playMusicNote(freq: number, duration: number, type: OscillatorType, volume: number, attack: number = 0.05): void {
  if (!audioCtx || !musicMasterGain) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Subtle lowpass for warmth
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.6;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicMasterGain);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function musicTick(): void {
  if (!musicActive) return;
  musicBeat++;

  // Bass line — every 4 beats
  if (musicBeat % 4 === 0) {
    const bassNote = MUSIC_BASS[Math.floor(musicBeat / 4) % MUSIC_BASS.length];
    playMusicNote(bassNote, 1.8, 'sine', 0.5, 0.1);
    // Lower harmonic
    playMusicNote(bassNote / 2, 1.8, 'triangle', 0.25, 0.1);
  }

  // Lead melody — random notes from scale, occasional rests
  if (Math.random() > 0.3) {
    const noteIdx = Math.floor(Math.random() * MUSIC_SCALE.length);
    const noteFreq = MUSIC_SCALE[noteIdx];
    // Higher notes are softer
    const volScale = 1 - (noteIdx / MUSIC_SCALE.length) * 0.5;
    playMusicNote(noteFreq, 0.6 + Math.random() * 0.4, 'triangle', 0.2 * volScale, 0.05);

    // Occasional harmony
    if (Math.random() > 0.7) {
      const harmonyIdx = (noteIdx + 2) % MUSIC_SCALE.length;
      playMusicNote(MUSIC_SCALE[harmonyIdx], 0.5, 'sine', 0.1 * volScale, 0.05);
    }
  }

  // Sparse pad chord every 16 beats
  if (musicBeat % 16 === 0) {
    const root = MUSIC_SCALE[2 + Math.floor(Math.random() * 5)];
    playMusicNote(root, 3.5, 'sine', 0.15, 0.4);
    playMusicNote(root * 1.25, 3.5, 'sine', 0.1, 0.4); // major third
    playMusicNote(root * 1.5, 3.5, 'sine', 0.08, 0.4); // fifth
  }
}

export function startMusic(): void {
  if (musicActive) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') return;

  if (!musicMasterGain) {
    musicMasterGain = ctx.createGain();
    musicMasterGain.gain.value = musicVolume * masterVolume;
    musicMasterGain.connect(ctx.destination);
  } else {
    musicMasterGain.gain.value = musicVolume * masterVolume;
  }

  musicActive = true;
  musicBeat = 0;

  // Tick every 500ms (120 BPM equivalent quarter notes)
  if (musicNoteTimer !== null) clearInterval(musicNoteTimer);
  musicNoteTimer = window.setInterval(musicTick, 500);
}

export function stopMusic(): void {
  musicActive = false;
  if (musicNoteTimer !== null) {
    clearInterval(musicNoteTimer);
    musicNoteTimer = null;
  }
  // Fade out
  if (musicMasterGain && audioCtx) {
    const now = audioCtx.currentTime;
    musicMasterGain.gain.cancelScheduledValues(now);
    musicMasterGain.gain.setValueAtTime(musicMasterGain.gain.value, now);
    musicMasterGain.gain.linearRampToValueAtTime(0, now + 0.5);
  }
}
