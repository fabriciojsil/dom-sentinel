/**
 * Plays an acoustic alert chime in the tab using Web Audio API as a secondary fallback.
 * Synthesizes sound directly with zero external audio assets.
 */
(() => {
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxClass) {
    return;
  }

  const ctx = new AudioCtxClass();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const notes = [
    { freq: 880, start: 0.0, duration: 0.15 },
    { freq: 1174, start: 0.16, duration: 0.15 },
    { freq: 1480, start: 0.32, duration: 0.15 },
    { freq: 1760, start: 0.48, duration: 0.35 },
    { freq: 880, start: 0.95, duration: 0.15 },
    { freq: 1174, start: 1.11, duration: 0.15 },
    { freq: 1480, start: 1.27, duration: 0.15 },
    { freq: 1760, start: 1.43, duration: 0.55 },
  ];

  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(note.freq, now + note.start);

    gain.gain.setValueAtTime(0.001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(0.9, now + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + note.start);
    osc.stop(now + note.start + note.duration);
  }

  setTimeout(() => {
    ctx.close().catch(() => {});
  }, 2800);
})();
