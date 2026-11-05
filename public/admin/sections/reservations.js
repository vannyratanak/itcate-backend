// Admin section: Reservations. Owned by the "reservations" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'reservations', label: 'Reservations', group: 'Guests',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, plural } = kit;

    // ---- scoped styles (admin theme variables) ----
    if (!document.getElementById('res-style')) {
      const st = document.createElement('style'); st.id = 'res-style';
      st.textContent = `
      .res-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; align-items: start; }
      @media (max-width: 1100px) { .res-grid { grid-template-columns: 1fr; } }
      .res-side { display: flex; flex-direction: column; gap: 18px; }
      .res-side .card { padding: 18px; }
      .res-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
      .res-toolbar .grow { flex: 1; }
      .res-pill { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; font-weight: 600; }
      .res-pill button { background: none; border: 0; color: inherit; cursor: pointer; font-size: 14px; padding: 0 2px; }
      .res-table td, .res-table th { vertical-align: top; }
      .res-table .ref { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--text-dim); }
      .res-table .sub { color: var(--text-dim); font-size: 12.5px; }
      .res-table .note { max-width: 220px; white-space: normal; color: var(--text-dim); font-size: 12.5px; }
      .res-st { padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: capitalize; display: inline-block; }
      .res-st.pending { background: rgba(245, 158, 11, .16); color: #d97706; }
      .res-st.confirmed { background: rgba(16, 185, 129, .16); color: var(--status-success-text); }
      .res-st.declined { background: rgba(229, 72, 77, .14); color: var(--status-danger-text); }
      .res-st.cancelled { background: var(--surface-2); color: var(--text-dim); }
      .res-act { display: flex; gap: 6px; flex-wrap: wrap; }
      .res-act button { padding: 5px 10px; font-size: 12.5px; }
      .res-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .res-cal-head b { font-size: 15px; }
      .res-cal-head button { padding: 4px 10px; }
      .res-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .res-cal .dow { text-align: center; font-size: 11px; color: var(--text-dim); padding: 2px 0 4px; letter-spacing: .04em; text-transform: uppercase; }
      .res-day { position: relative; aspect-ratio: 1 / 1; border: 1px solid transparent; border-radius: 8px; background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; padding: 0; }
      .res-day:hover { border-color: var(--accent); }
      .res-day.out { background: transparent; cursor: default; }
      .res-day.today { border-color: var(--accent); }
      .res-day.sel { background: var(--accent); color: #fff; }
      .res-day.blocked { background: repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, transparent 4px, transparent 8px); color: var(--text-dim); }
      .res-day .n { font-size: 10.5px; font-weight: 700; line-height: 1; margin-top: 2px; color: var(--accent); }
      .res-day.sel .n { color: #fff; }
      .res-day .dot { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
      .res-blocked li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); list-style: none; }
      .res-blocked { padding: 0; margin: 10px 0 0; }
      .res-blocked li:last-child { border-bottom: 0; }
      .res-block-form { display: grid; gap: 8px; margin-top: 8px; }
      .res-detail dl { display: grid; grid-template-columns: 110px 1fr; gap: 6px 12px; margin: 0 0 14px; }
      .res-detail dt { color: var(--text-dim); } .res-detail dd { margin: 0; word-break: break-word; }
      `;
      document.head.append(st);
    }

    // ---- helpers ----
    const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    const monthOf = (d) => d.slice(0, 7);
    const shiftMonth = (m, by) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };
    const niceDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const monthTitle = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const state = el._res || (el._res = { tab: 'today', day: null, month: monthOf(todayStr()) });
    let items = [], pending = 0, total = 0, calendar = [], blocked = [];

    function query() {
      const t = todayStr(); const q = new URLSearchParams({ limit: '200' });
      if (state.day) { q.set('from', state.day); q.set('to', state.day); }
      else if (state.tab === 'today') { q.set('from', t); q.set('to', t); }
      else if (state.tab === 'upcoming') q.set('from', t);
      else if (state.tab === 'pending') q.set('status', 'pending');
      return q.toString();
    }

    async function refresh() {
      const [list, cal, blk] = await Promise.all([
        api(`/reservations?${query()}`), api(`/reservations/calendar?month=${state.month}`), api('/reservations/blocked'),
      ]);
      ({ items, pending, total } = list); calendar = cal; blocked = blk;
      render();
    }

    async function setStatus(r, status, note) {
      const body = { status }; if (note !== undefined) body.admin_note = note;
      await api(`/reservations/${r.id}`, 'PATCH', body);
      notify(`${r.reference} ${status}`); await refresh();
    }

    function statusButtons(r, small = true) {
      const b = (label, status, cls = 'btn-ghost') => h('button', { class: cls, type: 'button', onclick: guard(() => setStatus(r, status)) }, label);
      if (r.status === 'pending') return [b('Confirm', 'confirmed', 'btn-primary'), b('Decline', 'declined')];
      if (r.status === 'confirmed') return [b('Cancel', 'cancelled'), b('Decline', 'declined')];
      return [b('Re-open', 'pending')];
    }

    function detail(r) {
      const note = h('textarea', { id: 'res-note', rows: 3, maxlength: 500, placeholder: 'Internal note (not shown to the guest)' }, r.admin_note ?? '');
      note.value = r.admin_note ?? '';
      const body = h('div', { class: 'res-detail' },
        h('dl', {},
          h('dt', {}, 'Reference'), h('dd', {}, r.reference),
          h('dt', {}, 'Guest'), h('dd', {}, r.name),
          h('dt', {}, 'Phone'), h('dd', {}, h('a', { class: 'link', href: `tel:${r.phone}` }, r.phone)),
          h('dt', {}, 'Email'), h('dd', {}, r.email ? h('a', { class: 'link', href: `mailto:${r.email}` }, r.email) : '—'),
          h('dt', {}, 'When'), h('dd', {}, `${niceDate(r.date)} at ${r.time}`),
          h('dt', {}, 'Party'), h('dd', {}, plural(r.party_size, 'guest')),
          h('dt', {}, 'Status'), h('dd', {}, h('span', { class: `res-st ${r.status}` }, r.status)),
          h('dt', {}, 'Guest notes'), h('dd', {}, r.notes || '—'),
          h('dt', {}, 'Received'), h('dd', {}, new Date(r.created_at).toLocaleString())),
        h('label', { for: 'res-note' }, 'Admin note'), note);
      const saveNote = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        await api(`/reservations/${r.id}`, 'PATCH', { admin_note: note.value }); closeModal(); notify('Note saved'); await refresh();
      }) }, 'Save note');
      const del = h('button', { class: 'btn-ghost danger', type: 'button', onclick: () => confirmModal('Delete reservation', `Delete ${r.reference} for ${r.name}? This cannot be undone.`, 'Delete', async () => {
        await api(`/reservations/${r.id}`, 'DELETE'); notify('Reservation deleted'); await refresh();
      }) }, 'Delete');
      openModal(`Reservation ${r.reference}`, body, [del, cancelBtn(), saveNote]);
    }

    // ---- rendering ----
    function renderTable() {
      if (!items.length) return h('p', { class: 'empty' }, state.day ? `No reservations on ${niceDate(state.day)}.` : 'No reservations here yet.');
      return h('div', { class: 'table-wrap' }, h('table', { class: 'res-table' },
        h('thead', {}, h('tr', {}, ...['Guest', 'When', 'Party', 'Status', 'Notes', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...items.map((r) => h('tr', {},
          h('td', {}, h('div', {}, h('strong', {}, r.name)), h('div', { class: 'sub' }, h('a', { class: 'link', href: `tel:${r.phone}` }, r.phone)), h('div', { class: 'ref' }, r.reference)),
          h('td', {}, h('div', {}, niceDate(r.date)), h('div', { class: 'sub' }, r.time)),
          h('td', {}, String(r.party_size)),
          h('td', {}, h('span', { class: `res-st ${r.status}` }, r.status)),
          h('td', { class: 'note' }, [r.notes, r.admin_note ? `Admin: ${r.admin_note}` : ''].filter(Boolean).join(' · ')),
          h('td', {}, h('div', { class: 'res-act' }, ...statusButtons(r), h('button', { class: 'btn-ghost', type: 'button', onclick: () => detail(r) }, 'Details'))))))));
    }

    function renderCalendar() {
      const byDate = new Map(calendar.map((d) => [d.date, d]));
      const first = new Date(`${state.month}-01T00:00:00Z`);
      const offset = (first.getUTCDay() + 6) % 7; // Monday first
      const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const t = todayStr();
      const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => h('div', { class: 'dow' }, d));
      for (let i = 0; i < offset; i++) cells.push(h('div', { class: 'res-day out' }));
      for (let d = 1; d <= days; d++) {
        const ds = `${state.month}-${String(d).padStart(2, '0')}`;
        const info = byDate.get(ds);
        cells.push(h('button', {
          type: 'button', class: ['res-day', ds === t ? 'today' : '', state.day === ds ? 'sel' : '', info?.blocked ? 'blocked' : ''].join(' ').trim(),
          title: info ? `${plural(info.count, 'booking')} · ${plural(info.guests, 'guest')}${info.blocked ? ' · blocked' : ''}` : 'No bookings',
          onclick: guard(async () => { state.day = state.day === ds ? null : ds; await refresh(); }),
        }, String(d), info?.count ? h('span', { class: 'n' }, String(info.count)) : '', info?.pending ? h('span', { class: 'dot' }) : ''));
      }
      return h('div', { class: 'card' },
        h('div', { class: 'res-cal-head' },
          h('button', { class: 'btn-ghost', type: 'button', 'aria-label': 'Previous month', onclick: guard(async () => { state.month = shiftMonth(state.month, -1); await refresh(); }) }, '‹'),
          h('b', {}, monthTitle(state.month)),
          h('button', { class: 'btn-ghost', type: 'button', 'aria-label': 'Next month', onclick: guard(async () => { state.month = shiftMonth(state.month, 1); await refresh(); }) }, '›')),
        h('div', { class: 'res-cal' }, ...cells),
        h('p', { class: 'hint', style: 'margin:10px 0 0;font-size:12px' }, 'Number = bookings, orange dot = pending, striped = blocked. Click a day to filter.'));
    }

    function renderBlocked() {
      const date = h('input', { type: 'date', id: 'res-bd', min: todayStr() });
      const reason = h('input', { type: 'text', id: 'res-br', maxlength: 200, placeholder: 'Reason (optional), e.g. Private event' });
      const add = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        if (!date.value) { notify('Pick a date to block', false); return; }
        await api('/reservations/blocked', 'POST', { date: date.value, reason: reason.value }); notify('Date blocked'); await refresh();
      }) }, 'Block date');
      return h('div', { class: 'card' },
        h('h3', {}, 'Blocked dates'),
        h('p', { class: 'hint', style: 'margin:2px 0 8px' }, 'Guests cannot book these days (holidays, private events).'),
        h('div', { class: 'res-block-form' }, date, reason, add),
        blocked.length
          ? h('ul', { class: 'res-blocked' }, ...blocked.map((b) => h('li', {},
            h('span', {}, h('strong', {}, niceDate(b.date)), b.reason ? h('div', { class: 'sub hint', style: 'margin:0' }, b.reason) : ''),
            h('button', { class: 'btn-ghost small', type: 'button', onclick: guard(async () => { await api(`/reservations/blocked/${b.id}`, 'DELETE'); notify('Date unblocked'); await refresh(); }) }, 'Unblock'))))
          : h('p', { class: 'hint', style: 'margin:12px 0 0' }, 'No upcoming blocked dates.'));
    }

    function render() {
      const tabs = [['today', 'Today'], ['upcoming', 'Upcoming'], ['pending', 'Pending'], ['all', 'All']];
      const seg = h('div', { class: 'seg', role: 'tablist' }, ...tabs.map(([k, l]) => h('button', {
        type: 'button', class: !state.day && state.tab === k ? 'on' : '', role: 'tab',
        onclick: guard(async () => { state.tab = k; state.day = null; await refresh(); }),
      }, k === 'pending' && pending ? `${l} (${pending})` : l)));
      const toolbar = h('div', { class: 'res-toolbar' }, seg,
        state.day ? h('span', { class: 'res-pill' }, niceDate(state.day), h('button', { type: 'button', 'aria-label': 'Clear day filter', onclick: guard(async () => { state.day = null; await refresh(); }) }, '×')) : '',
        h('span', { class: 'grow' }),
        h('span', { class: 'hint', style: 'margin:0' }, plural(total, 'reservation')),
        h('button', { class: 'btn-ghost', type: 'button', onclick: guard(refresh) }, 'Refresh'));
      el.replaceChildren(h('div', { class: 'res-grid' }, h('div', {}, toolbar, renderTable()), h('div', { class: 'res-side' }, renderCalendar(), renderBlocked())));
      // pending counter in the page title and sidebar link
      const title = document.getElementById('view-title');
      if (title) title.textContent = pending ? `Reservations (${pending} pending)` : 'Reservations';
      const link = document.querySelector('.sidebar nav a[data-view="reservations"]');
      if (link) link.textContent = pending ? `Reservations · ${pending}` : 'Reservations';
    }

    await refresh();
  },
});
