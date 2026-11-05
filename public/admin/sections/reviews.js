// Admin section: Reviews. Owned by the "reviews" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'reviews', label: 'Reviews', group: 'Content',
  async load(el, kit) {
    const { api, h, notify, guard, when } = kit;
    const state = el._state || (el._state = { filter: 'all', page: 1 });

    const stars = (s) => s == null ? h('span', { class: 'hint', style: 'margin:0' }, 'no score')
      : h('span', { title: `${s} out of 5`, style: 'white-space:nowrap' },
          h('span', { style: 'color:#E5902C;letter-spacing:1px' }, '★'.repeat(Math.round(s))), h('span', { style: 'opacity:.3;letter-spacing:1px' }, '★'.repeat(5 - Math.round(s))), ` ${s.toFixed(1)}`);

    function toggle(r) {
      const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-label': `Show ${r.name}'s comment on the Reviews page` }, h('span', { class: 'knob' }));
      const paint = () => { sw.setAttribute('aria-checked', String(r.approved)); sw.classList.toggle('on', r.approved); sw.title = r.approved ? 'Shown on the Reviews page' : 'Hidden'; };
      sw.addEventListener('click', guard(async () => {
        const next = !r.approved; r.approved = next; paint();
        try { await api(`/reviews/${r.id}`, 'PATCH', { approved: next }); notify(next ? 'Comment is now public (first name only)' : 'Comment hidden'); }
        catch (e) { r.approved = !next; paint(); throw e; }
      }));
      paint();
      return h('span', { class: 'switch-wrap' }, sw, h('span', { class: 'hint', style: 'margin:0;min-width:56px' }, r.approved ? 'Public' : 'Hidden'));
    }

    async function refresh() {
      const q = state.filter === 'all' ? '' : `&approved=${state.filter === 'approved'}`;
      const d = await api(`/reviews/all?page=${state.page}${q}`);
      const filt = (k, label) => h('button', { class: 'btn-ghost', type: 'button', 'aria-pressed': String(state.filter === k),
        style: state.filter === k ? 'border-color:var(--accent);color:var(--accent)' : '', onclick: () => { state.filter = k; state.page = 1; refresh(); } }, label);
      const rows = d.items.map((r) => h('tr', {},
        h('td', { class: 'wrap' }, h('div', { style: 'font-weight:600' }, r.name), h('div', { class: 'hint', style: 'margin:2px 0 0' }, r.phone)),
        h('td', {}, stars(r.score)),
        h('td', { class: 'wrap', style: 'min-width:240px;white-space:pre-wrap' }, r.message),
        h('td', {}, when(r.created_at)),
        h('td', {}, toggle(r))));
      el.replaceChildren(
        h('div', { class: 'toolbar' },
          h('div', { style: 'display:flex;gap:8px' }, filt('all', 'All'), filt('pending', 'Hidden'), filt('approved', 'Public')),
          h('span', { class: 'hint', style: 'margin:0' }, `${d.total} comment${d.total === 1 ? '' : 's'}`)),
        h('p', { class: 'hint intro' }, 'Only comments you switch on appear on the website Reviews page, and only with the guest\'s first name. Phone numbers are never shown.'),
        h('div', { class: 'table-wrap' }, d.items.length
          ? h('table', {}, h('thead', {}, h('tr', {}, ...['Guest', 'Score', 'Comment', 'Date', 'Public'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows))
          : h('p', { class: 'empty' }, 'No survey comments here yet.')),
        d.pages > 1 ? h('div', { class: 'toolbar', style: 'margin-top:12px;justify-content:center' },
          h('button', { class: 'btn-ghost small', type: 'button', disabled: d.page <= 1, onclick: () => { state.page--; refresh(); } }, '← Newer'),
          h('span', { class: 'hint', style: 'margin:0' }, `Page ${d.page} of ${d.pages}`),
          h('button', { class: 'btn-ghost small', type: 'button', disabled: d.page >= d.pages, onclick: () => { state.page++; refresh(); } }, 'Older →')) : '');
    }
    await refresh();
  },
});
