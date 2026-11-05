// Allow-list HTML sanitiser for blog bodies. Blog HTML is rendered on a PUBLIC page, so it is cleaned on every write.
// Anything not explicitly allowed is dropped: unknown tags (their text is kept, except script/style/etc. whose
// content is removed too), every attribute not listed, javascript:/data:/vbscript: URLs, comments and event handlers.

const VOID = new Set(['br', 'img']);
const ALLOWED_TAGS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'img', 'blockquote', 'br']);
// Tags whose whole content is removed, not just the tag.
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'textarea', 'title']);
// Editors (contenteditable) emit <b>/<i>: treat them as <strong>/<em>.
const ALIAS: Record<string, string> = { b: 'strong', i: 'em' };

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n', nbsp: ' ' };

// Browsers decode entities inside attribute values before using them, so decode first and judge the real value.
function decodeEntities(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const escapeText = (s: string) => s.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// http(s), mailto, or a relative URL (/path, #anchor, ?query, path). Never protocol-relative (//host) or any other scheme.
export function safeUrl(raw: string, opts: { mailto?: boolean } = { mailto: true }): string | null {
  const v = decodeEntities(raw).replace(new RegExp('[\\u0000-\\u0020\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029\\ufeff]', 'g'), '');
  if (!v || v.length > 2000) return null;
  if (/^(https?:)/i.test(v)) return /^https?:\/\/[^/]/i.test(v) ? v : null;
  if (opts.mailto !== false && /^mailto:[^\s]+$/i.test(v)) return v;
  if (v.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // any other scheme
  if (/^[\\]/.test(v)) return null;
  return v;
}

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string') return '';
  const html = input.replace(/<!--[\s\S]*?-->/g, '').replace(/\u0000/g, '');
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const out: string[] = [];
  const stack: string[] = [];
  let skipUntil: string | null = null; // inside a drop-with-content tag
  let skipDepth = 0;
  let last = 0;
  let m: RegExpExecArray | null;

  const text = (s: string) => { if (!skipUntil && s) out.push(escapeText(s)); };

  while ((m = tagRe.exec(html))) {
    text(html.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === '/';
    const lower = m[2].toLowerCase();
    const name = ALIAS[lower] ?? lower;

    if (skipUntil) {
      if (name === skipUntil) { if (closing) { if (--skipDepth === 0) skipUntil = null; } else if (!m[3].trim().endsWith('/')) skipDepth++; }
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing && !m[3].trim().endsWith('/')) { skipUntil = name; skipDepth = 1; }
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue; // unknown tag: drop the tag, keep its text

    if (closing) {
      const i = stack.lastIndexOf(name);
      if (i === -1 || VOID.has(name)) continue; // stray closer
      while (stack.length > i) out.push(`</${stack.pop()}>`);
      continue;
    }

    const attrs = parseAttrs(m[3]);
    let tag = `<${name}`;
    if (name === 'a') {
      const href = attrs.href !== undefined ? safeUrl(attrs.href) : null;
      if (href) tag += ` href="${escapeAttr(href)}" rel="noopener noreferrer nofollow"`;
    } else if (name === 'img') {
      const src = attrs.src !== undefined ? safeUrl(attrs.src, { mailto: false }) : null;
      if (!src) continue; // an image without a safe source is meaningless: drop it
      tag += ` src="${escapeAttr(src)}" alt="${escapeAttr(decodeEntities(attrs.alt ?? '').slice(0, 300))}" loading="lazy"`;
    }
    tag += '>';
    out.push(tag);
    if (!VOID.has(name)) stack.push(name);
  }
  text(html.slice(last));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}
