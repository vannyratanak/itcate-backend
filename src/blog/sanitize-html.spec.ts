import { sanitizeHtml, safeUrl } from './sanitize-html';

describe('sanitizeHtml', () => {
  it('keeps allowed formatting', () => {
    const html = '<h2>Hi</h2><p>A <strong>bold</strong> and <em>soft</em> line<br></p><ul><li>one</li></ul><blockquote>q</blockquote>';
    expect(sanitizeHtml(html)).toBe(html);
  });
  it('maps editor <b>/<i> to <strong>/<em>', () => {
    expect(sanitizeHtml('<p><b>x</b> <i>y</i></p>')).toBe('<p><strong>x</strong> <em>y</em></p>');
  });
  it('removes script/style with their content', () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script><style>p{}</style><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(sanitizeHtml('<script><script>x</script>y</script>z')).toBe('z');
  });
  it('drops event handlers and unknown attributes', () => {
    expect(sanitizeHtml('<p onclick="x()" style="color:red" class="c">t</p>')).toBe('<p>t</p>');
    expect(sanitizeHtml('<img src="/uploads/a.png" onerror="x()">')).toBe('<img src="/uploads/a.png" alt="" loading="lazy">');
  });
  it('blocks javascript:/data:/vbscript: URLs, including obfuscated', () => {
    for (const u of ['javascript:alert(1)', ' JaVa\tScRiPt:alert(1)', 'jav&#x61;script:alert(1)', 'java&Tab;script:x', 'data:text/html,<b>', 'vbscript:x', '&#106;avascript:x', '//evil.com/x']) {
      expect(sanitizeHtml(`<a href="${u}">x</a>`)).toBe('<a>x</a>');
    }
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe('');
  });
  it('allows http(s), mailto and relative links, adding rel', () => {
    expect(sanitizeHtml('<a href="https://x.com/a?b=1&c=2">x</a>')).toBe('<a href="https://x.com/a?b=1&amp;c=2" rel="noopener noreferrer nofollow">x</a>');
    expect(sanitizeHtml('<a href="mailto:a@b.com">m</a>')).toContain('href="mailto:a@b.com"');
    expect(sanitizeHtml('<a href="/menu">m</a>')).toContain('href="/menu"');
  });
  it('drops unknown tags but keeps their text; neutralises iframes/svg', () => {
    expect(sanitizeHtml('<div><span>keep</span></div>')).toBe('keep');
    expect(sanitizeHtml('<iframe src="x">no</iframe>ok')).toBe('ok');
    expect(sanitizeHtml('<svg onload="x()"><circle/></svg>ok')).toBe('ok');
  });
  it('handles broken markup and balances tags', () => {
    expect(sanitizeHtml('<p><strong>x')).toBe('<p><strong>x</strong></p>');
    expect(sanitizeHtml('</p>x</em>')).toBe('x');
    expect(sanitizeHtml('<<script>alert(1)</script>p>')).toBe('&lt;p&gt;');
    expect(sanitizeHtml('<a href="x" <script>')).not.toContain('<script');
  });
  it('escapes stray < > & in text and strips comments', () => {
    expect(sanitizeHtml('a < b > c & d <!-- hid -->')).toBe('a &lt; b &gt; c &amp; d ');
    expect(sanitizeHtml('<p>Tom &amp; Jerry &copy;</p>')).toBe('<p>Tom &amp; Jerry &copy;</p>');
  });
  it('handles non-strings and quoted ">" inside attributes', () => {
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('<a href="/a>b" title="x>y">t</a>')).toBe('<a href="/a&gt;b" rel="noopener noreferrer nofollow">t</a>');
  });
});

describe('safeUrl', () => {
  it('rejects empty and weird values', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('\\\\evil')).toBeNull();
    expect(safeUrl('https://')).toBeNull();
  });
});
