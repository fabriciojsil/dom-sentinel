const ext = typeof chrome !== 'undefined' ? chrome : browser;

const statusDot = document.getElementById('statusDot');
const statusBadge = document.getElementById('statusBadge');
const watchlistCountBadge = document.getElementById('watchlistCountBadge');
const tabTitle = document.getElementById('tabTitle');
const tabUrl = document.getElementById('tabUrl');
const intervalInput = document.getElementById('intervalInput');
const selectorInput = document.getElementById('selectorInput');
const presetsRow = document.getElementById('presetsRow');
const metricCheckCount = document.getElementById('metricCheckCount');
const metricLastChecked = document.getElementById('metricLastChecked');
const metricElementsSummary = document.getElementById('metricElementsSummary');
const alertBanner = document.getElementById('alertBanner');
const alertDetail = document.getElementById('alertDetail');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnTestSound = document.getElementById('btnTestSound');
const watchlistTotal = document.getElementById('watchlistTotal');
const watchlistContainer = document.getElementById('watchlistContainer');
const enableHighlightToggle = document.getElementById('enableHighlightToggle');
const enableSlackToggle = document.getElementById('enableSlackToggle');
const slackConfigGroup = document.getElementById('slackConfigGroup');
const slackWebhookInput = document.getElementById('slackWebhookInput');
const testSlackBtn = document.getElementById('testSlackBtn');
const slackStatusText = document.getElementById('slackStatusText');

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
 * Renders the watchlist of all other monitored tabs.
 * @param {Record<string, any>} targets
 * @param {number} currentTabId
 */
function renderWatchlist(targets, currentTabId) {
  const allList = Object.values(targets || {});
  const otherList = allList.filter((t) => t.tabId !== currentTabId && t.status !== 'removed');
  const activeCount = allList.filter((t) => t.status === 'watching' || t.status === 'reloading').length;

  watchlistCountBadge.textContent = `${activeCount} Active`;
  watchlistTotal.textContent = `${otherList.length} tabs`;
  watchlistContainer.innerHTML = '';

  if (otherList.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'watchlist-empty';
    emptyEl.textContent = 'No other tabs are currently being monitored.';
    watchlistContainer.appendChild(emptyEl);
    return;
  }

  for (const item of otherList) {
    const card = document.createElement('div');
    card.className = 'watchlist-card';

    const top = document.createElement('div');
    top.className = 'watchlist-top';

    const title = document.createElement('div');
    title.className = 'watchlist-title';
    title.textContent = item.title || item.url || 'Untitled Tab';

    const badge = document.createElement('span');
    badge.className = `badge ${item.status}`;
    badge.textContent = item.status === 'diff_detected' ? 'DIFF' : item.status;

    top.appendChild(title);
    top.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'watchlist-meta';
    meta.textContent = `${item.intervalSeconds}s cadence | ${item.checkCount || 0} checks | ${item.selectors || 'body'}`;

    const actions = document.createElement('div');
    actions.className = 'watchlist-actions';

    const btnFocus = document.createElement('button');
    btnFocus.className = 'btn-mini btn-mini-primary';
    btnFocus.textContent = 'Jump to Tab';
    btnFocus.addEventListener('click', async () => {
      await ext.tabs.update(item.tabId, { active: true });
    });

    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-mini btn-mini-danger';
    btnRemove.textContent = 'Remove';
    btnRemove.addEventListener('click', async () => {
      await ext.runtime.sendMessage({ action: 'REMOVE_TARGET', tabId: item.tabId });
    });

    actions.appendChild(btnFocus);
    actions.appendChild(btnRemove);

    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(actions);

    watchlistContainer.appendChild(card);
  }
}

/**
 * Renders the primary current-tab interface based on targets dictionary.
 * @param {Record<string, any>} targets
 */
function renderCurrentTab(targets) {
  if (!currentTab) {
    return;
  }

  const currentTabId = currentTab.id;
  const target = targets[String(currentTabId)] || null;

  renderWatchlist(targets, currentTabId);

  const isWatching = Boolean(target && (target.status === 'watching' || target.status === 'reloading'));
  const isDiff = Boolean(target && target.status === 'diff_detected');
  const isReloading = Boolean(target && target.status === 'reloading');

  statusDot.className = 'radar-dot';
  statusBadge.className = 'badge';
  alertBanner.classList.add('hidden');

  const presetBtns = presetsRow.querySelectorAll('.preset-btn');

  if (isDiff) {
    statusDot.classList.add('diff');
    statusBadge.classList.add('diff');
    statusBadge.textContent = 'Diff Detected';
    alertBanner.classList.remove('hidden');
    alertDetail.textContent = target.diffDetail || 'Content mutated post-reload';
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
    statusBadge.textContent = 'Idle';
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    intervalInput.disabled = false;
    selectorInput.disabled = false;
    for (const b of presetBtns) {
      b.disabled = false;
    }
  }

  if (target) {
    if (!isWatching) {
      intervalInput.value = target.intervalSeconds || 120;
      updatePresetButtons(Number(target.intervalSeconds));
      selectorInput.value = target.selectors || '';
    }
    metricCheckCount.textContent = target.checkCount || 0;
    metricLastChecked.textContent = formatTime(target.lastCheckedAt);
    const keys = target.elements ? Object.keys(target.elements) : [];
    metricElementsSummary.textContent = keys.length > 0 ? keys.join(', ') : (target.selectors || 'body');
    return;
  }

  metricCheckCount.textContent = 0;
  metricLastChecked.textContent = 'Never';
  metricElementsSummary.textContent = selectorInput.value.trim() || 'body';
}

/**
 * Initializes popup state and binds event handlers.
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

  const data = await ext.storage.local.get('targets');
  renderCurrentTab(data.targets || {});

  const alertSettings = await ext.storage.local.get([
    'enableInPageHighlight',
    'enableSlackAlerts',
    'slackWebhookUrl',
  ]);

  if (enableHighlightToggle) {
    enableHighlightToggle.checked = alertSettings.enableInPageHighlight !== false;
    enableHighlightToggle.addEventListener('change', async () => {
      await ext.storage.local.set({ enableInPageHighlight: enableHighlightToggle.checked });
    });
  }

  if (enableSlackToggle) {
    enableSlackToggle.checked = Boolean(alertSettings.enableSlackAlerts);
    if (slackConfigGroup) {
      slackConfigGroup.style.display = enableSlackToggle.checked ? 'flex' : 'none';
    }
    enableSlackToggle.addEventListener('change', async () => {
      const isEnabled = enableSlackToggle.checked;
      if (slackConfigGroup) {
        slackConfigGroup.style.display = isEnabled ? 'flex' : 'none';
      }
      await ext.storage.local.set({ enableSlackAlerts: isEnabled });
    });
  }

  if (slackWebhookInput) {
    slackWebhookInput.value = alertSettings.slackWebhookUrl || '';
    slackWebhookInput.addEventListener('input', async () => {
      await ext.storage.local.set({ slackWebhookUrl: slackWebhookInput.value.trim() });
    });
  }

  if (testSlackBtn) {
    testSlackBtn.addEventListener('click', async () => {
      const webhookUrl = slackWebhookInput ? slackWebhookInput.value.trim() : '';
      if (!webhookUrl) {
        slackStatusText.textContent = 'Enter Webhook URL first';
        slackStatusText.className = 'slack-status-text error';
        return;
      }

      testSlackBtn.disabled = true;
      testSlackBtn.textContent = 'Sending...';
      slackStatusText.textContent = 'Dispatching test alert...';
      slackStatusText.className = 'slack-status-text loading';

      try {
        const response = await ext.runtime.sendMessage({
          action: 'TEST_SLACK_WEBHOOK',
          webhookUrl,
        });

        if (!response?.success) {
          slackStatusText.textContent = `✗ ${response?.error || 'Dispatch failed'}`;
          slackStatusText.className = 'slack-status-text error';
          return;
        }
        slackStatusText.textContent = '✓ Alert delivered!';
        slackStatusText.className = 'slack-status-text success';
      } catch (err) {
        slackStatusText.textContent = `✗ ${err.message || 'Error'}`;
        slackStatusText.className = 'slack-status-text error';
      } finally {
        testSlackBtn.disabled = false;
        testSlackBtn.textContent = 'Test Slack Alert';
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.targets) {
      return;
    }
    renderCurrentTab(changes.targets.newValue || {});
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

  selectorInput.addEventListener('input', () => {
    metricElementsSummary.textContent = selectorInput.value.trim() || 'body';
  });

  btnStart.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) {
      return;
    }

    const intervalSeconds = Math.max(5, parseInt(intervalInput.value, 10) || 120);
    const selectors = selectorInput.value.trim();

    await ext.runtime.sendMessage({
      action: 'START_MONITORING',
      tabId: currentTab.id,
      url: currentTab.url,
      title: currentTab.title,
      selectors,
      intervalSeconds,
    });
  });

  btnStop.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) {
      return;
    }

    await ext.runtime.sendMessage({
      action: 'STOP_MONITORING',
      tabId: currentTab.id,
    });
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
