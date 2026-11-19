import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9_-]+\))?!?: .{1,80}/;
const MERGE_PATTERN = /^(Merge branch|Merge pull request|Revert ")/i;

/**
 * Validates a commit message string against Conventional Commits specification.
 *
 * @param {string} message - Commit message or raw commit file content.
 * @returns {{ valid: boolean, error?: string }} Result object with validation status.
 */
export function validateCommitMessage(message) {
  if (typeof message !== 'string') {
    return { valid: false, error: 'Commit message must be a string.' };
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return { valid: false, error: 'Commit message cannot be empty.' };
  }

  const firstLine = trimmed.split('\n')[0].trim();

  if (MERGE_PATTERN.test(firstLine)) {
    return { valid: true };
  }

  if (COMMIT_PATTERN.test(firstLine)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Invalid commit message format: "${firstLine}". Expected Conventional Commits format, e.g. "feat: add feature" or "fix(scope): fix bug".`
  };
}

/**
 * CLI execution handler for commit-msg git hook.
 */
function runCli() {
  const commitMsgFile = process.argv[2];
  if (!commitMsgFile) {
    console.error('Error: Commit message file path argument required.');
    process.exit(1);
  }

  if (!fs.existsSync(commitMsgFile)) {
    console.error(`Error: Commit message file not found at ${commitMsgFile}`);
    process.exit(1);
  }

  const rawMessage = fs.readFileSync(commitMsgFile, 'utf8');
  const result = validateCommitMessage(rawMessage);

  if (!result.valid) {
    console.error(`\x1b[31m[Commit Hook Error]\x1b[0m ${result.error}`);
    console.error('\x1b[33mPattern:\x1b[0m <type>(<scope>): <subject> (max 80 chars)');
    console.error('\x1b[33mAllowed types:\x1b[0m feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert');
    process.exit(1);
  }

  process.exit(0);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli();
}
