import { highlightMutatedElements } from './scripts/dom-highlighter.js';

const ALARM_PREFIX = 'DOM_SENTINEL_TAB_';
const OFFSCREEN_PATH = 'offscreen/offscreen.html';

const ext = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : {});

/**
 * Builds a Slack Block Kit payload for DOM change notifications.
 * @param {string} pageTitle
 * @param {string} pageUrl
 * @param {string} diffSummary
 * @returns {Record<string, any>}
 */
function buildSlackPayload(pageTitle, pageUrl, diffSummary) {
  const safeTitle = (pageTitle || 'Target Page').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const title = pageTitle || 'Untitled Page';
  const url = pageUrl || 'about:blank';
  const diff = diffSummary || 'DOM mutations detected';

  return {
    text: `🚨 DOM Sentinel Alert: Changes detected on "${title}"`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 DOM Sentinel Change Detected',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Page:*\n${safeTitle}`,
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Diff Summary:*\n\`\`\`\n${diff}\n\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open Monitored Page',
              emoji: true,
            },
            url,
            style: 'primary',
          },
        ],
      },
    ],
  };
}

/**
 * Dispatches an alert notification to a Slack incoming webhook.
 * @param {string} webhookUrl
 * @param {string} pageTitle
 * @param {string} pageUrl
 * @param {string} diffSummary
 * @returns {Promise<boolean>}
 */
async function sendSlackAlert(webhookUrl, pageTitle, pageUrl, diffSummary) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_\-\/]+$/i.test(webhookUrl)) {
    throw new Error('Invalid Slack webhook URL');
  }

  const payload = buildSlackPayload(pageTitle, pageUrl, diffSummary);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack API error (${response.status}): ${errorText}`);
  }

  return true;
}

/**
 * In-tab extraction function executed via scripting.
 * Analyzes single or comma-separated CSS selectors and returns compound hash + previews.
 * @param {string} selectorsString
 * @returns {Promise<{ hash: string, compoundText: string, elements: Record<string, string>, length: number }>}
 */
async function tabInspectionRoutine(selectorsString) {
  function normalize(str) {
    if (!str) {
      return '';
    }
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const rawList = selectorsString ? selectorsString.split(',') : [];
  const selectors = rawList.map((s) => s.trim()).filter((s) => s.length > 0);

  if (selectors.length === 0) {
    const body = document.body;
    if (!body) {
      return { hash: '', compoundText: '', elements: {}, length: 0 };
    }

    const raw = body.innerText || body.textContent || '';
    const norm = normalize(raw);
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', encoder.encode(norm));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    return {
      hash: hex,
      compoundText: norm,
      elements: { body: norm.slice(0, 150) },
      length: norm.length,
    };
  }

  const elementsMap = {};
  const segments = [];

  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    if (nodes.length === 0) {
      elementsMap[sel] = '[NOT FOUND]';
      segments.push(`[SELECTOR: ${sel}]\n[NOT FOUND]`);
      continue;
    }

    const nodeTexts = [];
    for (const node of nodes) {
      const raw = node.innerText || node.textContent || '';
      const norm = normalize(raw);
      if (norm.length > 0) {
        nodeTexts.push(norm);
      }
    }

    const combined = nodeTexts.join(' | ');
    elementsMap[sel] = combined.slice(0, 150);
    segments.push(`[SELECTOR: ${sel}]\n${combined}`);
  }

  const compoundText = segments.join('\n---\n');
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(compoundText));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hex,
    compoundText,
    elements: elementsMap,
    length: compoundText.length,
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
 * Retrieves the global targets map from storage.
 * @returns {Promise<Record<string, any>>}
 */
async function getTargets() {
  const data = await ext.storage.local.get('targets');
  return data.targets || {};
}

/**
 * Persists updated targets map into storage.
 * @param {Record<string, any>} targets
 * @returns {Promise<void>}
 */
async function saveTargets(targets) {
  await ext.storage.local.set({ targets });
  await updateBadge(targets);
}

/**
 * Updates the extension badge reflecting active monitoring counts and diff alerts.
 * @param {Record<string, any>} targets
 * @returns {Promise<void>}
 */
async function updateBadge(targets) {
  const list = Object.values(targets);
  const diffCount = list.filter((t) => t.status === 'diff_detected').length;

  if (diffCount > 0) {
    await ext.action.setBadgeText({ text: 'DIFF' });
    await ext.action.setBadgeBackgroundColor({ color: '#DC2626' });
    return;
  }

  const activeCount = list.filter((t) => t.status === 'watching' || t.status === 'reloading').length;
  if (activeCount > 0) {
    await ext.action.setBadgeText({ text: String(activeCount) });
    await ext.action.setBadgeBackgroundColor({ color: '#2563EB' });
    return;
  }

  await ext.action.setBadgeText({ text: '' });
}

/**
 * Schedules the next tick for a specific tab.
 * @param {number} tabId
 * @param {number} seconds
 * @returns {Promise<void>}
 */
async function scheduleNextTick(tabId, seconds) {
  const alarmName = `${ALARM_PREFIX}${tabId}`;
  await ext.alarms.clear(alarmName);
  const interval = Math.max(5, Number(seconds) || 120);
  await ext.alarms.create(alarmName, {
    when: Date.now() + interval * 1000,
  });
}

/**
 * Pinpoints element-level text differences between previous and current snapshots.
 * @param {Record<string, string>} prev
 * @param {Record<string, string>} curr
 * @returns {string[]}
 */
function findDiffs(prev, curr) {
  if (!prev) {
    return ['Initial snapshot captured'];
  }

  const diffs = [];
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)]));

  for (const k of keys) {
    const b = prev[k] || '[NEW]';
    const a = curr[k] || '[REMOVED]';
    if (b === a) {
      continue;
    }
    diffs.push(`${k}: '${b}' -> '${a}'`);
  }

  return diffs;
}

/**
 * Stops monitoring on a specific tab and clears its alarm.
 * @param {number} tabId
 * @param {string} [reason='idle']
 * @returns {Promise<void>}
 */
async function stopMonitoringTab(tabId, reason = 'idle') {
  await ext.alarms.clear(`${ALARM_PREFIX}${tabId}`);
  const targets = await getTargets();
  const key = String(tabId);

  if (!targets[key]) {
    return;
  }

  if (reason === 'removed') {
    delete targets[key];
    await saveTargets(targets);
    return;
  }

  targets[key].status = reason;
  targets[key].isMonitoring = false;
  await saveTargets(targets);
}

/**
 * Evaluates tab DOM after reload completion.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function handleTabCompleted(tabId) {
  const targets = await getTargets();
  const key = String(tabId);
  const target = targets[key];

  if (!target || !target.isMonitoring) {
    return;
  }

  let executionResult = null;
  try {
    const results = await ext.scripting.executeScript({
      target: { tabId },
      func: tabInspectionRoutine,
      args: [target.selectors || ''],
    });
    executionResult = results?.[0]?.result;
  } catch (err) {
    target.status = `Error: ${err?.message || 'inspection failed'}`;
    await saveTargets(targets);
    return;
  }

  if (!executionResult || !executionResult.hash) {
    return;
  }

  const currentHash = executionResult.hash;
  const currentElements = executionResult.elements || {};
  const count = (target.checkCount || 0) + 1;

  if (!target.baselineHash) {
    target.baselineHash = currentHash;
    target.elements = currentElements;
    target.lastCheckedAt = Date.now();
    target.checkCount = count;
    target.status = 'watching';
    await saveTargets(targets);
    await scheduleNextTick(tabId, target.intervalSeconds);
    return;
  }

  if (currentHash === target.baselineHash) {
    target.lastCheckedAt = Date.now();
    target.checkCount = count;
    target.status = 'watching';
    await saveTargets(targets);
    await scheduleNextTick(tabId, target.intervalSeconds);
    return;
  }

  const diffList = findDiffs(target.elements, currentElements);
  const diffSummary = diffList.length > 0 ? diffList.join('; ') : 'Content hash changed';

  await ext.alarms.clear(`${ALARM_PREFIX}${tabId}`);
  target.isMonitoring = false;
  target.status = 'diff_detected';
  target.diffHash = currentHash;
  target.lastDiffAt = Date.now();
  target.diffDetail = diffSummary;
  target.checkCount = count;
  target.elements = currentElements;

  await saveTargets(targets);
  await playAlarmSound(tabId);

  try {
    const settings = (await ext.storage?.local?.get(['enableInPageHighlight', 'enableSlackAlerts', 'slackWebhookUrl'])) || {};
    const enableHighlight = settings.enableInPageHighlight !== false;
    if (enableHighlight && ext.scripting?.executeScript) {
      try {
        await ext.scripting.executeScript({
          target: { tabId },
          func: highlightMutatedElements,
          args: [target.selectors || '', diffSummary],
        });
      } catch (err) {
        console.warn('[DOM Sentinel] Failed to inject spotlight highlight:', err);
      }
    }

    if (settings.enableSlackAlerts && settings.slackWebhookUrl) {
      try {
        await sendSlackAlert(settings.slackWebhookUrl, target.title || 'Monitored Page', target.url, diffSummary);
      } catch (err) {
        console.error('[DOM Sentinel] Failed to dispatch Slack alert:', err);
      }
    }
  } catch (err) {
    console.warn('[DOM Sentinel] Error reading alert settings:', err);
  }

  try {
    await ext.tabs.update(tabId, { active: true });
  } catch {}

  try {
    await ext.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `DOM Change in "${target.title || 'Page'}"!`,
      message: diffSummary.slice(0, 200),
      priority: 2,
    });
  } catch {}
}

/**
 * Executes a reload cycle when alarm fires for a tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function triggerReloadCycle(tabId) {
  const targets = await getTargets();
  const key = String(tabId);
  const target = targets[key];

  if (!target || !target.isMonitoring) {
    await ext.alarms.clear(`${ALARM_PREFIX}${tabId}`);
    return;
  }

  let tab = null;
  try {
    tab = await ext.tabs.get(tabId);
  } catch {
    tab = null;
  }

  if (!tab) {
    await stopMonitoringTab(tabId, 'removed');
    return;
  }

  target.status = 'reloading';
  await saveTargets(targets);

  try {
    await ext.tabs.reload(tabId);
  } catch (err) {
    target.status = `Reload failed: ${err?.message || 'unknown'}`;
    await saveTargets(targets);
  }
}

if (ext?.alarms?.onAlarm?.addListener) {
  ext.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) {
      return;
    }

    const tabId = parseInt(alarm.name.replace(ALARM_PREFIX, ''), 10);
    if (!tabId) {
      return;
    }

    triggerReloadCycle(tabId);
  });
}

if (ext?.tabs?.onUpdated?.addListener) {
  ext.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') {
      return;
    }

    handleTabCompleted(tabId);
  });
}

if (ext?.tabs?.onRemoved?.addListener) {
  ext.tabs.onRemoved.addListener(async (closedTabId) => {
    await stopMonitoringTab(closedTabId, 'removed');
  });
}

if (ext?.runtime?.onMessage?.addListener) {
  ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'START_MONITORING') {
      (async () => {
        const tabId = message.tabId;
        const targets = await getTargets();
        const interval = Math.max(5, Number(message.intervalSeconds) || 120);

        targets[String(tabId)] = {
          tabId,
          url: message.url || '',
          title: message.title || 'Monitored Page',
          selectors: message.selectors || '',
          intervalSeconds: interval,
          baselineHash: '',
          elements: {},
          checkCount: 0,
          status: 'initializing',
          diffDetail: '',
          isMonitoring: true,
          startedAt: Date.now(),
          lastCheckedAt: 0,
        };

        await saveTargets(targets);
        await handleTabCompleted(tabId);
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message?.action === 'STOP_MONITORING') {
      (async () => {
        await stopMonitoringTab(message.tabId, 'idle');
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message?.action === 'REMOVE_TARGET') {
      (async () => {
        await stopMonitoringTab(message.tabId, 'removed');
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

    if (message?.action === 'TEST_SLACK_WEBHOOK') {
      (async () => {
        try {
          const webhookUrl = message.webhookUrl;
          await sendSlackAlert(
            webhookUrl,
            'DOM Sentinel Test Alert',
            'https://github.com/fabriciojsil/dom-sentinel',
            'This is a test notification confirming your Slack Webhook is operational!'
          );
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || 'Failed to dispatch Slack alert' });
        }
      })();
      return true;
    }

    return false;
  });
}

export {
  buildSlackPayload,
  sendSlackAlert,
  highlightMutatedElements,
  getTargets,
  saveTargets,
  updateBadge,
  findDiffs,
  handleTabCompleted,
  triggerReloadCycle,
  stopMonitoringTab,
};

