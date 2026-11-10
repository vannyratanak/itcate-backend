// Admin section: Survey Results. Owned by the "analytics" feature (this file only).
// Score = 1-5 from an answer's position in its scale (first option 5 ... last option 1). Questions averaging < 3 are flagged.
(() => {
  if (!document.getElementById('analytics-style')) {
    const st = document.createElement('style'); st.id = 'analytics-style';
    st.textContent = `
      .sr-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 16px; }
      .sr-toolbar .grow { flex: 1; }
      .sr-presets { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
      .sr-presets button { background: transparent; color: var(--text-dim); border: 0; padding: 8px 14px; cursor: pointer; font: inherit; }
      .sr-presets button[aria-pressed="true"] { background: var(--accent); color: #fff; }
      .sr-range { display: flex; gap: 8px; align-items: end; }
      .sr-range label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 2px; }
      .sr-range input { width: auto; padding: 7px 9px; }
      .sr-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
      .sr-big { font-size: 54px; font-weight: 800; line-height: 1; }
      .sr-big small { font-size: 20px; font-weight: 600; color: var(--text-dim); }
      .sr-donut-wrap { display: flex; align-items: center; gap: 18px; }
      .sr-legend { list-style: none; margin: 0; padding: 0; font-size: 13px; }
      .sr-legend li { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
      .sr-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
      .sr-q { padding: 14px 0; border-top: 1px solid var(--border); }
      .sr-q:first-of-type { border-top: 0; }
      .sr-q-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 8px; }
      .sr-q-name { font-weight: 600; }
      .sr-q-name .kh { display: block; font-weight: 400; color: var(--text-dim); font-size: 13px; }
      .sr-avg { font-weight: 700; white-space: nowrap; }
      .sr-q.low { background: rgba(229,72,77,.08); border-radius: 8px; padding: 14px 12px; margin: 0 -12px; border-top-color: transparent; }
      .sr-q.low .sr-avg { color: var(--status-danger-text); }
      .sr-flag { margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(229,72,77,.18); color: var(--status-danger-text); font-weight: 700; }
      .sr-bar { display: flex; height: 26px; border-radius: 7px; overflow: hidden; background: var(--surface-2); }
      .sr-seg { display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #10131a; min-width: 0; overflow: hidden; white-space: nowrap; }
      .sr-scale { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-top: 4px; }
      .sr-ramp { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--text-dim); margin-bottom: 8px; }
    `;
    document.head.append(st);
  }
  const COLORS = ['#2fb67c', '#8fd18b', '#d2d4dc', '#f2a65a', '#e5484d']; // most positive -> most negative
  const ymd = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => ymd(new Date(Date.now() - n * 86400000));
  const NS = 'http://www.w3.org/2000/svg';
  const PRESETS = [7, 30, 90];

  (window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
    id: 'analytics', label: 'Survey Results', group: 'Insights',
    async load(el, kit) {
      const { h, api, apiFetch, notify, guard, API } = kit;
      const state = el._state || (el._state = { preset: 30, from: daysAgo(29), to: daysAgo(0) });
      const body = h('div', {});
      const fromIn = h('input', { type: 'date', value: state.from, 'aria-label': 'From date' });
      const toIn = h('input', { type: 'date', value: state.to, 'aria-label': 'To date' });
      const presetBtns = PRESETS.map((n) => h('button', { type: 'button', 'aria-pressed': String(state.preset === n), onclick: () => {
        Object.assign(state, { preset: n, from: daysAgo(n - 1), to: daysAgo(0) }); render();
      } }, `Last ${n} days`));
      const apply = () => { state.preset = null; state.from = fromIn.value; state.to = toIn.value; render(); };
      const csvBtn = h('button', { class: 'btn-ghost', type: 'button', onclick: guard(async () => {
        const res = await apiFetch(`${API}/analytics/survey.csv?from=${state.from}&to=${state.to}`, { headers: { Authorization: `Bearer ${localStorage.getItem('itacate_admin_token')}` } });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Could not export');
        const url = URL.createObjectURL(await res.blob());
        const a = h('a', { href: url, download: `survey-${state.from}_${state.to}.csv` });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
        notify('CSV downloaded');
      }) }, 'Download CSV');
      el.replaceChildren(
        h('div', { class: 'sr-toolbar' },
          h('div', { class: 'sr-presets', role: 'group', 'aria-label': 'Date range' }, ...presetBtns),
          h('div', { class: 'sr-range' },
            h('div', {}, h('label', {}, 'From'), fromIn), h('div', {}, h('label', {}, 'To'), toIn),
            h('button', { class: 'btn-primary', type: 'button', onclick: apply }, 'Apply')),
          h('div', { class: 'grow' }), csvBtn),
        body);

      const donut = (a, b) => {
        const total = a + b, r = 38, C = 2 * Math.PI * r;
        const ring = (len, off, color) => {
          const c = document.createElementNS(NS, 'circle');
          const attrs = { cx: 50, cy: 50, r, fill: 'none', stroke: color, 'stroke-width': 14, 'stroke-dasharray': `${len} ${C}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 50 50)' };
          for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
          return c;
        };
        const s = document.createElementNS(NS, 'svg');
        for (const [k, v] of Object.entries({ viewBox: '0 0 100 100', width: 110, height: 110, role: 'img', 'aria-label': `${a} returning and ${b} new visitors` })) s.setAttribute(k, v);
        s.append(ring(C, 0, 'var(--surface-2)'));
        if (total) s.append(ring((a / total) * C, 0, 'var(--accent)'), ring((b / total) * C, (a / total) * C, '#2fb67c'));
        return s;
      };

      async function render() {
        presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(state.preset === PRESETS[i])));
        fromIn.value = state.from; toIn.value = state.to;
        body.replaceChildren(h('p', { class: 'hint' }, 'Loading…'));
        let d;
        try { d = await api(`/analytics/survey?from=${state.from}&to=${state.to}`); }
        catch (e) { body.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
        if (!d.total) { body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'empty' }, `No survey responses between ${d.from} and ${d.to}.`))); return; }
        const pctOf = (n) => `${Math.round((n / d.total) * 100)}%`;
        const low = d.questions.filter((q) => q.low);
        const top = h('div', { class: 'sr-top' },
          h('div', { class: 'card' }, h('h3', {}, 'Overall satisfaction'),
            h('div', { class: 'sr-big' }, d.overallAverage === null ? '–' : d.overallAverage.toFixed(1), h('small', {}, ' / 5')),
            h('p', { class: 'hint' }, `${d.total} response${d.total === 1 ? '' : 's'}, ${d.from} to ${d.to}`)),
          h('div', { class: 'card' }, h('h3', {}, 'New vs returning'),
            h('div', { class: 'sr-donut-wrap' }, donut(d.newVsReturning.returning, d.newVsReturning.new),
              h('ul', { class: 'sr-legend' },
                h('li', {}, h('span', { class: 'sr-dot', style: 'background: var(--accent)' }), `Returning: ${d.newVsReturning.returning} (${pctOf(d.newVsReturning.returning)})`),
                h('li', {}, h('span', { class: 'sr-dot', style: 'background: #2fb67c' }), `New: ${d.newVsReturning.new} (${pctOf(d.newVsReturning.new)})`)))),
          h('div', { class: 'card' }, h('h3', {}, 'Needs attention'),
            low.length
              ? h('ul', { class: 'sr-legend' }, ...low.map((q) => h('li', {}, h('span', { class: 'sr-dot', style: 'background: #e5484d' }), `${q.name_en} (${q.average.toFixed(1)})`)))
              : h('p', { class: 'hint' }, `No question averages below ${d.lowThreshold}.`)));
        const rampLabels = ['Most positive answer', '', '', '', 'Most negative answer'];
        const ramp = h('div', { class: 'sr-ramp' }, ...rampLabels.map((t, i) => t ? h('span', {}, h('span', { class: 'sr-dot', style: `background:${COLORS[i]}` }), ' ', t) : ''));
        const qs = h('div', { class: 'card' }, h('h3', {}, 'By question'), ramp,
          ...d.questions.map((q) => {
            const n = q.scale.length;
            const label = q.scale.map((o) => `${o.name_en}: ${o.count} (${o.pct}%)`).join('; ');
            return h('div', { class: `sr-q${q.low ? ' low' : ''}` },
              h('div', { class: 'sr-q-head' },
                h('div', { class: 'sr-q-name' }, q.name_en, q.low ? h('span', { class: 'sr-flag' }, 'LOW') : '', q.name_kh ? h('span', { class: 'kh' }, q.name_kh) : ''),
                h('div', { class: 'sr-avg' }, q.average === null ? 'no answers' : `${q.average.toFixed(1)} / 5`, h('span', { class: 'hint' }, ` · ${q.answered} answers`))),
              h('div', { class: 'sr-bar', role: 'img', 'aria-label': `${q.name_en}. ${label}` },
                ...q.scale.map((o, i) => o.count
                  ? h('div', { class: 'sr-seg', style: `flex: ${o.count}; background: ${COLORS[Math.round(i * 4 / Math.max(n - 1, 1))]}`, title: `${o.name_en}: ${o.count} (${o.pct}%)` }, o.pct >= 9 ? `${Math.round(o.pct)}%` : '')
                  : '')),
              h('div', { class: 'sr-scale' }, h('span', {}, q.scale[0]?.name_en || ''), h('span', {}, q.scale[n - 1]?.name_en || '')));
          }));
        body.replaceChildren(top, qs);
      }
      await render();
    },
  });
})();
