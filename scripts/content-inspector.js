/**
 * Normalizes an HTML string or element text by removing script/style tags and extra whitespace.
 * @param {string} rawText
 * @returns {string}
 */
export function normalizeContent(rawText) {
  if (!rawText) {
    return '';
  }

  return rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes a SHA-256 hex digest of a string using Web Crypto or Node crypto.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function computeHash(text) {
  if (!text) {
    return '';
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Extracts normalized content from multiple CSS selectors and compiles a compound digest.
 * @param {string} selectorsString
 * @param {Document|Element} [docRoot]
 * @returns {Promise<{ compoundText: string, hash: string, elements: Record<string, string>, length: number }>}
 */
export async function extractElements(selectorsString, docRoot = typeof document !== 'undefined' ? document : null) {
  if (!docRoot) {
    return { compoundText: '', hash: '', elements: {}, length: 0 };
  }

  const rawList = selectorsString ? selectorsString.split(',') : [];
  const selectors = rawList.map((s) => s.trim()).filter((s) => s.length > 0);

  if (selectors.length === 0) {
    const body = docRoot.body;
    if (!body) {
      return { compoundText: '', hash: '', elements: {}, length: 0 };
    }
    const raw = body.innerText || body.textContent || '';
    const normalized = normalizeContent(raw);
    const hash = await computeHash(normalized);
    return {
      compoundText: normalized,
      hash,
      elements: { body: normalized.slice(0, 150) },
      length: normalized.length,
    };
  }

  const elementsMap = {};
  const segments = [];

  for (const sel of selectors) {
    const nodes = docRoot.querySelectorAll(sel);
    if (nodes.length === 0) {
      elementsMap[sel] = '[NOT FOUND]';
      segments.push(`[SELECTOR: ${sel}]\n[NOT FOUND]`);
      continue;
    }

    const nodeTexts = [];
    for (const node of nodes) {
      const raw = node.innerText || node.textContent || '';
      const norm = normalizeContent(raw);
      if (norm.length > 0) {
        nodeTexts.push(norm);
      }
    }

    const combined = nodeTexts.join(' | ');
    elementsMap[sel] = combined.slice(0, 150);
    segments.push(`[SELECTOR: ${sel}]\n${combined}`);
  }

  const compoundText = segments.join('\n---\n');
  const hash = await computeHash(compoundText);

  return {
    compoundText,
    hash,
    elements: elementsMap,
    length: compoundText.length,
  };
}

/**
 * Compares two element snapshots and pinpoints specific changes.
 * @param {Record<string, string>} prev
 * @param {Record<string, string>} curr
 * @returns {string[]}
 */
export function findChangedElements(prev, curr) {
  if (!prev) {
    return [];
  }

  if (!curr) {
    return ['Content removed'];
  }

  const changes = [];
  const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)]));

  for (const k of allKeys) {
    const before = prev[k] || '[NEW]';
    const after = curr[k] || '[REMOVED]';
    if (before === after) {
      continue;
    }
    changes.push(`${k}: '${before}' -> '${after}'`);
  }

  return changes;
}
