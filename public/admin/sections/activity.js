// Admin section: Activity Log (owner only). Owned by the "activity" feature (this file only).
(() => {
  const ago = (d) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
    if (s < 45) return 'just now';
    const units = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week'], [2629800, 'month'], [31557600, 'year']];
    let best = ['second', 1];
    for (const [sec, name] of units) if (s >= sec) best = [name, sec];
    const n = Math.floor(s / best[1]);
    return `${n} ${best[0]}${n === 1 ? '' : 's'} ago`;
  };

  (window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
    id: 'activity', label: 'Activity Log', group: 'Admin',
    async load(el, kit, state = { actor: '', page: 1 }) {
      const { h, api, guard, when } = kit;
      let data, actors;
      try {
        [data, actors] = await Promise.all([
          api(`/activity?page=${state.page}${state.actor ? `&actor=${encodeURIComponent(state.actor)}` : ''}`),
          api('/activity/actors'),
        ]);
      } catch (e) {
        el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, /permission/i.test(e.message) ? 'Only owners can see the activity log.' : e.message)));
        return;
      }
      const go = (patch) => this.load(el, kit, { ...state, ...patch });
      const filter = h('select', { id: 'act-actor', 'aria-label': 'Filter by person', onchange: (e) => go({ actor: e.target.value, page: 1 }) },
        h('option', { value: '' }, 'Everyone'), ...actors.map((a) => h('option', { value: a, selected: a === state.actor }, a)));
      const result = (s) => h('span', { class: `badge${s < 400 ? '' : ' off'}`, title: s < 400 ? 'Succeeded' : s === 403 ? 'Not allowed for this role' : s === 401 ? 'Not signed in / wrong password' : 'Failed' }, String(s));
      const rows = data.items.map((r) => h('tr', {},
        h('td', { title: when(r.created_at) }, ago(r.created_at)),
        h('td', {}, h('strong', {}, r.actor), r.role ? h('span', { class: 'hint', style: 'margin:0 0 0 6px' }, r.role) : ''),
        h('td', {}, h('span', { class: 'badge count' }, r.method)),
        h('td', { class: 'wrap' }, r.summary && !/^[A-Z]+ \//.test(r.summary) ? `${r.summary} · ${r.path}` : r.path),
        h('td', {}, result(r.status))));
      el.replaceChildren(
        h('div', { class: 'toolbar' },
          h('p', { class: 'hint intro' }, 'Every change made in the dashboard, every sign-in and every refused action. Passwords and form contents are never recorded. Entries are kept for 180 days.'),
          h('label', { class: 'hint', style: 'margin:0;display:flex;gap:8px;align-items:center' }, 'Show', filter)),
        h('div', { class: 'table-wrap' },
          h('table', {}, h('thead', {}, h('tr', {}, ...['When', 'Who', 'Action', 'What', 'Result'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)),
          data.items.length ? '' : h('p', { class: 'empty' }, 'Nothing recorded yet.')),
        h('div', { class: 'toolbar', style: 'margin-top:12px' },
          h('span', { class: 'hint', style: 'margin:0' }, `${data.total} entr${data.total === 1 ? 'y' : 'ies'} · page ${data.page} of ${Math.max(data.pages, 1)}`),
          h('div', {},
            h('button', { class: 'btn-ghost small', type: 'button', disabled: data.page <= 1, onclick: guard(() => go({ page: data.page - 1 })) }, '← Newer'),
            ' ',
            h('button', { class: 'btn-ghost small', type: 'button', disabled: data.page >= data.pages, onclick: guard(() => go({ page: data.page + 1 })) }, 'Older →'))));
    },
  });
})();
