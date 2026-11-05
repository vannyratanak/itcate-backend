// Admin section: Blog. Owned by the "blog" feature (this file only).
// List of posts + a full-page editor (English and Khmer title/excerpt/body, cover image, formatting toolbar, publish toggle).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'blog', label: 'Blog', group: 'Content',
  async load(el, kit) {
    const { api, h, notify, guard, confirmModal, imgUrl } = kit;
    if (!document.getElementById('blog-rt-css')) document.head.append(h('style', { id: 'blog-rt-css' },
      '.rt-area:empty::before{content:attr(data-placeholder);opacity:.5}.rt-area h2{font-size:20px;margin:14px 0 6px}.rt-area h3{font-size:17px;margin:12px 0 4px}.rt-area p{margin:0 0 10px}.rt-area ul,.rt-area ol{margin:0 0 10px 22px}.rt-area ul{list-style:disc}.rt-area ol{list-style:decimal}.rt-area blockquote{border-left:3px solid var(--accent);padding-left:12px;margin:0 0 10px;opacity:.85}.rt-area img{max-width:100%;border-radius:8px}.rt-area a{color:var(--accent);text-decoration:underline}'));
    const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const MAX_IMG = 3 * 1024 * 1024;
    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
    let frontend = '';
    try { frontend = (await api('/pages/config')).frontend_url || ''; } catch { /* the link is optional */ }

    // ------------------------------------------------------------ list
    async function showList() {
      const posts = await api('/blog/all/list');
      const newBtn = h('button', { class: 'btn-primary', type: 'button', onclick: () => showEditor(null) }, 'New post');
      const rows = posts.map((p) => h('tr', {},
        h('td', { style: 'width:72px' }, p.cover_url
          ? h('img', { src: imgUrl(p.cover_url), alt: '', style: 'width:56px;height:40px;object-fit:cover;border-radius:6px;display:block' })
          : h('div', { style: 'width:56px;height:40px;border-radius:6px;background:var(--surface-2)' })),
        h('td', {}, h('div', { style: 'font-weight:600' }, p.title_en), p.title_kh ? h('div', { class: 'kh hint', style: 'margin:0' }, p.title_kh) : '',
          h('div', { class: 'hint', style: 'margin:0;font-size:12px' }, `/blog/${p.slug}`)),
        h('td', {}, h('span', { class: p.published ? 'badge' : 'badge off' }, p.published ? 'Published' : 'Draft')),
        h('td', {}, fmtDate(p.published_at || p.created_at)),
        h('td', {}, h('div', { class: 'row-actions', style: 'opacity:1;justify-content:flex-end' },
          p.published && frontend ? h('a', { class: 'btn-ghost small', href: `${frontend}/blog/${p.slug}`, target: '_blank', rel: 'noopener' }, 'View') : '',
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => showEditor(p.id) }, 'Edit'),
          h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete post', `Delete "${p.title_en}"? This cannot be undone.`, 'Delete', async () => {
            await api(`/blog/${p.id}`, 'DELETE'); notify('Post deleted'); await showList();
          }) }, 'Delete')))));
      el.replaceChildren(
        h('div', { class: 'toolbar' }, h('p', { class: 'hint intro', style: 'margin:0' }, 'Write news and stories for the public Blog page. Drafts stay hidden until you publish them.'), newBtn),
        posts.length
          ? h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Post'), h('th', {}, 'Status'), h('th', {}, 'Date'), h('th', {}, ''))), h('tbody', {}, ...rows)))
          : h('div', { class: 'card empty-state' }, h('p', { class: 'empty' }, 'No posts yet. Click “New post” to write your first one.')));
    }

    // ------------------------------------------------------------ client-side cleaner (server sanitises again on save)
    const OK = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'IMG', 'BLOCKQUOTE', 'BR']);
    const ALIAS = { B: 'strong', I: 'em', DIV: 'p', H1: 'h2', H4: 'h3', H5: 'h3', H6: 'h3' };
    const safe = (u) => { const v = (u || '').replace(/[\u0000- ]/g, ''); return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(v) ? u : null; };
    function cleanInto(src, dst) {
      for (const node of [...src.childNodes]) {
        if (node.nodeType === 3) { dst.append(document.createTextNode(node.nodeValue)); continue; }
        if (node.nodeType !== 1) continue;
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'TEMPLATE'].includes(node.tagName.toUpperCase())) continue;
        const tag = ALIAS[node.tagName] ? ALIAS[node.tagName].toUpperCase() : node.tagName;
        if (!OK.has(tag)) { cleanInto(node, dst); continue; } // unknown tag: keep its children
        const out = document.createElement(tag.toLowerCase());
        if (tag === 'A') { const u = safe(node.getAttribute('href')); if (u) out.setAttribute('href', u); }
        if (tag === 'IMG') { const u = safe(node.getAttribute('src')); if (!u) continue; out.setAttribute('src', u); out.setAttribute('alt', node.getAttribute('alt') || ''); }
        if (tag !== 'IMG' && tag !== 'BR') cleanInto(node, out);
        dst.append(out);
      }
    }
    function cleanHtml(html) {
      const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html'); // inert: nothing executes
      const box = document.createElement('div');
      cleanInto(doc.body, box);
      return box.innerHTML;
    }

    // ------------------------------------------------------------ rich text field
    function richField(label, initial, placeholder) {
      const area = h('div', { class: 'rt-area', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, 'data-placeholder': placeholder,
        style: 'min-height:200px;max-height:420px;overflow:auto;padding:12px 14px;border:1px solid var(--border);border-radius:0 0 8px 8px;background:var(--surface-2);outline:none;line-height:1.6' });
      area.innerHTML = cleanHtml(initial); // already cleaned through the inert parser above
      let saved = null;
      const keepSel = () => { const s = getSelection(); if (s.rangeCount && area.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
      const restore = () => { area.focus(); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } };
      area.addEventListener('keyup', keepSel); area.addEventListener('mouseup', keepSel); area.addEventListener('blur', keepSel);
      area.addEventListener('paste', (e) => { // paste as plain text: no foreign markup
        e.preventDefault();
        const t = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, t);
      });
      const cmd = (name, arg) => { restore(); document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand(name, false, arg); keepSel(); };
      const btn = (text, title, fn, extra = '') => h('button', { type: 'button', class: 'btn-ghost small', title, 'aria-label': title, style: `padding:5px 10px;${extra}`,
        onmousedown: (e) => e.preventDefault(), onclick: fn }, text);

      const linkInput = h('input', { type: 'url', placeholder: 'https://… or /menu', style: 'flex:1;min-width:160px;margin:0' });
      const linkRow = h('div', { class: 'hidden', style: 'display:none;gap:8px;padding:8px 10px;border:1px solid var(--border);border-top:0;background:var(--surface);align-items:center' },
        linkInput,
        h('button', { type: 'button', class: 'btn-primary small', onclick: () => {
          const u = safe(linkInput.value.trim());
          if (!u) return notify('Enter a web address (https://…) or a page like /menu', false);
          cmd('createLink', u); linkRow.style.display = 'none'; linkInput.value = '';
        } }, 'Apply'),
        h('button', { type: 'button', class: 'btn-ghost small', onclick: () => { linkRow.style.display = 'none'; } }, 'Cancel'));
      const fileInput = h('input', { type: 'file', accept: IMG_TYPES.join(','), style: 'display:none', onchange: guard(async () => {
        const f = fileInput.files[0]; fileInput.value = '';
        if (!f) return;
        if (!IMG_TYPES.includes(f.type)) throw new Error('Only PNG, JPG, WEBP or GIF images are allowed');
        if (f.size > MAX_IMG) throw new Error('That image is larger than 3 MB');
        const fd = new FormData(); fd.append('file', f);
        const { url } = await api('/uploads', 'POST', fd, true);
        cmd('insertImage', url);
      }) });

      const bar = h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;padding:6px;border:1px solid var(--border);border-bottom:0;border-radius:8px 8px 0 0;background:var(--surface)' },
        btn('B', 'Bold', () => cmd('bold'), 'font-weight:800'),
        btn('I', 'Italic', () => cmd('italic'), 'font-style:italic'),
        btn('H2', 'Heading', () => cmd('formatBlock', 'h2')),
        btn('H3', 'Subheading', () => cmd('formatBlock', 'h3')),
        btn('¶', 'Normal paragraph', () => cmd('formatBlock', 'p')),
        btn('• List', 'Bulleted list', () => cmd('insertUnorderedList')),
        btn('1. List', 'Numbered list', () => cmd('insertOrderedList')),
        btn('❝', 'Quote', () => cmd('formatBlock', 'blockquote')),
        btn('Link', 'Add link to the selected text', () => { keepSel(); linkRow.style.display = 'flex'; linkInput.focus(); }),
        btn('Unlink', 'Remove link', () => cmd('unlink')),
        btn('Image', 'Insert an image', () => { keepSel(); fileInput.click(); }));
      return { node: h('div', { class: 'rt' }, h('label', {}, label), bar, linkRow, area, fileInput), value: () => cleanHtml(area.innerHTML) };
    }

    // ------------------------------------------------------------ cover picker
    function coverField(initial) {
      let url = initial || null;
      const box = h('div', {});
      const input = h('input', { type: 'file', accept: IMG_TYPES.join(','), style: 'display:none', onchange: guard(async () => {
        const f = input.files[0]; input.value = '';
        if (!f) return;
        if (!IMG_TYPES.includes(f.type)) throw new Error('Only PNG, JPG, WEBP or GIF images are allowed');
        if (f.size > MAX_IMG) throw new Error('That image is larger than 3 MB');
        const fd = new FormData(); fd.append('file', f);
        url = (await api('/uploads', 'POST', fd, true)).url; draw();
      }) });
      function draw() {
        box.replaceChildren(input, url
          ? h('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' },
            h('img', { src: imgUrl(url), alt: '', style: 'width:180px;height:110px;object-fit:cover;border-radius:10px;border:1px solid var(--border)' }),
            h('button', { type: 'button', class: 'btn-ghost small', onclick: () => input.click() }, 'Replace'),
            h('button', { type: 'button', class: 'btn-ghost small danger', onclick: () => { url = null; draw(); } }, 'Remove'))
          : h('button', { type: 'button', class: 'btn-ghost', onclick: () => input.click() }, 'Upload cover image (PNG, JPG, WEBP, GIF · up to 3 MB)'));
      }
      draw();
      return { node: h('div', {}, h('label', {}, 'Cover image'), box), value: () => url };
    }

    // ------------------------------------------------------------ editor
    async function showEditor(id) {
      const post = id ? await api(`/blog/id/${id}`) : {};
      const t = (key, label, attrs = {}) => { const i = h('input', { value: post[key] ?? '', maxlength: attrs.maxlength ?? 200, ...attrs }); return { i, node: h('div', {}, h('label', {}, label), i) }; };
      const ta = (key, label, ph) => { const i = h('textarea', { rows: 3, maxlength: 500, placeholder: ph, style: 'width:100%' }); i.value = post[key] ?? ''; return { i, node: h('div', {}, h('label', {}, label), i) }; };

      const titleEn = t('title_en', 'Title (English)', { required: true });
      const titleKh = t('title_kh', 'Title (Khmer)');
      const slug = t('slug', 'Web address (slug)', { maxlength: 80, placeholder: 'auto-generated from the English title' });
      const exEn = ta('excerpt_en', 'Short summary (English)', 'One or two sentences shown on the blog list');
      const exKh = ta('excerpt_kh', 'Short summary (Khmer)', '');
      const cover = coverField(post.cover_url);
      const bodyEn = richField('Body (English)', post.html_en, 'Write the post in English…');
      const bodyKh = richField('Body (Khmer)', post.html_kh, 'សរសេរអត្ថបទជាភាសាខ្មែរ…');
      const published = h('input', { type: 'checkbox', id: 'blog-pub', style: 'width:auto;margin:0 8px 0 0' });
      published.checked = !!post.published;

      const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        if (!titleEn.i.value.trim()) throw new Error('The English title is required');
        const payload = {
          title_en: titleEn.i.value, title_kh: titleKh.i.value || null,
          excerpt_en: exEn.i.value || null, excerpt_kh: exKh.i.value || null,
          cover_url: cover.value(), html_en: bodyEn.value(), html_kh: bodyKh.value() || null,
          published: published.checked,
        };
        if (slug.i.value.trim()) payload.slug = slug.i.value.trim();
        const saved = await (id ? api(`/blog/${id}`, 'PATCH', payload) : api('/blog', 'POST', payload));
        notify(id ? 'Post saved' : 'Post created');
        await showEditor(saved.id);
      }) }, 'Save post');

      el.replaceChildren(
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn-ghost', type: 'button', onclick: guard(showList) }, '← All posts'),
          h('div', { style: 'display:flex;gap:10px;align-items:center' },
            h('label', { for: 'blog-pub', style: 'display:flex;align-items:center;margin:0;cursor:pointer' }, published, 'Published'), save)),
        h('div', { class: 'card', style: 'display:grid;gap:14px' },
          h('div', { style: 'display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' }, titleEn.node, titleKh.node),
          slug.node,
          h('div', { style: 'display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' }, exEn.node, exKh.node),
          cover.node,
          bodyEn.node, bodyKh.node));
      window.scrollTo({ top: 0 });
    }

    await showList();
  },
});
