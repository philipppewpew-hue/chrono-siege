// Procedural sound effect generator using Web Audio API

let audioCtx: AudioContext | null = null;

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
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(volume, now);
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
