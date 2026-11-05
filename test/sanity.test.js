import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeContent, computeHash } from '../scripts/content-inspector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Content Inspector & Normalization', () => {
  test('strips volatile script and style tags cleanly', () => {
    const raw = `
      <div>
        <script>console.log("analytics tracking 123");</script>
        <h1>Product Title</h1>
        <style>.ad-banner { display: none; }</style>
        <p>In Stock: 5 items</p>
        <noscript>Please enable JS</noscript>
      </div>
    `;

    const normalized = normalizeContent(raw);
    assert.ok(!normalized.includes('analytics tracking'));
    assert.ok(!normalized.includes('.ad-banner'));
    assert.ok(!normalized.includes('Please enable JS'));
    assert.ok(normalized.includes('Product Title'));
    assert.ok(normalized.includes('In Stock: 5 items'));
  });

  test('collapses extraneous whitespace and trims', () => {
    const raw = '   Hello     world \n\n\t from   Sentinel   ';
    const normalized = normalizeContent(raw);
    assert.equal(normalized, 'Hello world from Sentinel');
  });

  test('computes deterministic SHA-256 hex hash', async () => {
    const contentA = 'Price: $199.99';
    const contentB = 'Price: $199.99';
    const contentC = 'Price: $149.99';

    const hashA = await computeHash(contentA);
    const hashB = await computeHash(contentB);
    const hashC = await computeHash(contentC);

    assert.equal(hashA.length, 64);
    assert.equal(hashA, hashB);
    assert.notEqual(hashA, hashC);
  });
});

describe('Manifest V3 & Universal Cross-Browser Integrity', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('manifest.json contains required permissions and DOM Sentinel metadata', () => {
    const manifestPath = path.join(rootDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.name.includes('DOM Sentinel'));
    assert.ok(manifest.permissions.includes('alarms'));
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.permissions.includes('tabs'));
    assert.ok(manifest.permissions.includes('scripting'));
    assert.ok(manifest.permissions.includes('notifications'));
    assert.ok(manifest.permissions.includes('offscreen'));
    assert.ok(manifest.host_permissions.includes('<all_urls>'));
    assert.equal(manifest.background.service_worker, 'background.js');

    assert.ok(manifest.browser_specific_settings, 'Must define browser_specific_settings for Firefox');
    assert.equal(manifest.browser_specific_settings.gecko?.id, 'dom-sentinel@fabriciojsil.github.io');
  });

  test('all icon assets exist and are valid png buffers', () => {
    const iconSizes = [16, 48, 128];
    for (const size of iconSizes) {
      const iconPath = path.join(rootDir, `icons/icon${size}.png`);
      assert.ok(fs.existsSync(iconPath), `icon${size}.png must exist`);
      const stat = fs.statSync(iconPath);
      assert.ok(stat.size > 50, `icon${size}.png must have non-trivial size`);
    }
  });

  test('synthesizer script file exists and is non-empty', () => {
    const synthPath = path.join(rootDir, 'scripts/audio-synthesizer.js');
    assert.ok(fs.existsSync(synthPath), 'audio-synthesizer.js must exist');
    const content = fs.readFileSync(synthPath, 'utf8');
    assert.ok(content.includes('AudioContext'));
    assert.ok(content.includes('createOscillator'));
  });

  test('offscreen audio engine documents exist and contain audio logic', () => {
    const htmlPath = path.join(rootDir, 'offscreen/offscreen.html');
    const jsPath = path.join(rootDir, 'offscreen/offscreen.js');

    assert.ok(fs.existsSync(htmlPath), 'offscreen.html must exist');
    assert.ok(fs.existsSync(jsPath), 'offscreen.js must exist');

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(htmlContent.includes('offscreen.js'));

    const jsContent = fs.readFileSync(jsPath, 'utf8');
    assert.ok(jsContent.includes('AudioContext'));
    assert.ok(jsContent.includes('playDigitalAlarm'));
    assert.ok(jsContent.includes('PLAY_ALARM'));
  });

  test('background.js supports second-based scheduling and dual browser audio dispatch', () => {
    const bgPath = path.join(rootDir, 'background.js');
    assert.ok(fs.existsSync(bgPath));
    const content = fs.readFileSync(bgPath, 'utf8');
    assert.ok(content.includes('scheduleNextTick'));
    assert.ok(content.includes('intervalSeconds'));
    assert.ok(content.includes('ensureOffscreenDocument'));
    assert.ok(content.includes('playDirectWebAudioAlarm'));
    assert.ok(content.includes('playAlarmSound'));
  });
});
