const ALARM_NAME = 'DOM_SENTINEL_ALARM';
const OFFSCREEN_PATH = 'offscreen/offscreen.html';

const ext = typeof chrome !== 'undefined' ? chrome : browser;

/**
 * In-tab extraction function executed via scripting.
 * @param {string} sel
 * @returns {Promise<{ hash: string, length: number, preview: string }>}
 */
async function tabInspectionRoutine(sel) {
  let target = null;
  if (sel && sel.trim().length > 0) {
    target = document.querySelector(sel.trim());
  }

  if (!target) {
    target = document.body;
  }

  if (!target) {
    return { hash: '', length: 0, preview: '' };
  }

  const raw = target.innerText || target.textContent || '';
  const normalized = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    hash,
    length: normalized.length,
    preview: normalized.slice(0, 120),
  };
}

/**
 * Ensures the offscreen audio playback document is loaded in Chromium/Brave.
 * @returns {Promise<boolean>}
 */
async function ensureOffscreenDocument() {
  if (typeof ext.offscreen === 'undefined' || typeof ext.offscreen.hasDocument !== 'function') {
    return false;
  }

  const hasDoc = await ext.offscreen.hasDocument();
  if (hasDoc) {
    return true;
  }

  await ext.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play audible alarm when DOM change is detected',
  });
  return true;
}

/**
 * Direct Web Audio synthesizer for Firefox and environments with background audio access.
 * @param {number} [volume=0.95]
 */
function playDirectWebAudioAlarm(volume = 0.95) {
  const AudioCtxClass = typeof AudioContext !== 'undefined'
    ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);

  if (!AudioCtxClass) {
    return;
  }

  const ctx = new AudioCtxClass();
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

  setTimeout(() => {
    ctx.close().catch(() => {});
  }, 4000);
}

/**
 * Triggers alarm audio using the optimal browser strategy.
 * @param {number} [tabId]
 * @returns {Promise<void>}
 */
async function playAlarmSound(tabId) {
  let playedOffscreen = false;
  try {
    const supported = await ensureOffscreenDocument();
    if (supported) {
      await ext.runtime.sendMessage({
        target: 'offscreen',
        action: 'PLAY_ALARM',
        volume: 0.95,
      });
      playedOffscreen = true;
    }
  } catch {}

  if (playedOffscreen) {
    return;
  }

  let playedDirect = false;
  try {
    playDirectWebAudioAlarm(0.95);
    playedDirect = true;
  } catch {}

  if (playedDirect && typeof AudioContext !== 'undefined') {
    return;
  }

  if (!tabId) {
    return;
  }

  try {
    await ext.scripting.executeScript({
      target: { tabId },
      files: ['scripts/audio-synthesizer.js'],
    });
  } catch {}
}

/**
 * Retrieves current extension state from local storage.
 * @returns {Promise<Record<string, any>>}
 */
async function getState() {
  return ext.storage.local.get([
    'isMonitoring',
    'tabId',
    'url',
    'selector',
    'intervalSeconds',
    'baselineHash',
    'lastCheckedAt',
    'checkCount',
    'status',
    'pendingReload',
  ]);
}

/**
 * Schedules the next tick using second-level timestamp precision.
 * @param {number} seconds
 * @returns {Promise<void>}
 */
async function scheduleNextTick(seconds) {
  await ext.alarms.clear(ALARM_NAME);
  const interval = Math.max(5, Number(seconds) || 120);
  await ext.alarms.create(ALARM_NAME, {
    when: Date.now() + interval * 1000,
  });
}

/**
 * Stops monitoring, resets badge, and removes active alarm.
 * @param {string} reason
 * @param {string} badgeText
 * @param {string} badgeColor
 * @returns {Promise<void>}
 */
async function stopMonitoring(reason, badgeText = '', badgeColor = '#6B7280') {
  await ext.alarms.clear(ALARM_NAME);
  await ext.storage.local.set({
    isMonitoring: false,
    status: reason,
    pendingReload: false,
  });

  await ext.action.setBadgeText({ text: badgeText });
  if (badgeText.length > 0) {
    await ext.action.setBadgeBackgroundColor({ color: badgeColor });
  }
}

/**
 * Triggers audio and desktop notifications for detected diff.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function alertDiffDetected(tabId) {
  await playAlarmSound(tabId);

  try {
    await ext.tabs.update(tabId, { active: true });
  } catch {}

  try {
    await ext.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'DOM Change Detected!',
      message: 'The monitored page content has changed. Reloading has stopped.',
      priority: 2,
    });
  } catch {}
}

/**
 * Evaluates tab DOM after reload completion.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function handleTabCompleted(tabId) {
  const state = await getState();
  if (!state.isMonitoring) {
    return;
  }

  if (state.tabId !== tabId) {
    return;
  }

  let executionResult = null;
  try {
    const results = await ext.scripting.executeScript({
      target: { tabId },
      func: tabInspectionRoutine,
      args: [state.selector || ''],
    });
    executionResult = results?.[0]?.result;
  } catch (err) {
    await ext.storage.local.set({
      status: `Error inspecting: ${err?.message || 'script injection failed'}`,
      pendingReload: false,
    });
    return;
  }

  if (!executionResult || !executionResult.hash) {
    return;
  }

  const currentHash = executionResult.hash;
  const count = (state.checkCount || 0) + 1;

  if (!state.baselineHash) {
    await ext.storage.local.set({
      baselineHash: currentHash,
      lastCheckedAt: Date.now(),
      checkCount: count,
      status: 'watching',
      pendingReload: false,
    });
    await ext.action.setBadgeText({ text: 'ON' });
    await ext.action.setBadgeBackgroundColor({ color: '#2563EB' });
    await scheduleNextTick(state.intervalSeconds);
    return;
  }

  if (currentHash === state.baselineHash) {
    await ext.storage.local.set({
      lastCheckedAt: Date.now(),
      checkCount: count,
      status: 'watching',
      pendingReload: false,
    });
    await ext.action.setBadgeText({ text: 'ON' });
    await scheduleNextTick(state.intervalSeconds);
    return;
  }

  await stopMonitoring('diff_detected', 'DIFF', '#DC2626');
  await ext.storage.local.set({
    lastDiffAt: Date.now(),
    diffHash: currentHash,
    checkCount: count,
  });
  await alertDiffDetected(tabId);
}

/**
 * Executes a reload cycle when alarm fires.
 * @returns {Promise<void>}
 */
async function triggerReloadCycle() {
  const state = await getState();
  if (!state.isMonitoring) {
    return;
  }

  if (!state.tabId) {
    await stopMonitoring('idle');
    return;
  }

  let tab = null;
  try {
    tab = await ext.tabs.get(state.tabId);
  } catch {
    tab = null;
  }

  if (!tab) {
    await stopMonitoring('Tab closed');
    return;
  }

  await ext.storage.local.set({
    status: 'reloading',
    pendingReload: true,
  });

  try {
    await ext.tabs.reload(state.tabId);
  } catch (err) {
    await ext.storage.local.set({
      status: `Reload failed: ${err?.message || 'unknown'}`,
      pendingReload: false,
    });
  }
}

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  triggerReloadCycle();
});

ext.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') {
    return;
  }

  handleTabCompleted(tabId);
});

ext.tabs.onRemoved.addListener(async (closedTabId) => {
  const state = await getState();
  if (state.tabId === closedTabId) {
    await stopMonitoring('Monitored tab closed');
  }
});

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'START_MONITORING') {
    (async () => {
      const interval = Math.max(5, Number(message.intervalSeconds) || 120);

      await ext.storage.local.set({
        isMonitoring: true,
        tabId: message.tabId,
        url: message.url,
        selector: message.selector || '',
        intervalSeconds: interval,
        baselineHash: '',
        checkCount: 0,
        status: 'initializing',
        pendingReload: false,
        startedAt: Date.now(),
      });

      await handleTabCompleted(message.tabId);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message?.action === 'STOP_MONITORING') {
    (async () => {
      await stopMonitoring('idle', '', '#6B7280');
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message?.action === 'TEST_SOUND') {
    (async () => {
      await playAlarmSound(message.tabId);
      sendResponse({ success: true });
    })();
    return true;
  }

  return false;
});
