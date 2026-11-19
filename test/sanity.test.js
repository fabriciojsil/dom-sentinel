import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeContent, computeHash, extractElements, findChangedElements } from '../scripts/content-inspector.js';
import { buildSlackPayload, sendSlackAlert } from '../background.js';
import { validateCommitMessage } from '../scripts/verify-commit-msg.js';

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

describe('Multi-Element DOM Scoping', () => {
  const mockDoc = {
    body: { innerText: 'Welcome to Store. Best prices.' },
    querySelectorAll: (sel) => {
      if (sel === '#price') {
        return [{ innerText: '$199.99' }];
      }
      if (sel === '.stock-status') {
        return [{ innerText: 'Out of Stock' }];
      }
      return [];
    },
  };

  test('extracts single or comma-separated multiple elements', async () => {
    const res = await extractElements('#price, .stock-status', mockDoc);
    assert.ok(res.hash.length === 64);
    assert.equal(res.elements['#price'], '$199.99');
    assert.equal(res.elements['.stock-status'], 'Out of Stock');
    assert.ok(res.compoundText.includes('[SELECTOR: #price]'));
    assert.ok(res.compoundText.includes('[SELECTOR: .stock-status]'));
  });

  test('marks missing selectors as [NOT FOUND]', async () => {
    const res = await extractElements('#price, #non-existent', mockDoc);
    assert.equal(res.elements['#non-existent'], '[NOT FOUND]');
  });

  test('pinpoints exact modified element in snapshot diff', () => {
    const prev = { '#price': '$199.99', '.stock-status': 'Out of Stock' };
    const curr = { '#price': '$199.99', '.stock-status': 'In Stock (Ready)' };

    const diffs = findChangedElements(prev, curr);
    assert.equal(diffs.length, 1);
    assert.ok(diffs[0].includes('.stock-status'));
    assert.ok(diffs[0].includes('Out of Stock'));
    assert.ok(diffs[0].includes('In Stock (Ready)'));
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
    assert.ok(Array.isArray(manifest.background.scripts) && manifest.background.scripts.includes('background.js'), 'background.scripts must include background.js for Firefox');
    assert.equal(manifest.background.service_worker, 'background.js', 'background.service_worker must be background.js for Chromium');

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

  test('background.js supports multi-page alarms and targets map', () => {
    const bgPath = path.join(rootDir, 'background.js');
    assert.ok(fs.existsSync(bgPath));
    const content = fs.readFileSync(bgPath, 'utf8');
    assert.ok(content.includes('ALARM_PREFIX'));
    assert.ok(content.includes('getTargets'));
    assert.ok(content.includes('saveTargets'));
    assert.ok(content.includes('updateBadge'));
    assert.ok(content.includes('findDiffs'));
  });
});

describe('Slack Webhook Notifications & In-Page Visual Spotlight', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('buildSlackPayload creates valid Slack Block Kit structure', () => {
    const payload = buildSlackPayload('Test Page', 'https://example.com', '#price: $10 -> $20');
    assert.ok(payload.text.includes('DOM Sentinel Alert'));
    assert.ok(Array.isArray(payload.blocks));

    // Header block
    const header = payload.blocks.find((b) => b.type === 'header');
    assert.ok(header, 'Header block must exist');
    assert.ok(header.text.text.includes('DOM Sentinel'));

    // Section with fields
    const sectionFields = payload.blocks.find((b) => b.type === 'section' && b.fields);
    assert.ok(sectionFields, 'Section with fields must exist');
    assert.ok(sectionFields.fields.some((f) => f.text.includes('Test Page')));

    // Section with diff summary
    const sectionDiff = payload.blocks.find((b) => b.type === 'section' && b.text);
    assert.ok(sectionDiff, 'Section with diff summary text must exist');
    assert.ok(sectionDiff.text.text.includes('#price: $10 -> $20'));

    // Actions block with button
    const actions = payload.blocks.find((b) => b.type === 'actions');
    assert.ok(actions, 'Actions block must exist');
    const button = actions.elements.find((el) => el.type === 'button');
    assert.ok(button, 'Action button must exist');
    assert.equal(button.url, 'https://example.com');
  });

  test('scripts/dom-highlighter.js exists and exports highlightMutatedElements with pulsing styles and HUD banner', async () => {
    const highlighterPath = path.join(rootDir, 'scripts/dom-highlighter.js');
    assert.ok(fs.existsSync(highlighterPath), 'dom-highlighter.js must exist');
    const content = fs.readFileSync(highlighterPath, 'utf8');
    assert.ok(content.includes('highlightMutatedElements'));
    assert.ok(content.includes('dom-sentinel-pulse'));
    assert.ok(content.includes('scrollIntoView'));
    assert.ok(content.includes('dom-sentinel-hud') || content.includes('DOM Sentinel Alert'));

    const module = await import('../scripts/dom-highlighter.js');
    assert.equal(typeof module.highlightMutatedElements, 'function');
  });

  test('background.js contains Slack webhook dispatch and in-page highlight injection logic', () => {
    const bgPath = path.join(rootDir, 'background.js');
    const content = fs.readFileSync(bgPath, 'utf8');
    assert.ok(content.includes('buildSlackPayload'));
    assert.ok(content.includes('sendSlackAlert'));
    assert.ok(content.includes('TEST_SLACK_WEBHOOK'));
    assert.ok(content.includes('highlightMutatedElements') || content.includes('enableInPageHighlight'));
  });
});

describe('Security Hardening & .agents Compliance', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('scripts/dom-highlighter.js constructs HUD banner safely without innerHTML interpolation', () => {
    const highlighterPath = path.join(rootDir, 'scripts/dom-highlighter.js');
    const content = fs.readFileSync(highlighterPath, 'utf8');
    assert.ok(!/innerHTML\s*=/.test(content), 'Must not use innerHTML assignment');
    assert.ok(content.includes('createElement'), 'Must use createElement for HUD banner');
    assert.ok(content.includes('textContent = diffSummary'), 'Must assign diffSummary via textContent');
  });

  test('sendSlackAlert strictly validates Slack webhook URLs and rejects insecure or untrusted hosts', async () => {
    await assert.rejects(
      async () => sendSlackAlert('http://hooks.slack.com/services/T00/B00/X00', 'Title', 'https://example.com', 'diff'),
      /Invalid Slack webhook URL/
    );
    await assert.rejects(
      async () => sendSlackAlert('https://evil.com/webhook', 'Title', 'https://example.com', 'diff'),
      /Invalid Slack webhook URL/
    );
  });

  test('buildSlackPayload sanitizes angle brackets and special characters in page titles', () => {
    const payload = buildSlackPayload('Product <Special & Edition>', 'https://example.com', 'diff');
    const fields = payload.blocks.find((b) => b.type === 'section' && b.fields)?.fields;
    const pageField = fields?.find((f) => f.text.includes('*Page:*'));
    assert.ok(pageField, 'Page field must exist');
    assert.ok(pageField.text.includes('&lt;Special &amp; Edition&gt;'), 'Page title must escape <, >, &');
    assert.ok(!pageField.text.includes('<Special'), 'Page title must not contain unescaped <');
  });

  test('popup/popup.js complies with guard clause pattern and contains zero else / else if tokens', () => {
    const popupPath = path.join(rootDir, 'popup/popup.js');
    const content = fs.readFileSync(popupPath, 'utf8');
    const elseTokens = content.match(/\belse\b/g);
    assert.equal(elseTokens, null, 'popup/popup.js must contain zero else or else if tokens');
  });

  test('zero inline comments (//) inside function bodies across scripts/dom-highlighter.js, background.js, popup/popup.js, scripts/verify-commit-msg.js', () => {
    const files = [
      'scripts/dom-highlighter.js',
      'background.js',
      'popup/popup.js',
      'scripts/verify-commit-msg.js',
    ];
    for (const relPath of files) {
      const fullPath = path.join(rootDir, relPath);
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      const inlineCommentLines = [];
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('//') ||
          (line.includes('//') && !line.includes('https://') && !line.includes('http://') && !line.includes('\\/\\/'))
        ) {
          inlineCommentLines.push({ line: idx + 1, content: trimmed });
        }
      });
      assert.deepEqual(
        inlineCommentLines,
        [],
        `File ${relPath} should contain zero inline comments (//), found: ${JSON.stringify(inlineCommentLines)}`
      );
    }
  });

  test('README.md contains zero occurrences of local environment paths (/Users/fabricio)', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    assert.ok(
      !content.includes('/Users/fabricio'),
      'README.md must not leak personal user paths (/Users/fabricio)'
    );
  });

  test('release artifacts, license file, and package metadata comply with v1.4.0 standards', () => {
    const licensePath = path.join(rootDir, 'LICENSE');
    assert.ok(fs.existsSync(licensePath), 'LICENSE file must exist');

    const pkgPath = path.join(rootDir, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.version, '1.4.0');
    assert.equal(pkg.scripts?.package, 'node scripts/package-extension.js');

    const manifestPath = path.join(rootDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.version, '1.4.0');

    const releaseWorkflowPath = path.join(rootDir, '.github/workflows/release.yml');
    assert.ok(fs.existsSync(releaseWorkflowPath), '.github/workflows/release.yml must exist');
    const workflowContent = fs.readFileSync(releaseWorkflowPath, 'utf8');
    assert.ok(workflowContent.includes('softprops/action-gh-release@v2'));
    assert.ok(workflowContent.includes('npm run package'));

    const packagingScriptPath = path.join(rootDir, 'scripts/package-extension.js');
    assert.ok(fs.existsSync(packagingScriptPath), 'scripts/package-extension.js must exist');
  });
});

describe('Conventional Commits & Git Hooks Infrastructure', () => {
  const rootDir = path.resolve(__dirname, '..');

  test('validateCommitMessage accepts valid Conventional Commits and merge commits', () => {
    const validMessages = [
      'feat: add feature',
      'fix(manifest): fix gecko script',
      'ci: update workflow',
      'docs(readme): update installation steps',
      'refactor: streamline diff logic',
      'perf(dom): optimize element query',
      'test: add unit tests',
      'build(deps): bump vite version',
      'chore: clean temporary files',
      'revert: revert previous release',
      'feat(scope)!: breaking change update',
      'Merge branch \'main\' of github.com:fabriciojsil/dom-sentinel',
      'Merge pull request #10 from fabriciojsil/feature',
      'Revert "feat: temporary test feature"'
    ];

    for (const msg of validMessages) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, true, `Expected "${msg}" to be valid`);
      assert.equal(res.error, undefined);
    }
  });

  test('validateCommitMessage rejects invalid formats, empty strings, and non-strings', () => {
    const invalidMessages = [
      'random commit',
      'fixed bug',
      'FEAT: caps',
      'feat:',
      'fix(): missing scope',
      'chore: ',
      '',
      '   \n\n  ',
      null,
      undefined,
      123
    ];

    for (const msg of invalidMessages) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, false, `Expected "${msg}" to be rejected`);
      assert.ok(typeof res.error === 'string' && res.error.length > 0);
    }
  });

  test('.github/release.yml and .githooks/commit-msg exist and are configured', () => {
    const releaseConfigPath = path.join(rootDir, '.github/release.yml');
    assert.ok(fs.existsSync(releaseConfigPath), '.github/release.yml must exist');
    const releaseConfig = fs.readFileSync(releaseConfigPath, 'utf8');
    assert.ok(releaseConfig.includes('changelog:'));
    assert.ok(releaseConfig.includes('categories:'));
    assert.ok(releaseConfig.includes('commit_prefix: feat'));

    const hookPath = path.join(rootDir, '.githooks/commit-msg');
    assert.ok(fs.existsSync(hookPath), '.githooks/commit-msg must exist');
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    assert.ok(hookContent.includes('scripts/verify-commit-msg.js'));

    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.scripts?.prepare?.includes('core.hooksPath .githooks'));
  });

  test('scripts/verify-commit-msg.js contains zero else tokens', () => {
    const scriptPath = path.join(rootDir, 'scripts/verify-commit-msg.js');
    const content = fs.readFileSync(scriptPath, 'utf8');
    const elseTokens = content.match(/\belse\b/g);
    assert.equal(elseTokens, null, 'scripts/verify-commit-msg.js must contain zero else or else if tokens');
  });
});
