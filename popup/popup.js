const ext = typeof chrome !== 'undefined' ? chrome : browser;

const statusDot = document.getElementById('statusDot');
const statusBadge = document.getElementById('statusBadge');
const tabTitle = document.getElementById('tabTitle');
const tabUrl = document.getElementById('tabUrl');
const intervalInput = document.getElementById('intervalInput');
const selectorInput = document.getElementById('selectorInput');
const presetsRow = document.getElementById('presetsRow');
const metricCheckCount = document.getElementById('metricCheckCount');
const metricLastChecked = document.getElementById('metricLastChecked');
const metricBaselineHash = document.getElementById('metricBaselineHash');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnTestSound = document.getElementById('btnTestSound');
const alertBanner = document.getElementById('alertBanner');

let currentTab = null;

/**
 * Formats a UNIX timestamp into a readable local time string.
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  if (!timestamp) {
    return 'Never';
  }

  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Truncates a 64-character hash for clean UI presentation.
 * @param {string} hash
 * @returns {string}
 */
function formatHash(hash) {
  if (!hash) {
    return 'None';
  }

  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Updates active class on preset interval buttons.
 * @param {number} sec
 */
function updatePresetButtons(sec) {
  const buttons = presetsRow.querySelectorAll('.preset-btn');
  for (const btn of buttons) {
    const val = Number(btn.getAttribute('data-sec'));
    if (val === sec) {
      btn.classList.add('active');
      continue;
    }
    btn.classList.remove('active');
  }
}

/**
 * Queries the active tab in the current window.
 * @returns {Promise<chrome.tabs.Tab | null>}
 */
async function getActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    return null;
  }
  return tabs[0];
}

/**
 * Renders the popup view based on storage state and active tab.
 * @param {Record<string, any>} state
 */
function renderUI(state) {
  const isTargetTab = currentTab && state.tabId === currentTab.id;
  const isWatching = Boolean(state.isMonitoring && isTargetTab);
  const isDiff = state.status === 'diff_detected' && isTargetTab;
  const isReloading = state.status === 'reloading' && isTargetTab;

  statusDot.className = 'radar-dot';
  statusBadge.className = 'badge';
  alertBanner.classList.add('hidden');

  const presetBtns = presetsRow.querySelectorAll('.preset-btn');

  if (isDiff) {
    statusDot.classList.add('diff');
    statusBadge.classList.add('diff');
    statusBadge.textContent = 'Diff Detected';
    alertBanner.classList.remove('hidden');
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    intervalInput.disabled = false;
    selectorInput.disabled = false;
    for (const b of presetBtns) {
      b.disabled = false;
    }
  }

  if (isReloading) {
    statusDot.classList.add('active');
    statusBadge.classList.add('reloading');
    statusBadge.textContent = 'Reloading...';
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    intervalInput.disabled = true;
    selectorInput.disabled = true;
    for (const b of presetBtns) {
      b.disabled = true;
    }
  }

  if (isWatching && !isReloading) {
    statusDot.classList.add('active');
    statusBadge.classList.add('watching');
    statusBadge.textContent = 'Watching';
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    intervalInput.disabled = true;
    selectorInput.disabled = true;
    for (const b of presetBtns) {
      b.disabled = true;
    }
  }

  if (!isWatching && !isDiff) {
    statusBadge.textContent = state.status === 'idle' ? 'Idle' : (state.status || 'Idle');
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    intervalInput.disabled = false;
    selectorInput.disabled = false;
    for (const b of presetBtns) {
      b.disabled = false;
    }
  }

  if (state.intervalSeconds && !isWatching) {
    intervalInput.value = state.intervalSeconds;
    updatePresetButtons(Number(state.intervalSeconds));
  }

  if (state.selector && !isWatching) {
    selectorInput.value = state.selector;
  }

  metricCheckCount.textContent = state.checkCount || 0;
  metricLastChecked.textContent = formatTime(state.lastCheckedAt);
  metricBaselineHash.textContent = formatHash(state.baselineHash);
}

/**
 * Initializes popup state and event handlers.
 */
async function initializePopup() {
  currentTab = await getActiveTab();

  if (currentTab) {
    tabTitle.textContent = currentTab.title || 'Untitled Page';
    tabUrl.textContent = currentTab.url || '-';
  }

  if (!currentTab) {
    tabTitle.textContent = 'No active tab detected';
    tabUrl.textContent = '-';
    btnStart.disabled = true;
  }

  const state = await ext.storage.local.get(null);
  renderUI(state);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }

    ext.storage.local.get(null).then((updatedState) => {
      renderUI(updatedState);
    });
  });

  presetsRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn || btn.disabled) {
      return;
    }

    const sec = Number(btn.getAttribute('data-sec'));
    intervalInput.value = sec;
    updatePresetButtons(sec);
  });

  intervalInput.addEventListener('input', () => {
    const sec = Number(intervalInput.value);
    updatePresetButtons(sec);
  });

  btnStart.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) {
      return;
    }

    const intervalSeconds = Math.max(5, parseInt(intervalInput.value, 10) || 120);
    const selector = selectorInput.value.trim();

    await ext.runtime.sendMessage({
      action: 'START_MONITORING',
      tabId: currentTab.id,
      url: currentTab.url,
      selector,
      intervalSeconds,
    });

    const updated = await ext.storage.local.get(null);
    renderUI(updated);
  });

  btnStop.addEventListener('click', async () => {
    await ext.runtime.sendMessage({ action: 'STOP_MONITORING' });
    const updated = await ext.storage.local.get(null);
    renderUI(updated);
  });

  btnTestSound.addEventListener('click', async () => {
    btnTestSound.textContent = '🔊 Playing Alarm...';
    btnTestSound.disabled = true;

    await ext.runtime.sendMessage({
      action: 'TEST_SOUND',
      tabId: currentTab?.id,
    });

    setTimeout(() => {
      btnTestSound.textContent = 'Test Sound Alert';
      btnTestSound.disabled = false;
    }, 3800);
  });
}

document.addEventListener('DOMContentLoaded', initializePopup);
