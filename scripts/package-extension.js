import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Packaging Engine for DOM Sentinel extension.
 * Packages required extension assets into a distributable zip archive and writes SHA-256 checksum.
 */
function packageExtension() {
  const __filename = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(__filename), '..');

  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found in root directory');
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;
  if (!version) {
    throw new Error('version is missing in package.json');
  }

  const distDir = path.join(rootDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  const zipFilename = `dom-sentinel-v${version}.zip`;
  const zipPath = path.join(distDir, zipFilename);
  const sha256Path = path.join(distDir, `${zipFilename}.sha256`);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const filesToInclude = [
    'manifest.json',
    'background.js',
    'popup',
    'icons',
    'offscreen',
    'README.md',
    'scripts/content-inspector.js',
    'scripts/dom-highlighter.js',
    'scripts/audio-synthesizer.js',
    'LICENSE'
  ];

  const zipCommand = `zip -r "${zipPath}" ${filesToInclude.join(' ')}`;
  execSync(zipCommand, { cwd: rootDir, stdio: 'inherit' });

  const fileBuffer = fs.readFileSync(zipPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const checksumContent = `${hash}  ${zipFilename}\n`;
  fs.writeFileSync(sha256Path, checksumContent, 'utf8');

  console.log(`Successfully packaged: ${zipPath}`);
  console.log(`SHA-256 checksum: ${sha256Path} (${hash})`);
}

packageExtension();
