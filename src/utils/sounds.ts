// Discord-inspired Web Audio sound synthesizer for Voice Channels & Notifications

function getAudioContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

function playTones(
  steps: Array<{ freq: number; delay: number; duration: number; type?: OscillatorType; gain?: number }>
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const maxEnd = steps.reduce((acc, s) => Math.max(acc, s.delay + s.duration), 0);

  for (const step of steps) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = step.type || 'sine';
    const start = ctx.currentTime + step.delay;
    osc.frequency.setValueAtTime(step.freq, start);
    const vol = step.gain ?? 0.08;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + step.duration + 0.01);
  }

  window.setTimeout(() => {
    ctx.close().catch(() => {});
  }, Math.ceil((maxEnd + 0.15) * 1000));
}

export function playVcJoinSound() {
  playTones([
    { freq: 440, delay: 0, duration: 0.09, type: 'triangle', gain: 0.09 },
    { freq: 587.33, delay: 0.07, duration: 0.14, type: 'triangle', gain: 0.09 },
  ]);
}

export function playVcLeaveSound() {
  playTones([
    { freq: 523.25, delay: 0, duration: 0.09, type: 'triangle', gain: 0.09 },
    { freq: 349.23, delay: 0.08, duration: 0.16, type: 'triangle', gain: 0.09 },
  ]);
}

export function playVcMuteSound() {
  playTones([
    { freq: 420, delay: 0, duration: 0.055, type: 'sine', gain: 0.075 },
    { freq: 300, delay: 0.045, duration: 0.075, type: 'sine', gain: 0.075 },
  ]);
}

export function playVcUnmuteSound() {
  playTones([
    { freq: 340, delay: 0, duration: 0.055, type: 'sine', gain: 0.075 },
    { freq: 520, delay: 0.045, duration: 0.08, type: 'sine', gain: 0.075 },
  ]);
}

export function playVcDeafenSound() {
  playTones([
    { freq: 360, delay: 0, duration: 0.07, type: 'sine', gain: 0.08 },
    { freq: 240, delay: 0.06, duration: 0.1, type: 'sine', gain: 0.08 },
  ]);
}

export function playVcUndeafenSound() {
  playTones([
    { freq: 320, delay: 0, duration: 0.06, type: 'sine', gain: 0.08 },
    { freq: 480, delay: 0.05, duration: 0.07, type: 'sine', gain: 0.08 },
    { freq: 640, delay: 0.1, duration: 0.09, type: 'sine', gain: 0.07 },
  ]);
}

export function playVcPeerJoinSound() {
  playTones([
    { freq: 540, delay: 0, duration: 0.07, type: 'sine', gain: 0.05 },
    { freq: 680, delay: 0.06, duration: 0.1, type: 'sine', gain: 0.05 },
  ]);
}

export function playVcPeerLeaveSound() {
  playTones([
    { freq: 480, delay: 0, duration: 0.07, type: 'sine', gain: 0.05 },
    { freq: 360, delay: 0.06, duration: 0.1, type: 'sine', gain: 0.05 },
  ]);
}

export function playNotificationChime() {
  playTones([
    { freq: 660, delay: 0, duration: 0.08, type: 'sine', gain: 0.06 },
    { freq: 880, delay: 0.06, duration: 0.12, type: 'sine', gain: 0.055 },
  ]);
}
