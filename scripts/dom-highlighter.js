/**
 * DOM Sentinel - In-Page Mutation Visual Spotlight & Diff HUD
 * Injected into target tab when a DOM mutation is detected.
 */

export function highlightMutatedElements(selectorsString, diffSummary) {
  const STYLE_ID = 'dom-sentinel-highlighter-style';
  const HUD_ID = 'dom-sentinel-diff-hud';
  const PULSE_CLASS = 'dom-sentinel-pulse-highlight';

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes dom-sentinel-pulse {
        0% {
          outline: 3px solid #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(239, 68, 68, 0.4);
          transform: scale(1);
        }
        50% {
          outline: 4px solid #f59e0b;
          box-shadow: 0 0 24px rgba(245, 158, 11, 1), inset 0 0 15px rgba(245, 158, 11, 0.6);
          transform: scale(1.02);
        }
        100% {
          outline: 3px solid #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(239, 68, 68, 0.4);
          transform: scale(1);
        }
      }

      .${PULSE_CLASS} {
        animation: dom-sentinel-pulse 1.4s ease-in-out infinite !important;
        position: relative !important;
        z-index: 2147483640 !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
      }

      #${HUD_ID} {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 420px;
        background: #0f172a;
        color: #f8fafc;
        border: 2px solid #ef4444;
        border-radius: 12px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.35);
        padding: 16px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        backdrop-filter: blur(8px);
        animation: dom-sentinel-hud-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes dom-sentinel-hud-slide {
        from { transform: translateY(-30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      #${HUD_ID} .hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        font-weight: 700;
        font-size: 14px;
        color: #ef4444;
      }

      #${HUD_ID} .hud-time {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 400;
      }

      #${HUD_ID} .hud-diff-box {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        color: #38bdf8;
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-all;
        margin-bottom: 12px;
      }

      #${HUD_ID} .hud-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      #${HUD_ID} .hud-dismiss-btn {
        background: #334155;
        color: #f8fafc;
        border: 1px solid #475569;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      #${HUD_ID} .hud-dismiss-btn:hover {
        background: #475569;
      }
    `;
    document.head.appendChild(style);
  }

  const rawList = selectorsString ? selectorsString.split(',') : [];
  const selectors = rawList.map((s) => s.trim()).filter((s) => s.length > 0);
  const elementsToHighlight = [];

  if (selectors.length > 0) {
    for (const sel of selectors) {
      try {
        const matches = document.querySelectorAll(sel);
        for (const el of matches) {
          elementsToHighlight.push(el);
        }
      } catch (err) {
        console.warn(`[DOM Sentinel] Invalid selector: ${sel}`, err);
      }
    }
  }

  if (elementsToHighlight.length === 0 && document.body) {
    elementsToHighlight.push(document.body);
  }

  elementsToHighlight.forEach((el, index) => {
    el.classList.add(PULSE_CLASS);
    if (index === 0 && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }
  });

  const existingHud = document.getElementById(HUD_ID);
  if (existingHud) {
    existingHud.remove();
  }

  const hud = document.createElement('div');
  hud.id = HUD_ID;
  hud.className = 'dom-sentinel-hud';

  const header = document.createElement('div');
  header.className = 'hud-header';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = '🚨 DOM Sentinel Alert';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'hud-time';
  timeSpan.textContent = new Date().toLocaleTimeString();

  header.appendChild(titleSpan);
  header.appendChild(timeSpan);

  const diffBox = document.createElement('div');
  diffBox.className = 'hud-diff-box';
  diffBox.textContent = diffSummary || 'DOM mutations detected';

  const actions = document.createElement('div');
  actions.className = 'hud-actions';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'hud-dismiss-btn';
  dismissBtn.id = 'dom-sentinel-dismiss-btn';
  dismissBtn.textContent = 'Dismiss Spotlight';

  actions.appendChild(dismissBtn);

  hud.appendChild(header);
  hud.appendChild(diffBox);
  hud.appendChild(actions);

  document.body.appendChild(hud);

  dismissBtn.addEventListener('click', () => {
    hud.remove();
    const highlighted = document.querySelectorAll(`.${PULSE_CLASS}`);
    highlighted.forEach((el) => el.classList.remove(PULSE_CLASS));
  });
}

if (typeof window !== 'undefined') {
  window.highlightMutatedElements = highlightMutatedElements;
}
