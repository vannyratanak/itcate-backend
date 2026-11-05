// Admin section: Offers & Events. Owned by the "offers" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'offers', label: 'Offers & Events', group: 'Content',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, sortable, grip, imgUrl } = kit;
    const KINDS = { offer: { label: 'Offers', one: 'offer' }, event: { label: 'Events', one: 'event' } };
    const state = el._state || (el._state = { tab: 'offer', rows: [] });
    const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    // <input type="datetime-local"> works in local time; the API stores ISO (UTC).
    const toLocalInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso); if (isNaN(d)) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

    async function refresh() { state.rows = await api('/offers/all'); render(); }

    function windowText(r) {
      if (r.kind === 'event') return r.starts_at ? fmt(r.starts_at) : 'No date set';
      if (r.starts_at && r.ends_at) return `${fmt(r.starts_at)} → ${fmt(r.ends_at)}`;
      if (r.ends_at) return `Until ${fmt(r.ends_at)}`;
      if (r.starts_at) return `From ${fmt(r.starts_at)}`;
      return 'Always on';
    }

    function activeSwitch(r) {
      const sw = h('button', { class: 'switch', type: 'button', role: 'switch' }, h('span', { class: 'knob' }));
      const paint = () => { sw.setAttribute('aria-checked', String(r.active)); sw.classList.toggle('on', r.active); sw.title = r.active ? 'Shown on the website' : 'Hidden from the website'; };
      sw.addEventListener('click', guard(async () => {
        const next = !r.active; r.active = next; paint();
        try { await api(`/offers/${r.id}`, 'PATCH', { active: next }); notify(next ? `"${r.title_en}" is now shown` : `"${r.title_en}" is now hidden`); }
        catch (e) { r.active = !next; paint(); throw e; }
      }));
      paint();
      return h('span', { class: 'switch-wrap' }, sw);
    }

    function render() {
      const kind = state.tab;
      const rows = state.rows.filter((r) => r.kind === kind);
      const tab = (k) => h('button', { class: `btn-ghost${state.tab === k ? ' active-tab' : ''}`, type: 'button', 'aria-pressed': String(state.tab === k),
        style: state.tab === k ? 'border-color:var(--accent);color:var(--accent)' : '', onclick: () => { state.tab = k; render(); } },
        `${KINDS[k].label} (${state.rows.filter((r) => r.kind === k).length})`);
      const list = h('ul', { class: 'cat-list' }, ...rows.map((r) => h('li', { 'data-id': r.id },
        grip(r.title_en),
        r.image_url ? h('img', { class: 'thumb', src: imgUrl(r.image_url), alt: '' }) : h('div', { class: 'thumb', 'aria-hidden': 'true' }),
        h('div', { class: 'cat-name' }, h('div', {}, r.title_en), r.title_kh ? h('div', { class: 'kh' }, r.title_kh) : '',
          h('div', { class: 'hint', style: 'margin:2px 0 0;font-size:12px' }, windowText(r))),
        r.expired ? h('span', { class: 'badge off', title: 'Its date has passed, so it is hidden on the website' }, 'Expired') : '',
        activeSwitch(r),
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => editor(r) }, 'Edit'),
          h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal(`Delete ${KINDS[kind].one}`, `Delete "${r.title_en}"? This cannot be undone.`, 'Delete', async () => {
            await api(`/offers/${r.id}`, 'DELETE'); notify('Deleted'); await refresh();
          }) }, 'Delete')))));
      sortable(list, guard(async (ids) => {
        try { await api('/offers/reorder', 'PATCH', { kind, ids }); notify('Order saved'); state.rows.sort((a, b) => a.kind !== b.kind ? 0 : ids.indexOf(a.id) - ids.indexOf(b.id)); }
        catch (e) { await refresh(); throw e; }
      }));
      el.replaceChildren(
        h('div', { class: 'toolbar' },
          h('div', { style: 'display:flex;gap:8px' }, tab('offer'), tab('event')),
          h('button', { class: 'btn-primary', type: 'button', onclick: () => editor(null) }, `New ${KINDS[kind].one}`)),
        h('p', { class: 'hint intro' }, kind === 'event'
          ? 'Events appear on the website in date order and disappear after their date. Drag ⠿ to reorder events that have no date.'
          : 'Offers appear on the website in this order. Set an end date to hide an offer automatically. Drag ⠿ to reorder.'),
        h('div', { class: 'card cat-card' }, rows.length ? list : h('p', { class: 'empty' }, `No ${KINDS[kind].label.toLowerCase()} yet.`)));
    }

    function editor(r) {
      const kind = r?.kind ?? state.tab;
      let image = r?.image_url ?? null;
      const f = (id, label, val, attrs = {}) => [h('label', { for: id }, label), h('input', { id, value: val ?? '', ...attrs })];
      const area = (id, label, val) => [h('label', { for: id }, label), h('textarea', { id, rows: 3, maxlength: 2000 }, val ?? '')];

      // Image: pick a file -> POST /uploads -> keep the returned url.
      const file = h('input', { type: 'file', accept: IMG_TYPES.join(','), class: 'hidden' });
      const preview = h('div', { style: 'display:flex;align-items:center;gap:12px;margin:6px 0 4px' });
      const paint = () => {
        preview.replaceChildren(
          image ? h('img', { class: 'thumb', style: 'width:96px;height:60px', src: imgUrl(image), alt: '' }) : h('div', { class: 'hint', style: 'margin:0' }, 'No image (a decorative icon is shown instead)'),
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => file.click() }, image ? 'Replace' : 'Upload image'),
          image ? h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => { image = null; paint(); } }, 'Remove') : '');
      };
      file.addEventListener('change', guard(async () => {
        const f0 = file.files[0]; if (!f0) return;
        if (!IMG_TYPES.includes(f0.type)) throw new Error('Only PNG, JPG, WEBP or GIF images are allowed');
        if (f0.size > 3 * 1024 * 1024) throw new Error('Image is larger than 3 MB');
        const fd = new FormData(); fd.append('file', f0);
        image = (await api('/uploads', 'POST', fd, true)).url; paint(); file.value = '';
      }));
      paint();

      const dateRow = kind === 'event'
        ? [...f('o-start', 'Date and time', toLocalInput(r?.starts_at), { type: 'datetime-local' }),
           ...f('o-end', 'Ends (optional)', toLocalInput(r?.ends_at), { type: 'datetime-local' })]
        : [...f('o-start', 'Starts (optional)', toLocalInput(r?.starts_at), { type: 'datetime-local' }),
           ...f('o-end', 'Ends (optional, hides the offer automatically)', toLocalInput(r?.ends_at), { type: 'datetime-local' })];

      const body = h('form', { onsubmit: (e) => e.preventDefault() },
        ...f('o-title-en', 'Title (English)', r?.title_en, { required: true, maxlength: 120 }),
        ...f('o-title-kh', 'Title (Khmer)', r?.title_kh, { maxlength: 120 }),
        ...area('o-body-en', 'Description (English)', r?.body_en),
        ...area('o-body-kh', 'Description (Khmer)', r?.body_kh),
        ...dateRow,
        h('label', {}, 'Image'), preview, file,
        h('label', { style: 'display:flex;align-items:center;gap:8px;margin-top:14px' },
          h('input', { id: 'o-active', type: 'checkbox', ...((r?.active ?? true) ? { checked: true } : {}) }), 'Show on the website'));
      const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        const v = (id) => document.getElementById(id).value;
        const payload = {
          kind, title_en: v('o-title-en'), title_kh: v('o-title-kh') || null, body_en: v('o-body-en') || null, body_kh: v('o-body-kh') || null,
          starts_at: fromLocalInput(v('o-start')), ends_at: fromLocalInput(v('o-end')), image_url: image, active: document.getElementById('o-active').checked,
        };
        await (r ? api(`/offers/${r.id}`, 'PATCH', payload) : api('/offers', 'POST', payload));
        closeModal(); notify(r ? 'Saved' : `${KINDS[kind].one[0].toUpperCase()}${KINDS[kind].one.slice(1)} created`); await refresh();
      }) }, 'Save');
      openModal(r ? `Edit ${KINDS[kind].one}` : `New ${KINDS[kind].one}`, body, [cancelBtn(), save]);
      setTimeout(() => document.getElementById('o-title-en').focus(), 0);
    }

    await refresh();
  },
});
