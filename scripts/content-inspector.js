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
 * In-browser inspection routine invoked inside the monitored tab.
 * @param {string} selector
 * @returns {Promise<{ hash: string, preview: string, length: number }>}
 */
export async function inspectDom(selector) {
  let targetElement = null;

  if (selector && selector.trim().length > 0) {
    targetElement = document.querySelector(selector.trim());
  }

  if (!targetElement) {
    targetElement = document.body;
  }

  if (!targetElement) {
    return {
      hash: '',
      preview: '',
      length: 0,
    };
  }

  const raw = targetElement.innerText || targetElement.textContent || '';
  const normalized = normalizeContent(raw);
  const hash = await computeHash(normalized);
  const preview = normalized.slice(0, 100);

  return {
    hash,
    preview,
    length: normalized.length,
  };
}
