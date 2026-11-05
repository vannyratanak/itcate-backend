// Admin section: Gallery. Owned by the "gallery" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'gallery', label: 'Gallery', group: 'Content',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, imgUrl, plural } = kit;

    if (!document.getElementById('gallery-admin-css')) {
      const st = document.createElement('style');
      st.id = 'gallery-admin-css';
      st.textContent = `
        .gal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
        .gal-tile { position: relative; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); display: flex; flex-direction: column; }
        .gal-tile.off .gal-img { opacity: .4; filter: grayscale(.6); }
        .gal-tile.dragging { opacity: .45; outline: 2px dashed var(--accent); outline-offset: -2px; }
        .gal-img { aspect-ratio: 4 / 3; width: 100%; object-fit: cover; background: var(--surface-2); display: block; }
        .gal-grip { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.55); color: #fff; border-radius: 8px; padding: 2px 7px; }
        .gal-grip:hover, .gal-grip:focus-visible { background: var(--accent); color: #fff; }
        .gal-badge { position: absolute; top: 8px; right: 8px; }
        .gal-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .gal-cap { font-size: 13px; line-height: 1.35; min-height: 2.7em; }
        .gal-cap .kh { color: var(--text-dim); margin-top: 2px; }
        .gal-cap .none { color: var(--text-dim); font-style: italic; }
        .gal-actions { display: flex; gap: 6px; align-items: center; justify-content: space-between; margin-top: auto; }
        .gal-uploading { color: var(--text-dim); font-size: 13px; margin: 0 0 12px; }
      `;
      document.head.append(st);
    }

    let items = [];
    const hint = h('p', { class: 'hint intro' }, 'Photos shown on the public Gallery page. Drag ⠿ (or focus it and press ← →) to change the order. Use the switch to hide a photo without deleting it.');
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, class: 'hidden', 'aria-label': 'Choose images to upload' });
    const uploadBtn = h('button', { class: 'btn-primary', type: 'button', onclick: () => fileInput.click() }, 'Upload images');
    const status = h('p', { class: 'gal-uploading hidden', role: 'status' });
    const grid = h('div', { class: 'gal-grid' });
    const empty = h('p', { class: 'empty hidden' }, 'No photos yet. Upload some to fill your Gallery page.');
    el.replaceChildren(h('div', { class: 'toolbar' }, hint, uploadBtn, fileInput), status, h('div', { class: 'card' }, grid, empty));

    async function reload() {
      items = await api('/gallery/all');
      render();
    }

    function sw(it) {
      const knob = h('span', { class: 'knob' });
      const b = h('button', { class: `switch${it.active ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(it.active), 'aria-label': 'Show this photo on the Gallery page', title: it.active ? 'Visible' : 'Hidden' }, knob);
      b.addEventListener('click', guard(async () => {
        const next = !it.active;
        await api(`/gallery/${it.id}`, 'PATCH', { active: next });
        it.active = next; render(); notify(next ? 'Photo is now visible' : 'Photo is now hidden');
      }));
      return b;
    }

    function render() {
      empty.classList.toggle('hidden', items.length > 0);
      grid.replaceChildren(...items.map((it) => h('div', { class: `gal-tile${it.active ? '' : ' off'}`, 'data-id': it.id },
        h('img', { class: 'gal-img', src: imgUrl(it.url), alt: it.caption_en || '', loading: 'lazy' }),
        h('button', { class: 'grip gal-grip', type: 'button', title: 'Drag to reorder (or press ← →)', 'aria-label': `Reorder photo ${it.caption_en || it.id}` }, '⠿'),
        it.active ? '' : h('span', { class: 'badge off gal-badge' }, 'Hidden'),
        h('div', { class: 'gal-body' },
          h('div', { class: 'gal-cap' },
            it.caption_en ? h('div', {}, it.caption_en) : h('div', { class: 'none' }, 'No caption'),
            it.caption_kh ? h('div', { class: 'kh' }, it.caption_kh) : ''),
          h('div', { class: 'gal-actions' },
            sw(it),
            h('div', { class: 'row-actions', style: 'opacity:1' },
              h('button', { class: 'btn-ghost small', type: 'button', onclick: () => captionModal(it) }, 'Edit'),
              h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete photo', 'Delete this photo from the gallery?', 'Delete', async () => {
                await api(`/gallery/${it.id}`, 'DELETE'); notify('Photo deleted'); await reload();
              }) }, 'Delete')))))));
    }

    function captionModal(it) {
      const body = h('form', { onsubmit: (e) => e.preventDefault() },
        h('img', { src: imgUrl(it.url), alt: '', style: 'width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px' }),
        h('label', { for: 'g-en' }, 'Caption (English)'), h('input', { id: 'g-en', value: it.caption_en ?? '', maxlength: 200 }),
        h('label', { for: 'g-kh' }, 'Caption (Khmer)'), h('input', { id: 'g-kh', value: it.caption_kh ?? '', maxlength: 200 }));
      const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        await api(`/gallery/${it.id}`, 'PATCH', { caption_en: document.getElementById('g-en').value, caption_kh: document.getElementById('g-kh').value });
        closeModal(); notify('Caption saved'); await reload();
      }) }, 'Save');
      openModal('Edit caption', body, [cancelBtn(), save]);
      setTimeout(() => document.getElementById('g-en').focus(), 0);
    }

    // ---- upload (several files at once, one after another) ----
    fileInput.addEventListener('change', guard(async () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      if (!files.length) return;
      uploadBtn.disabled = true;
      let done = 0; const failed = [];
      for (const f of files) {
        status.textContent = `Uploading ${done + 1} of ${files.length}…`; status.classList.remove('hidden');
        try {
          const fd = new FormData(); fd.append('file', f);
          const { url } = await api('/uploads', 'POST', fd, true);
          await api('/gallery', 'POST', { url });
          done++;
        } catch (e) { failed.push(`${f.name}: ${e.message}`); }
      }
      uploadBtn.disabled = false; status.classList.add('hidden');
      await reload();
      if (failed.length) notify(`${plural(done, 'photo')} added. Failed: ${failed.join('; ')}`, false);
      else notify(`${plural(done, 'photo')} added`);
    }));

    // ---- drag to reorder (grid aware: left/right half of the tile under the pointer) ----
    let dragged = null, before = [];
    const ids = () => [...grid.children].map((c) => parseInt(c.dataset.id, 10));
    async function commit() {
      const now = ids();
      if (now.join() === before.join()) return;
      try {
        await api('/gallery/reorder', 'PATCH', { ids: now });
        items.sort((a, b) => now.indexOf(a.id) - now.indexOf(b.id));
        notify('Order saved');
      } catch (e) { notify(e.message, false); await reload(); }
    }
    grid.addEventListener('pointerdown', (e) => { const g = e.target.closest('.gal-grip'); if (g) g.closest('.gal-tile').draggable = true; });
    grid.addEventListener('dragstart', (e) => {
      if (!e.target.draggable || !e.target.classList?.contains('gal-tile')) return;
      dragged = e.target; before = ids();
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '');
      requestAnimationFrame(() => dragged && dragged.classList.add('dragging'));
    });
    grid.addEventListener('dragover', (e) => {
      if (!dragged) return;
      e.preventDefault();
      const t = e.target.closest('.gal-tile');
      if (!t || t === dragged) return;
      const r = t.getBoundingClientRect();
      const afterIt = e.clientX > r.left + r.width / 2;
      grid.insertBefore(dragged, afterIt ? t.nextSibling : t);
    });
    grid.addEventListener('drop', (e) => { if (dragged) e.preventDefault(); });
    grid.addEventListener('dragend', () => {
      if (!dragged) return;
      dragged.classList.remove('dragging'); dragged.draggable = false; dragged = null; commit();
    });
    grid.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('gal-grip') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const tile = e.target.closest('.gal-tile');
      e.preventDefault();
      before = ids();
      const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
      const other = back ? tile.previousElementSibling : tile.nextElementSibling;
      if (!other) return;
      grid.insertBefore(tile, back ? other : other.nextSibling);
      e.target.focus();
      commit();
    });

    await reload();
  },
});
