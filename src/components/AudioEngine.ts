// Web Audio API Retro Arcade Synthesizer
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundVolume = 0.5;
let soundEnabled = true;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  // Resume context if suspended (browser security policy)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const setAudioSettings = (enabled: boolean, volume: number) => {
  soundEnabled = enabled;
  soundVolume = volume;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(enabled ? volume : 0, audioCtx.currentTime);
  }
};

const createMasterGain = (ctx: AudioContext) => {
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(soundEnabled ? soundVolume : 0, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
};

export const playSound = (type: 'coin' | 'hit' | 'shoot' | 'levelup' | 'gameover' | 'click' | 'select' | 'shield') => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const destination = createMasterGain(ctx);
  const now = ctx.currentTime;

  switch (type) {
    case 'coin': {
      // Classic ascending retro arpeggio / synth blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    }
    case 'hit': {
      // Deep explosion/impact noise
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.25);
      break;
    }
    case 'shoot': {
      // Classic descending frequency pitch sweep (laser)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
    case 'levelup': {
      // Victorious major chord scale upward run
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        
        const noteStart = now + idx * 0.07;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.08, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.25);
        
        osc.connect(gain);
        gain.connect(destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.25);
      });
      break;
    }
    case 'gameover': {
      // Melodramatic falling bass intervals
      const notes = [392.00, 349.23, 311.13, 246.94]; // G4, F4, Eb4, B3 (sad minor)
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        
        const noteStart = now + idx * 0.15;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.12, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);
        
        osc.connect(gain);
        gain.connect(destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.4);
      });
      break;
    }
    case 'click': {
      // Tiny snappy hover chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(1000, now + 0.03);
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    }
    case 'select': {
      // Upbeat digital select double beep
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      
      osc1.type = 'triangle';
      osc1.frequency.value = 587.33; // D5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      osc2.type = 'triangle';
      osc2.frequency.value = 880.00; // A5
      gain2.gain.setValueAtTime(0.12, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.22);
      break;
    }
    case 'shield': {
      // Sci-fi high resonant shield hum activation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
    }
  }
};
