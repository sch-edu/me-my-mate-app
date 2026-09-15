export type SoundEffect =
  | 'flip'
  | 'click'
  | 'correct'
  | 'error'
  | 'tick'
  | 'fanfare'
  | 'levelup'
  | 'chime'
  // Backward compatibility aliases
  | 'tap'
  | 'transition'
  | 'win'
  | 'complete';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
}

const STORAGE_SOUND_ENABLED = 'memy-mate-sound-enabled-v1';
const STORAGE_SOUND_VOLUME = 'memy-mate-sound-volume-v1';

let audioContext: AudioContext | null = null;
let listeners: Array<(settings: SoundSettings) => void> = [];

function readInitialEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_SOUND_ENABLED);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function readInitialVolume(): number {
  if (typeof window === 'undefined') return 0.8;
  try {
    const stored = window.localStorage.getItem(STORAGE_SOUND_VOLUME);
    if (stored === null) return 0.8;
    const parsed = Number.parseFloat(stored);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.8;
  } catch {
    return 0.8;
  }
}

let soundEnabled: boolean = readInitialEnabled();
let soundVolume: number = readInitialVolume();

function notifyListeners() {
  const current: SoundSettings = { enabled: soundEnabled, volume: soundVolume };
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch (error) {
      console.warn('Error in sound listener', error);
    }
  });
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_SOUND_ENABLED, String(enabled));
    } catch {
      // Storage unavailable
    }
  }
  notifyListeners();
}

export function getSoundVolume(): number {
  return soundVolume;
}

export function setSoundVolume(volume: number): void {
  soundVolume = Math.max(0, Math.min(1, volume));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_SOUND_VOLUME, String(soundVolume));
    } catch {
      // Storage unavailable
    }
  }
  notifyListeners();
}

export function subscribeSoundSettings(callback: (settings: SoundSettings) => void): () => void {
  listeners.push(callback);
  callback({ enabled: soundEnabled, volume: soundVolume });
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/**
 * Live synthesized Web Audio API sound engine.
 * Zero audio files — every tone, click, chime, and fanfare is synthesized in real time.
 */
export function playSound(name: SoundEffect): void {
  if (!soundEnabled || soundVolume <= 0) return;
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(soundVolume, now);
  master.connect(context.destination);

  switch (name) {
    case 'flip':
    case 'transition': {
      // Card flip: smooth transient swoosh with subtle highpass
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case 'click':
    case 'tap': {
      // Crisp snappy UI click
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.035);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.04);
      break;
    }

    case 'correct': {
      // Cheerful bright chime arpeggio: C5 (523) -> E5 (659) -> G5 (784)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.06, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.3);
      });
      break;
    }

    case 'error': {
      // Low dissonant descending buzz
      const freqs = [210, 196, 155];
      freqs.forEach((freq) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.25);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.045, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.26);
      });
      break;
    }

    case 'tick': {
      // Countdown timer tick: short, crisp, clock-like
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1050, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.03);

      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.035);
      break;
    }

    case 'fanfare':
    case 'win':
    case 'complete': {
      // Triumphant fanfare: C5 -> E5 -> G5 -> C6 chord flourish
      const notes = [
        { freq: 523.25, time: 0, dur: 0.2 },
        { freq: 659.25, time: 0.12, dur: 0.2 },
        { freq: 783.99, time: 0.24, dur: 0.3 },
        { freq: 1046.5, time: 0.38, dur: 0.65 },
      ];
      // Final chord harmony on the last hit
      const chord = [523.25, 659.25, 783.99, 1046.5];

      notes.forEach(({ freq, time, dur }) => {
        const start = now + time;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.065, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      });

      // Harmonic bed under final note
      chord.forEach((freq) => {
        const start = now + 0.38;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.035, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.75);
      });
      break;
    }

    case 'levelup': {
      // Sparkling rising celebratory arpeggio: A4, C#5, E5, A5, C#6, E6
      const scale = [440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51];
      scale.forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.055, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.38);
      });
      break;
    }

    case 'chime': {
      // Retro cinematic chime chord: rich warm major 9th chord (F3, C4, A4, C5, E5, G5)
      // Staggered arpeggiation with warm shimmering tail
      const chord = [
        { freq: 174.61, delay: 0.0, dur: 2.2, type: 'triangle' as const, gain: 0.055 },
        { freq: 261.63, delay: 0.06, dur: 2.3, type: 'sine' as const, gain: 0.05 },
        { freq: 440.0, delay: 0.12, dur: 2.4, type: 'sine' as const, gain: 0.045 },
        { freq: 523.25, delay: 0.18, dur: 2.3, type: 'sine' as const, gain: 0.04 },
        { freq: 659.25, delay: 0.24, dur: 2.2, type: 'triangle' as const, gain: 0.038 },
        { freq: 783.99, delay: 0.3, dur: 2.1, type: 'sine' as const, gain: 0.035 },
        { freq: 1046.5, delay: 0.38, dur: 1.9, type: 'sine' as const, gain: 0.025 },
      ];

      chord.forEach(({ freq, delay, dur, type, gain: noteGain }) => {
        const start = now + delay;
        const osc = context.createOscillator();
        const noteGainNode = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);

        noteGainNode.gain.setValueAtTime(0.0001, start);
        noteGainNode.gain.linearRampToValueAtTime(noteGain, start + 0.06);
        noteGainNode.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(noteGainNode);
        noteGainNode.connect(master);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      });
      break;
    }
  }
}
