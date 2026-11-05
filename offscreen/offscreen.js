let activeContext = null;

/**
 * Creates and resumes a fresh Web Audio context.
 * @returns {AudioContext}
 */
function getAudioContext() {
  if (activeContext && activeContext.state !== 'closed') {
    if (activeContext.state === 'suspended') {
      activeContext.resume();
    }
    return activeContext;
  }

  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  activeContext = new AudioCtxClass();
  return activeContext;
}

/**
 * Synthesizes a loud, high-visibility digital alarm buzzer sequence.
 * Uses 4 repeating bursts of dual-tone pulses at full volume.
 * @param {number} [volume=0.95]
 */
function playDigitalAlarm(volume = 0.95) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const burstCount = 4;
  const burstInterval = 0.85;

  for (let b = 0; b < burstCount; b++) {
    const burstStart = now + b * burstInterval;

    const pulses = [
      { freq: 880, offset: 0.0, dur: 0.12 },
      { freq: 1174, offset: 0.14, dur: 0.12 },
      { freq: 1480, offset: 0.28, dur: 0.12 },
      { freq: 1760, offset: 0.42, dur: 0.22 },
    ];

    for (const p of pulses) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(p.freq, burstStart + p.offset);

      const targetGain = Math.min(1.0, Math.max(0.1, volume));
      gain.gain.setValueAtTime(0.001, burstStart + p.offset);
      gain.gain.exponentialRampToValueAtTime(targetGain, burstStart + p.offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, burstStart + p.offset + p.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(burstStart + p.offset);
      osc.stop(burstStart + p.offset + p.dur + 0.02);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') {
    return false;
  }

  if (message?.action === 'PLAY_ALARM') {
    const vol = typeof message.volume === 'number' ? message.volume : 0.95;
    playDigitalAlarm(vol);
    sendResponse({ success: true, timestamp: Date.now() });
    return true;
  }

  if (message?.action === 'PING') {
    sendResponse({ success: true, ready: true });
    return true;
  }

  return false;
});
