# DOM Sentinel

> **Autonomous Multi-Page & Multi-Element Webpage Mutation Monitor with Acoustic Alarms**  
> *Manifest V3 • Zero External Dependencies • Universal Cross-Browser Engine*

---

## Overview

**DOM Sentinel** is a lightweight, zero-dependency browser extension that monitors multiple webpages and multiple DOM targets simultaneously on custom cadences (configured in **seconds**). It automatically reloads monitored tabs, inspects targeted DOM nodes for mutations against cryptographic SHA-256 baselines, sounds a high-visibility acoustic alarm when changes occur, pinpoints which exact element mutated, and halts reloading immediately.

Built for **ticket drops, flash restocks, auction bids, appointment scheduling, and server status dashboards**.

---

## Browser Support Matrix

DOM Sentinel is engineered as a universal WebExtension that automatically adapts its execution and audio pipeline to each browser's underlying engine:

| Browser | Supported Engine | Minimum Version | Audio Mechanism | Autoplay Bypass | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brave** | Chromium | 109+ | `chrome.offscreen` API | Yes (Offscreen Exemption) | ✅ Verified |
| **Google Chrome** | Chromium | 109+ | `chrome.offscreen` API | Yes (Offscreen Exemption) | ✅ Verified |
| **Mozilla Firefox** | Gecko | 121+ | Native Background Web Audio | Yes (Background Page Rights) | ✅ Verified |
| **Microsoft Edge** | Chromium | 109+ | `chrome.offscreen` API | Yes (Offscreen Exemption) | ✅ Verified |
| **Opera / Vivaldi** | Chromium | 109+ | `chrome.offscreen` API | Yes (Offscreen Exemption) | ✅ Verified |
| **Arc / Chromium Forks** | Chromium | 109+ | `chrome.offscreen` API | Yes (Offscreen Exemption) | ✅ Verified |

---

## Key Features

### 1. Multi-Page (Multi-Tab) Watchlist
- **Concurrent Monitoring**: Monitor Tab A (e.g. concert tickets every 30s) and Tab B (e.g. stock restock every 120s) simultaneously.
- **Dedicated Timers per Tab**: Each tab gets an independent alarm (`DOM_SENTINEL_TAB_<id>`).
- **Interactive Watchlist Drawer**: View all active tabs from any popup, with check counts, cadence, and a 1-click **"Jump to Tab"** button.
- **Automatic Lifecycle Cleanup**: Closing a tab automatically cleans up its state and unregisters its timer without affecting other monitored tabs.
- **Global Toolbar Badge**: Displays the number of active tabs (e.g. `2` or `3` in blue). Immediately flips to a red `DIFF` badge when any tab detects a mutation.

### 2. Multi-Element DOM Scoping on the Same Page
- **Comma-Separated Selectors**: Monitor multiple specific elements on a single page by entering comma-separated selectors:
  ```css
  #price, .stock-status, #shipping-estimate
  ```
- **Compound Fingerprinting**: Constructs a compound structure containing each targeted node and calculates a unified SHA-256 digest.
- **Precise Diff Pinpointing**: When a diff is detected, DOM Sentinel identifies exactly which element changed (e.g. *"Diff in .stock-status: 'Out of Stock' -> 'In Stock'"*) in both the desktop notification and the popup banner.
- **Full Page Fallback**: Leave the selector empty to monitor all visible page text.

### 3. Second-Precision Intervals & Presets
- Configurable directly in **seconds** (minimum: `5s`, default: `120s`).
- Quick-preset pills: **`30s`**, **`60s`**, **`120s (2m)`**, and **`300s (5m)`**.

### 4. Dual-Engine Acoustic Alarm
- **Chromium / Brave / Edge**: Uses `chrome.offscreen` to bypass Chromium's Autoplay Policy on auto-reloaded tabs.
- **Firefox**: Synthesizes directly in the background Web Audio API context.
- Emits 4 loud bursts of alternating digital alarm buzzer pulses (880Hz / 1174Hz / 1480Hz / 1760Hz) at 95% volume.

### 5. In-Page Visual Spotlight & Diff HUD
- **Animated Pulsating Glow**: Injects a high-visibility animated aura (`@keyframes dom-sentinel-pulse`) directly around mutated DOM elements.
- **Instant Auto-Focus**: Smoothly scrolls the viewport to center on the changed element (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).
- **Floating HUD Banner**: Renders a sleek top-right overlay displaying timestamped diff details and a one-click **"Dismiss Spotlight"** button to restore standard styling.

### 6. Slack Mobile & Desktop Webhook Notifications
- **Real-Time Push Alerts**: Dispatches instant notifications directly to any Slack channel or DM via Slack Incoming Webhooks.
- **Slack Block Kit Design**: Rich formatted cards featuring:
  - Header with alert icon and title.
  - Page title and exact change timestamp.
  - Formatted code-block diff preview pinpointing old vs new content.
  - Interactive **"Open Monitored Page"** action button to launch the page directly on mobile or desktop.
- **Built-In Connection Tester**: One-click **"Test Slack Alert"** in the popup confirms webhook delivery in real time before starting a watch session.

---

## Installation Guide

### 1. Brave, Google Chrome, Microsoft Edge, Opera
1. Open the extensions manager in your browser:
   - **Brave**: `brave://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the project directory:
   ```
   path/to/dom-sentinel
   ```
5. Pin **DOM Sentinel** to your browser toolbar for easy access.

---

### 2. Mozilla Firefox
1. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Navigate into the extension directory and select:
   ```
   path/to/dom-sentinel/manifest.json
   ```
4. The extension will load immediately with ID `dom-sentinel@fabriciojsil.github.io`.

---

## How to Use

1. **Open Target Page**: Navigate to the website or service you want to monitor.
2. **Open DOM Sentinel**: Click the extension icon in the toolbar.
3. **Configure Settings**:
   - **Check Cadence**: Set seconds (e.g., `30` or `120`), or click a preset pill.
   - **DOM Targets**: Enter one or more comma-separated selectors (e.g. `#price, .stock-status`). Leave blank for the whole page.
   - **Alert Channels**:
     - Keep **"In-Page Visual Spotlight"** enabled to auto-scroll and pulse-highlight mutated nodes.
     - Enable **"Slack Mobile Alerts"**, paste your Slack incoming webhook URL, and click **"Test Slack Alert"** to verify connection (see [Setting Up Slack Alerts](#setting-up-slack-mobile--desktop-alerts) below).
4. **Test Alarm**: Click **"Test Sound Alert"** to verify speaker output.
5. **Start Watching**: Click **"Start Watching This Tab"**:
   - The toolbar badge updates with the active tab count.
   - Initial element snapshots and compound hash are captured.
   - The tab will reload at the specified second interval.
6. **Monitor Multiple Tabs**: Open a second or third tab, configure its targets/interval, and start watching. All monitored pages appear in the **Active Watchlist** section.
7. **When Changes Occur**:
    - The loud digital alarm buzzer sounds.
    - The tab is automatically focused into view.
    - The in-page visual spotlight centers on the mutated element with a pulsing aura and diff HUD.
    - A Slack push notification is dispatched to your channel/phone with an instant jump link.
    - The notification describes which element changed.
    - The badge turns red: `DIFF`.
    - Reloading stops immediately on that tab.

---

## Setting Up Slack Mobile & Desktop Alerts

DOM Sentinel can dispatch real-time push alerts with rich diff previews directly to your mobile phone (iOS / Android) and desktop via Slack Incoming Webhooks. Setting this up takes less than 2 minutes and requires no developer credentials.

### Step-by-Step Slack Setup:

1. **Navigate to the Slack App Console**:
   - Open your browser and go to [https://api.slack.com/apps](https://api.slack.com/apps).
   - Sign in with your Slack account if prompted.

2. **Create a New Slack App**:
   - Click the green **"Create New App"** button.
   - Choose **"From scratch"** in the configuration modal.
   - Enter **App Name**: `DOM Sentinel`.
   - Under **Pick a workspace to develop your app in**, select your desired Slack workspace from the dropdown.
   - Click **"Create App"**.

3. **Activate Incoming Webhooks**:
   - In the left sidebar navigation under **Features**, click **"Incoming Webhooks"**.
   - Toggle the switch at the top labeled **"Activate Incoming Webhooks"** to **On**.

4. **Add a Webhook to Your Workspace**:
   - Scroll down to the bottom of the *Incoming Webhooks* page.
   - Click the **"Add New Webhook to Workspace"** button.

5. **Select Your Alert Channel & Authorize**:
   - Choose where you want DOM Sentinel mutation alerts posted:
     - A dedicated channel (e.g. `#alerts`, `#general`, or a custom `#drops` channel).
     - Or a Direct Message to yourself for private notifications.
   - Click **"Allow"** to grant permission.

6. **Copy the Generated Webhook URL**:
   - Back on the *Incoming Webhooks* settings page, locate your new webhook in the *Webhook URLs for Your Workspace* table.
   - Click **"Copy"** next to the Webhook URL. It will look like:
     ```
     https://hooks.slack.com/services/T.../B.../...
     ```

7. **Configure DOM Sentinel & Verify Push Delivery**:
   - Click the **DOM Sentinel** icon in your browser toolbar to open the popup.
   - Under **Alert Channels**:
     - Paste the copied URL into the **"Slack Webhook URL"** input field.
     - Toggle the **"Slack Mobile Alerts"** switch to **ON**.
   - Click **"Test Slack Alert"**:
     - DOM Sentinel will immediately transmit a test payload to Slack.
     - Confirm that you receive the notification with the green checkmark banner on your desktop or Slack mobile app!

---

## Local Testing with Interactive Test Lab

An interactive test page is included in [`test/demo-target.html`](test/demo-target.html):

```
test/demo-target.html
```

Features three independently mutable elements:
- `#price` (Price drop simulation)
- `#stockStatus` (Inventory status simulation)
- `#shippingEstimate` (Delivery date simulation)

1. Open `test/demo-target.html` in one or two tabs.
2. In Tab 1, enter `#price, #stockStatus` with a `10s` cadence and start monitoring.
3. Click **"Mutate #price"** or **"Mutate #stockStatus"**.
4. Within 10 seconds, DOM Sentinel flags the diff, reports the specific element mutation, sounds the alarm, highlights the mutated element in-page, and halts reloading.

---

## Automated Test Suite

Run the built-in sanity test suite:

```bash
npm test
```

### Verified Checks (14 passing tests):
- Content normalization (tag stripping, whitespace collapse).
- Deterministic SHA-256 cryptographic hashing.
- Multi-element extraction, `[NOT FOUND]` handling, and compound serialization.
- Snapshot diff calculation pinpointing specific element mutations.
- Cross-browser Manifest V3 permission set and Gecko browser settings.
- Multi-page background alarm and targets map coordination.
- Icon binary integrity across 16px, 48px, and 128px assets.
- Slack Block Kit payload composition (header, fields, code-block diff summary, action buttons).
- In-page highlighter script with CSS keyframe pulse animation and floating HUD banner.
- Background worker Slack webhook dispatch and in-page script injection handling.
