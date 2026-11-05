// Admin section: Messages (inbox for the contact, catering, gift-card and career forms).
// Owned by the "messages" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'messages', label: 'Messages', group: 'Guests',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, when } = kit;
    const KINDS = [['', 'All'], ['contact', 'Contact'], ['catering', 'Catering'], ['gift_card', 'Gift cards'], ['career', 'Careers']];
    const KIND_LABEL = Object.fromEntries(KINDS);
    const STATUSES = [['', 'Any status'], ['new', 'New'], ['read', 'Read'], ['replied', 'Replied'], ['archived', 'Archived']];
    const state = el._state || (el._state = { kind: '', status: '', q: '', page: 1 });

    const chip = (label, active, onclick, count) => h('button', {
      type: 'button', class: `${active ? 'btn-primary' : 'btn-ghost'} small`, 'aria-pressed': String(active), onclick,
    }, label, count ? h('span', { class: 'badge', style: 'margin-left:6px' }, String(count)) : '');

    const toolbar = h('div', { class: 'toolbar' });
    const kindRow = h('div', { class: 'chips' });
    const statusRow = h('div', { class: 'chips' });
    const search = h('input', { class: 'search', type: 'search', placeholder: 'Search name, email, phone, message...', value: state.q, 'aria-label': 'Search messages' });
    const tbody = h('tbody');
    const empty = h('p', { class: 'empty hidden' }, 'No messages here.');
    const pager = h('div', { class: 'toolbar', style: 'margin:12px 0 0' });
    el.replaceChildren(
      h('p', { class: 'hint intro' }, 'Everything sent from the website forms (contact, private dining, gift cards) and job applications.'),
      toolbar, kindRow, h('div', { style: 'height:8px' }), statusRow, h('div', { style: 'height:12px' }),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ...['', 'From', 'Type', 'Message', 'Received', 'Status'].map((t) => h('th', {}, t)))), tbody), empty),
      pager);
    toolbar.replaceChildren(search);

    let unread = { total: 0, byKind: {} };
    const paintNav = () => {
      const a = document.querySelector('.sidebar nav a[data-view="messages"]');
      if (!a) return;
      a.replaceChildren(document.createTextNode('Messages'));
      if (unread.total) a.append(h('span', { class: 'badge', style: 'margin-left:8px' }, String(unread.total)));
    };
    const paintFilters = () => {
      kindRow.replaceChildren(...KINDS.map(([v, l]) => chip(l, state.kind === v, () => { state.kind = v; state.page = 1; refreshG(); }, v ? unread.byKind[v] : unread.total)));
      statusRow.replaceChildren(...STATUSES.map(([v, l]) => chip(l, state.status === v, () => { state.status = v; state.page = 1; refreshG(); })));
    };

    const preview = (s, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s);
    const badgeFor = (st) => h('span', { class: `badge${st === 'new' ? '' : ' off'}` }, st);

    async function refresh() {
      const qs = new URLSearchParams({ page: String(state.page) });
      for (const k of ['kind', 'status', 'q']) if (state[k]) qs.set(k, state[k]);
      const [data, un] = await Promise.all([api(`/messages?${qs}`), api('/messages/unread-count')]);
      unread = un; paintNav(); paintFilters();
      empty.classList.toggle('hidden', data.items.length > 0);
      tbody.replaceChildren(...data.items.map((m) => h('tr', {},
        h('td', {}, m.status === 'new' ? h('span', { class: 'badge', title: 'New' }, '●') : ''),
        h('td', { class: 'wrap' }, h('div', { style: m.status === 'new' ? 'font-weight:700' : '' }, m.name), h('div', { class: 'hint', style: 'margin:0;font-weight:400' }, m.email || m.phone || '')),
        h('td', {}, h('span', { class: 'badge off' }, KIND_LABEL[m.kind] || m.kind)),
        h('td', { class: 'wrap' }, h('a', { class: 'row-link', href: '#messages', onclick: (e) => { e.preventDefault(); guard(open)(m.id); } }, preview(m.subject ? `${m.subject} — ${m.message}` : m.message))),
        h('td', {}, when(m.created_at)),
        h('td', {}, badgeFor(m.status)))));
      pager.replaceChildren(
        h('span', { class: 'hint', style: 'margin:0' }, `${data.total} message${data.total === 1 ? '' : 's'} · page ${data.page} of ${Math.max(data.pages, 1)}`),
        h('div', {},
          h('button', { class: 'btn-ghost small', type: 'button', disabled: data.page <= 1, onclick: () => { state.page--; refreshG(); } }, 'Previous'),
          ' ',
          h('button', { class: 'btn-ghost small', type: 'button', disabled: data.page >= data.pages, onclick: () => { state.page++; refreshG(); } }, 'Next')));
    }
    const refreshG = guard(refresh);

    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); state.page = 1; refreshG(); }, 250); });

    const LABELS = { event_date: 'Event date', guests: 'Guests', event_type: 'Event type', amount: 'Amount', recipient_name: 'Recipient', job_title: 'Job', job_id: 'Job ID' };
    function detail(m) {
      const rows = [['Type', KIND_LABEL[m.kind] || m.kind], ['Name', m.name], ['Email', m.email], ['Phone', m.phone], ['Subject', m.subject]];
      for (const [k, v] of Object.entries(m.data || {})) rows.push([LABELS[k] || k, k === 'amount' ? `$${Number(v).toFixed(2)}` : String(v)]);
      rows.push(['Received', when(m.created_at)], ['Status', m.status]);
      return h('div', {},
        h('dl', { class: 'answers' }, ...rows.filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])),
        h('p', { style: 'margin-top:14px;white-space:pre-wrap' }, m.message));
    }
    async function open(id) {
      const m = await api(`/messages/${id}`); // opening marks a new message as read
      const set = (status) => guard(async () => { await api(`/messages/${id}`, 'PATCH', { status }); closeModal(); notify(`Marked ${status}`); await refresh(); });
      const actions = [cancelBtn()];
      if (m.phone) actions.push(h('a', { class: 'btn-ghost', style: 'text-decoration:none', href: `tel:${m.phone.replace(/\s/g, '')}` }, 'Call'));
      if (m.email) actions.push(h('a', { class: 'btn-primary', style: 'text-decoration:none', href: `mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'your message'))}` }, 'Reply by email'));
      if (m.status !== 'replied') actions.push(h('button', { class: 'btn-ghost', type: 'button', onclick: set('replied') }, 'Mark replied'));
      if (m.status !== 'archived') actions.push(h('button', { class: 'btn-ghost', type: 'button', onclick: set('archived') }, 'Archive'));
      actions.push(h('button', { class: 'btn-ghost danger', type: 'button', onclick: () => confirmModal('Delete message', `Delete the message from ${m.name}? This cannot be undone.`, 'Delete',
        async () => { await api(`/messages/${id}`, 'DELETE'); notify('Message deleted'); await refresh(); }) }, 'Delete'));
      openModal(m.subject || `Message from ${m.name}`, detail(m), actions);
      refreshG(); // the message is now "read": update the list and the unread badge
    }
    await refresh();
  },
});
