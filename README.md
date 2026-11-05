# DOM Sentinel

> **Autonomous Webpage Mutation Monitor & Acoustic Alarm for Modern Browsers**  
> *Manifest V3 • Zero External Dependencies • Cross-Browser Engine*

---

## Overview

**DOM Sentinel** is a lightweight, zero-dependency browser extension that monitors any webpage on a custom cadence (configured in **seconds**). It automatically reloads the target page, inspects the DOM for structural or text mutations against a cryptographic SHA-256 baseline, sounds a high-visibility acoustic alarm when changes are detected, and halts reloading immediately to preserve the updated state.

Built to solve common pain points like **ticket drops, flash restocks, auction bids, appointment scheduling, and server status dashboards**.

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

- **Second-Precision Intervals**: Configure check intervals directly in **seconds** (e.g. `30s`, `60s`, `120s`, `300s`, or any custom integer from `5` to `86400` seconds). Quick-preset buttons allow 1-click configuration.
- **Full Page or Targeted Selector**:
  - **Full Page Mode**: Analyzes normalized body text by default.
  - **Targeted Selector Mode**: Restricts monitoring to a specific CSS selector (e.g., `#price`, `.stock-status`, `[data-status]`, `#ticket-gate`) to prevent false positives from rotating ads, session tokens, or timestamps.
- **DOM Normalization & SHA-256 Digests**: Automatically removes volatile script tags, stylesheet blocks, noscript fallbacks, and excessive whitespace before calculating deterministic SHA-256 hashes via the native Web Crypto API (`crypto.subtle.digest`).
- **High-Decibel Dual-Engine Alarm**:
  - **Chromium / Brave / Edge**: Dispatches to an offscreen audio document (`chrome.offscreen`) to bypass Chromium's Autoplay Policy on freshly reloaded tabs.
  - **Firefox**: Synthesizes directly in the background context without external dependencies.
  - Emits 4 loud bursts of alternating digital alarm pulses (880Hz / 1174Hz / 1480Hz / 1760Hz) at 95% volume.
- **Immediate Auto-Halt & Tab Focus**:
  - Clears reload alarms instantly to prevent reloading past the newly updated view.
  - Focuses the monitored tab automatically so you can take immediate action.
  - Raises a desktop notification with `priority: 2` and sets a high-contrast red `DIFF` toolbar badge.
- **Dark-Mode Toolbar Popup**: Displays live execution metrics including check count, last-checked time, truncated baseline hash, and an instant **"Test Sound Alert"** button.

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
   /Users/fabricio/development/github/fabriciojsil/dom-sentinel
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
   /Users/fabricio/development/github/fabriciojsil/dom-sentinel/manifest.json
   ```
4. The extension will load immediately with ID `dom-sentinel@fabriciojsil.github.io`.

---

## How to Use

1. **Open Target Page**: Navigate to the website or service you want to monitor.
2. **Open DOM Sentinel**: Click the extension icon in the toolbar.
3. **Configure Settings**:
   - **Interval (seconds)**: Enter your desired interval (e.g., `120` for 2 minutes, `30` for 30 seconds), or click a preset pill (`30s`, `60s`, `120s`, `300s`).
   - **CSS Selector (optional)**: Enter a targeted selector like `#stock-status` or `.price-tag`. Leave empty to monitor all page text.
4. **Test Alarm**: Click **"Test Sound Alert"** to verify that your audio volume is audible.
5. **Start Watching**: Click **"Start Monitoring"**:
   - The toolbar badge turns blue: `ON`.
   - The initial baseline hash is computed and stored.
   - The tab will reload according to your second interval.
6. **When Changes Occur**:
   - The loud digital alarm buzzer sounds.
   - The tab is automatically focused into view.
   - The badge turns red: `DIFF`.
   - Reloading stops immediately.

---

## Local Testing with Interactive Test Lab

An interactive test page is included in the repository so you can test DOM mutations locally:

1. Open [`test/demo-target.html`](test/demo-target.html) in your browser:
   ```
   file:///Users/fabricio/development/github/fabriciojsil/dom-sentinel/test/demo-target.html
   ```
   *(Ensure "Allow access to file URLs" is enabled in extension details for file URLs, or run `npx serve .`)*.
2. Open the extension popup, set the interval to `10` seconds, and click **Start Monitoring**.
3. Click the **"Simulate Stock Drop"** button on the test page.
4. Within 10 seconds, the extension detects the DOM diff, sounds the alarm, focuses the window, and halts.

---

## Automated Test Suite

Run the built-in sanity test suite:

```bash
cd /Users/fabricio/development/github/fabriciojsil/dom-sentinel
npm test
```

### Verified Checks:
- Content normalization (stripping volatile `<script>`, `<style>`, `<noscript>` blocks).
- Deterministic SHA-256 cryptographic hashing.
- Manifest V3 permission set and Gecko browser settings.
- Icon binary integrity across 16px, 48px, and 128px assets.
- Second-level alarm scheduling and dual-engine audio dispatch.

---

## Architecture & File Structure

```
dom-sentinel/
├── manifest.json                  # Manifest V3 specification & cross-browser keys
├── background.js                  # Service worker: alarms, reload lifecycle, diff detector
├── offscreen/
│   ├── offscreen.html             # Offscreen host for Chromium autoplay bypass
│   └── offscreen.js               # Loud digital alarm buzzer synthesizer
├── popup/
│   ├── popup.html                 # Toolbar popup with second-interval controls & presets
│   ├── popup.css                  # Dark-mode styling
│   └── popup.js                   # Universal popup controller
├── scripts/
│   ├── content-inspector.js       # Tag stripper, normalizer, and SHA-256 hasher
│   ├── audio-synthesizer.js       # Secondary tab-injected audio fallback
│   └── generate-icons.js          # Node script for pure PNG icon generation
├── icons/
│   ├── icon16.png                 # Toolbar icon (16x16)
│   ├── icon48.png                 # Add-ons manager icon (48x48)
│   └── icon128.png                # Store/HiDPI icon (128x128)
├── test/
│   ├── sanity.test.js             # Automated unit tests
│   └── demo-target.html           # Interactive DOM mutation test lab
└── package.json                   # Project scripts and metadata
```
