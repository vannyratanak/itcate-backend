// Itacate admin dashboard: a static page that talks to the backend's JSON API with a JWT.
(() => {
  // Local dev: the page and the API share the backend's origin. In production nginx serves the API at /api/ on the same host.
  const API = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : '/api';
  const $ = (id) => document.getElementById(id);

  // Build DOM with textContent only: survey answers are user-submitted, never inject them as HTML.
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) el.append(kid instanceof Node ? kid : document.createTextNode(kid ?? ''));
    return el;
  };

  let token = localStorage.getItem('itacate_admin_token');
  let pageEditor = null, shop = null, menu = [], surveys = [], groups = [], categories = [];

  async function api(path, method = 'GET', body, isForm) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body && !isForm) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { signOut(); throw new Error('Session expired, please sign in again'); }
    if (!res.ok) throw new Error([].concat(data.message || res.statusText).join(', '));
    return data;
  }

  function notify(msg, ok = true) {
    const b = $('banner');
    b.className = ok ? 'success' : 'error';
    b.textContent = msg;
    clearTimeout(notify.t);
    notify.t = setTimeout(() => b.classList.add('hidden'), 3500);
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { notify(e.message, false); } };

  const imgUrl = (u) => (u ? (/^https?:/.test(u) ? u : API + u) : null);
  const money = (n) => `$${Number(n).toFixed(2)}`;
  const when = (d) => new Date(d).toLocaleString();

  // ---------- Auth ----------
  function showAuth() { $('app').classList.add('hidden'); $('auth').classList.remove('hidden'); }
  function signOut() { token = null; localStorage.removeItem('itacate_admin_token'); showAuth(); }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('auth-error').classList.add('hidden');
    try {
      const d = await api('/auth/login', 'POST', { username: $('username').value, password: $('password').value });
      token = d.token;
      localStorage.setItem('itacate_admin_token', token);
      $('password').value = '';
      start();
    } catch (err) {
      $('auth-error').textContent = err.message;
      $('auth-error').classList.remove('hidden');
    }
  });
  $('logout-btn').addEventListener('click', signOut);

  // ---------- Theme / sidebar ----------
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('itacate_admin_theme', t);
    $('theme-btn').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  }
  setTheme(localStorage.getItem('itacate_admin_theme') || 'dark');
  $('theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  const toggleSidebar = (open) => { $('sidebar').classList.toggle('open', open); $('backdrop').classList.toggle('open', open); };
  $('toggle-btn').addEventListener('click', () => toggleSidebar(!$('sidebar').classList.contains('open')));
  $('backdrop').addEventListener('click', () => toggleSidebar(false));

  // ---------- Modal ----------
  function openModal(title, body, actions) {
    $('modal-title').textContent = title;
    $('modal-body').replaceChildren(body);
    $('modal-actions').replaceChildren(...actions);
    $('modal').classList.remove('hidden');
    $('modal-body').querySelectorAll('select').forEach(enhanceSelect); // themed dropdown, same look in every browser
  }
  const closeModal = () => $('modal').classList.add('hidden');
  $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal')) closeModal(); });
  // Escape closes an open dropdown first (it calls preventDefault); only then the dialog.
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.defaultPrevented) closeModal(); });
  const cancelBtn = () => h('button', { class: 'btn-ghost', type: 'button', onclick: closeModal }, 'Cancel');

  function confirmModal(title, text, label, onYes) {
    openModal(title, h('p', {}, text), [cancelBtn(), h('button', { class: 'btn-danger', type: 'button', onclick: guard(async () => { await onYes(); closeModal(); }) }, label)]);
  }

  // ---------- Views ----------
  const TITLES = { overview: 'Overview', shop: 'Shop', pages: 'Pages', editor: 'Edit page', menu: 'Menu', categories: 'Categories', settings: 'Survey Settings', records: 'Survey Records' };

  // ---------- Plug-in sections (public/admin/sections/*.js push into window.ADMIN_SECTIONS) ----------
  // A section is { id, label, group?, async load(container, kit) }. admin.js creates its nav link, <section> and route.
  // `kit` gives sections the same helpers the built-in screens use.
  // Plug-in sections (public/admin/sections/*.js push { id, label, group?, load(container, kit) } into window.ADMIN_SECTIONS).

  // ---------- Header text, "View on site" links and sidebar icons ----------
  const SITE = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3000' : '';
  const PAGE_INFO = {
    overview: ['A quick look at how your restaurant is doing.'],
    shop: ['Your restaurant name, tagline and logo.', '/'],
    'hours-contact': ['Phone, address, social links and opening hours.', '/contact'],
    pages: ['Build your own pages with drag and drop.', '/'],
    blog: ['News and stories for your Blog page.', '/blog'],
    gallery: ['Photos shown on your Gallery page.', '/gallery'],
    faq: ['Questions and answers your guests see.', '/faq'],
    offers: ['Promotions and events. They hide themselves when they end.', '/offers'],
    menu: ['Your dishes, prices and photos.', '/menu'],
    categories: ['Menu sections and the order they appear in.', '/menu'],
    reservations: ['Table bookings that guests make on your website.', '/reservations'],
    messages: ['Everything sent from your contact, catering, gift card and job forms.', '/contact'],
    careers: ['Open positions shown on your Careers page.', '/careers'],
    settings: ['The survey questions and answer choices.', '/survey'],
    records: ['Every survey response, one by one.'],
    analytics: ['Scores and trends from your survey responses.'],
    reviews: ['Choose which survey comments are shown to the public.', '/reviews'],
    staff: ['Staff logins and what each person is allowed to do.'],
    activity: ['Who changed what, and every sign-in.'],
    editor: ['Design this page, then publish it.'],
  };
  function updateHeader(view) {
    const info = PAGE_INFO[view] || [];
    $('view-sub').textContent = info[0] || '';
    const link = $('view-site');
    link.classList.toggle('hidden', !info[1]);
    if (info[1]) link.href = SITE + info[1];
    $('site-link').href = SITE + '/';
  }
  const ICONS = {
    overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    shop: 'M3 9l1-5h16l1 5 M4 9v11h16V9 M9 20v-6h6v6',
    'hours-contact': 'M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z',
    pages: 'M6 3h9l4 4v14H6z M14 3v5h5',
    blog: 'M4 20h4L19 9l-4-4L4 16z',
    gallery: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M8.5 9.5h.01',
    faq: 'M12 21a9 9 0 100-18 9 9 0 000 18z M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 3.5 M12 17h.01',
    offers: 'M3 12l9-9h8v8l-9 9z M16 8h.01',
    menu: 'M5 3v8a3 3 0 003 3v7 M8 3v6 M19 3c-2 2-3 5-3 8h3v10',
    categories: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    reservations: 'M4 5h16v16H4z M4 10h16 M9 3v4 M15 3v4',
    messages: 'M3 5h18v14H3z M3 7l9 6 9-6',
    careers: 'M3 8h18v12H3z M9 8V5h6v3',
    settings: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M14 4v4 M8 10v4 M16 16v4',
    records: 'M8 4h8v3H8z M6 5h12v16H6z M9 12h6 M9 16h6',
    analytics: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
    reviews: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
    staff: 'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2 M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M21 20v-2a4 4 0 00-3-3.9 M16 3.1a3.5 3.5 0 010 6.8',
    activity: 'M3 12a9 9 0 109-9 M3 4v5h5 M12 7v5l3 2',
  };
  function addNavIcons() {
    const NS = 'http://www.w3.org/2000/svg';
    document.querySelectorAll('.sidebar nav a[data-view]').forEach((a) => {
      const d = ICONS[a.dataset.view]; if (!d || a.querySelector('.nav-ico')) return;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'nav-ico'); svg.setAttribute('aria-hidden', 'true');
      for (const seg of d.split(' M')) { const path = document.createElementNS(NS, 'path'); path.setAttribute('d', (seg.startsWith('M') ? '' : 'M') + seg); svg.append(path); }
      a.prepend(svg);
    });
  }
  let pluginsReady = false;
  function initPlugins() {
    if (pluginsReady) return; pluginsReady = true;
    const SECTION_KIT = { api, h, $, notify, guard, openModal, closeModal, confirmModal, cancelBtn, sortable, saveOrder, grip, plural, imgUrl, money, when, API };
    for (const sec of window.ADMIN_SECTIONS || []) {
      TITLES[sec.id] = sec.label;
      const el = h('section', { id: `view-${sec.id}`, class: 'view hidden' });
      document.querySelector('main.content').append(el);
      document.querySelector('.sidebar nav').append(h('a', { href: `#${sec.id}`, 'data-view': sec.id }, sec.label));
      LOAD_PLUGINS[sec.id] = () => sec.load(el, SECTION_KIT);
    }

    // One sidebar layout for every tab, built-in or plug-in. Unknown ids go to the end.
    const NAV_LAYOUT = [
      { items: ['overview'] },
      { group: 'Website', items: ['shop', 'hours-contact', 'pages', 'blog', 'gallery', 'faq', 'offers'] },
      { group: 'Menu', items: ['menu', 'categories'] },
      { group: 'Guests', items: ['reservations', 'messages', 'careers'] },
      { group: 'Surveys', items: ['settings', 'records', 'analytics', 'reviews'] },
      { group: 'Admin', items: ['staff', 'activity'] },
    ];
    const nav = document.querySelector('.sidebar nav');
    const links = new Map([...nav.querySelectorAll('a[data-view]')].map((a) => [a.dataset.view, a]));
    nav.replaceChildren();
    for (const g of NAV_LAYOUT) {
      const found = g.items.filter((v) => links.has(v));
      if (!found.length) continue;
      if (!g.group) { for (const v of found) { nav.append(links.get(v)); links.delete(v); } continue; }
      // A foldable group: heading button + the list of tabs. Open/closed is remembered; the group of the current tab opens itself.
      const box = h('div', { class: 'nav-items', 'data-group': g.group });
      for (const v of found) { box.append(links.get(v)); links.delete(v); }
      const head = h('button', { class: 'nav-group', type: 'button', 'data-group': g.group, 'aria-expanded': 'false' }, h('span', {}, g.group), h('span', { class: 'chev', 'aria-hidden': 'true' }, '▾'));
      head.addEventListener('click', () => setGroupOpen(g.group, box.hidden));
      nav.append(head, box);
    }
    for (const a of links.values()) nav.append(a);
    addNavIcons();
    // Sections rewrite their own link (unread / pending badges); put the icon back whenever that happens.
    new MutationObserver(() => addNavIcons()).observe(nav, { childList: true, subtree: true });
    const saved = (() => { try { return JSON.parse(localStorage.getItem('itacate_admin_nav') || '[]'); } catch { return []; } })();
    for (const g of NAV_LAYOUT) if (g.group) setGroupOpen(g.group, saved.includes(g.group), false);
  }
  function setGroupOpen(group, open, remember = true) {
    const box = document.querySelector(`.nav-items[data-group="${group}"]`);
    const head = document.querySelector(`.nav-group[data-group="${group}"]`);
    if (!box || !head) return;
    box.hidden = !open;
    head.setAttribute('aria-expanded', String(open));
    if (!remember) return;
    try {
      const now = new Set(JSON.parse(localStorage.getItem('itacate_admin_nav') || '[]'));
      open ? now.add(group) : now.delete(group);
      localStorage.setItem('itacate_admin_nav', JSON.stringify([...now]));
    } catch { /* storage unavailable: folding still works for this visit */ }
  }
  function openGroupOf(view) {
    const box = document.querySelector(`.sidebar nav a[data-view="${view}"]`)?.closest('.nav-items');
    if (box && box.hidden) setGroupOpen(box.dataset.group, true, false);
  }
  async function route() {
    initPlugins();
    let [view, arg] = location.hash.slice(1).split('/');
    if (view === 'surveys') view = 'records'; // old bookmark
    if (!TITLES[view] || view === 'editor') view = 'overview';
    if (view === 'pages' && arg) view = 'editor'; // #pages/<slug> opens the page builder
    // Leaving the page builder with unsaved changes: ask first.
    if (pageEditor && view !== 'editor' && pageEditor.dirty) {
      history.replaceState(null, '', `#pages/${pageEditor.slug}`);
      confirmModal('Leave without saving?', 'You have unsaved changes on this page. If you leave now they will be lost.', 'Leave',
        async () => { pageEditor.dirty = false; location.hash = view === 'pages' ? '#pages' : `#${view}`; });
      return;
    }
    if (view !== 'editor') closePageEditor();
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${view}`));
    document.querySelectorAll('.sidebar nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === (view === 'editor' ? 'pages' : view)));
    openGroupOf(view === 'editor' ? 'pages' : view);
    document.querySelector('main.content').classList.toggle('editing', view === 'editor');
    $('view-title').textContent = TITLES[view];
    updateHeader(view);
    toggleSidebar(false);
    await guard(LOAD[view] || LOAD_PLUGINS[view])(arg);
  }

  function applyBrand() {
    $('brand-name').textContent = shop.name;
    const logo = $('brand-logo');
    if (shop.logo_url) { logo.src = imgUrl(shop.logo_url); logo.classList.remove('hidden'); } else logo.classList.add('hidden');
    document.title = `${shop.name} Admin`;
  }

  const LOAD_PLUGINS = {};
  const LOAD = {
    async overview() {
      const [shopData, o] = await Promise.all([api('/shop'), api('/analytics/overview')]);
      shop = shopData;
      applyBrand();
      const NS = 'http://www.w3.org/2000/svg';
      const svg = (tag, attrs = {}, ...kids) => {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        el.append(...kids);
        return el;
      };
      // ---- stat cards ----
      const trend = (cur, prev) => {
        if (!cur && !prev) return h('div', { class: 'trend flat' }, 'No responses in the last 14 days');
        if (!prev) return h('div', { class: 'trend up' }, `▲ ${cur} new this week`);
        const pct = Math.round(((cur - prev) / prev) * 100);
        const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
        return h('div', { class: `trend ${cls}` }, `${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct)}% vs previous 7 days (${cur} vs ${prev})`);
      };
      const stat = (n, l, extra, href) => h(href ? 'a' : 'div', { class: `stat${href ? ' stat-link' : ''}`, ...(href ? { href } : {}) },
        h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, l), extra || '');
      const s = o.surveys;
      $('stats').replaceChildren(
        stat(s.total, 'Survey responses', trend(s.last7, s.prev7), '#records'),
        stat(s.avgScore === null ? '–' : `${s.avgScore.toFixed(1)} / 5`, 'Average satisfaction', h('div', { class: 'trend flat' }, 'All questions, all time'), '#analytics'),
        stat(o.reservationsToday, "Today's reservations", h('div', { class: `trend ${o.reservationsPending ? 'down' : 'flat'}` }, `${o.reservationsPending} awaiting confirmation`), '#reservations'),
        stat(o.unreadMessages, 'Unread messages', h('div', { class: 'trend flat' }, o.unreadMessages ? 'Open the inbox' : 'All caught up'), '#messages'),
        stat(o.menu.active, 'Menu items visible', h('div', { class: 'trend flat' }, `${o.menu.hidden} hidden`), '#menu'),
      );
      // ---- 30-day bar chart (inline SVG, themed with the dashboard variables) ----
      const days = o.perDay, W = 720, H = 190, ml = 30, mb = 24, mt = 10;
      const total = days.reduce((a, d) => a + d.count, 0);
      const peak = days.reduce((a, d) => (d.count > a.count ? d : a), days[0] || { count: 0, date: '' });
      const max = Math.max(2, Math.ceil(Math.max(...days.map((d) => d.count), 0) / 2) * 2);
      const plotH = H - mt - mb, slot = (W - ml) / days.length, bw = Math.max(3, slot * 0.68);
      const summary = total
        ? `Survey responses per day, last ${days.length} days: ${total} in total. Busiest day ${peak.date} with ${peak.count}.`
        : `No survey responses in the last ${days.length} days.`;
      const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ov-svg', role: 'img', 'aria-label': summary },
        svg('title', {}, summary),
        ...[0, 0.5, 1].map((f) => svg('g', {},
          svg('line', { x1: ml, x2: W, y1: mt + plotH * (1 - f), y2: mt + plotH * (1 - f), class: 'ov-grid-line' }),
          svg('text', { x: ml - 6, y: mt + plotH * (1 - f) + 4, class: 'ov-axis', 'text-anchor': 'end' }, String(Math.round(max * f))))),
        ...days.map((d, i) => {
          const bh = (d.count / max) * plotH;
          return svg('rect', { x: ml + i * slot + (slot - bw) / 2, y: mt + plotH - bh, width: bw, height: Math.max(bh, d.count ? 2 : 0), rx: 2, class: 'ov-bar' },
            svg('title', {}, `${d.date}: ${d.count} response${d.count === 1 ? '' : 's'}`));
        }),
        ...days.map((d, i) => (i % 5 === 0 || i === days.length - 1)
          ? svg('text', { x: i === days.length - 1 ? W - 2 : ml + i * slot + slot / 2, y: H - 6, class: 'ov-axis', 'text-anchor': i === days.length - 1 ? 'end' : 'middle' }, d.date.slice(5)) : ''));
      $('ov-chart').replaceChildren(chart, h('p', { class: 'hint ov-summary' }, summary));
      // ---- latest responses ----
      const latest = o.latest;
      $('overview-latest').replaceChildren(latest.length
        ? h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, latest.map((r) => h('tr', {},
            h('td', {}, r.name), h('td', {}, r.phoneNumber),
            h('td', {}, h('span', { class: 'badge count' }, r.usedToVisit ? 'Returning' : 'New')),
            h('td', {}, when(r.created_at)))))))
        : h('p', { class: 'empty' }, 'No survey responses yet.'));
    },

    async shop() {
      shop = await api('/shop');
      applyBrand();
      $('shop-name').value = shop.name;
      $('shop-title').value = shop.title;
      mountLogoPicker();
    },

    async menu() {
      [menu, categories] = await Promise.all([api('/menu/all'), api('/menu/categories')]);
      renderMenu();
    },

    async categories() {
      categories = await api('/menu/categories');
      renderCategories();
    },

    async settings() {
      groups = await api('/surveys/field');
      renderQuestions();
    },

    async records() {
      surveys = await api('/surveys');
      renderSurveys();
    },
  };

  // ---------- Image picker (drop a file or click; used for the logo and menu photos) ----------
  const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const MAX_IMG = 3 * 1024 * 1024;
  // A file dropped outside a picker would make the browser navigate away to it.
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault(); });

  function imagePicker({ url, onChange, removeLabel = 'Remove' }) {
    let current = url ?? null, busyPreview = null;
    const input = h('input', { type: 'file', accept: IMG_TYPES.join(','), class: 'hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const root = h('div', { class: 'dropzone', role: 'button', tabindex: '0', 'aria-label': 'Choose an image' });
    const browse = () => { if (!root.classList.contains('busy')) input.click(); };

    function render() {
      root.classList.toggle('busy', !!busyPreview);
      root.classList.toggle('filled', !!(current || busyPreview));
      const src = busyPreview || (current ? imgUrl(current) : null);
      if (!src) {
        root.replaceChildren(input,
          h('div', { class: 'dz-icon', 'aria-hidden': 'true' }, '🖼'),
          h('div', { class: 'dz-title' }, 'Drop an image here, or click to browse'),
          h('div', { class: 'dz-hint' }, 'PNG, JPG, WEBP or GIF · up to 3 MB'));
        return;
      }
      root.replaceChildren(input,
        h('div', { class: 'dz-preview' }, h('img', { src, alt: '' })),
        h('div', { class: 'dz-side' },
          h('div', { class: 'dz-title' }, busyPreview ? 'Uploading…' : 'Image added'),
          h('div', { class: 'dz-hint' }, busyPreview ? 'Please wait' : 'Drop another file to replace it'),
          busyPreview ? '' : h('div', { class: 'dz-actions' },
            h('button', { class: 'btn-ghost small', type: 'button', onclick: (e) => { e.stopPropagation(); browse(); } }, 'Replace'),
            h('button', { class: 'btn-ghost small danger', type: 'button', onclick: (e) => { e.stopPropagation(); change(null); } }, removeLabel))));
    }

    async function change(next) {
      const prev = current;
      current = next; render();
      try { await onChange(next); }
      catch (e) { current = prev; render(); notify(e.message, false); }
    }

    async function pick(file) {
      if (!file) return;
      if (!IMG_TYPES.includes(file.type)) return notify('Only PNG, JPG, WEBP or GIF images are allowed', false);
      if (file.size > MAX_IMG) return notify(`That image is ${(file.size / 1048576).toFixed(1)} MB, the limit is 3 MB`, false);
      busyPreview = URL.createObjectURL(file); render();
      try {
        const fd = new FormData(); fd.append('file', file);
        const { url: uploaded } = await api('/uploads', 'POST', fd, true);
        URL.revokeObjectURL(busyPreview); busyPreview = null;
        await change(uploaded);
      } catch (e) {
        URL.revokeObjectURL(busyPreview); busyPreview = null; render();
        notify(e.message, false);
      }
    }

    root.addEventListener('click', browse);
    root.addEventListener('keydown', (e) => { if (e.target === root && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); browse(); } });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', () => { pick(input.files[0]); input.value = ''; });
    root.addEventListener('dragenter', (e) => { e.preventDefault(); root.classList.add('over'); });
    root.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; root.classList.add('over'); });
    root.addEventListener('dragleave', (e) => { if (!root.contains(e.relatedTarget)) root.classList.remove('over'); });
    root.addEventListener('drop', (e) => { e.preventDefault(); root.classList.remove('over'); if (!busyPreview) pick(e.dataTransfer.files[0]); });
    render();
    return root;
  }

  // ---------- Shop ----------
  function mountLogoPicker() {
    $('shop-logo-picker').replaceChildren(imagePicker({
      url: shop.logo_url,
      removeLabel: 'Remove logo',
      onChange: async (url) => {
        shop = await api('/shop', 'PUT', { logo_url: url });
        applyBrand();
        notify(url ? 'Logo updated' : 'Logo removed');
      },
    }));
  }
  $('shop-form').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    shop = await api('/shop', 'PUT', { name: $('shop-name').value, title: $('shop-title').value });
    applyBrand();
    notify('Shop saved');
  }));
  // ---------- Menu ----------
  // Shown/Hidden as an on/off switch: click it, press Space, or drag the knob left/right. Saves straight away.
  function statusCell(m) {
    const TRAVEL = 20; // knob travel in px (track 46 - knob 20 - 2*3 padding)
    const knob = h('span', { class: 'knob' });
    const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-label': `Show "${m.name_en}" on the menu`}, knob);
    const paint = () => {
      sw.setAttribute('aria-checked', String(m.active));
      sw.classList.toggle('on', m.active);
      sw.title = m.active ? 'Visible on the menu' : 'Hidden from the menu';
      knob.style.transform = '';
    };
    paint();

    async function set(active) {
      if (active === m.active) return paint();
      const prev = m.active;
      m.active = active; paint();                       // optimistic
      try {
        await api(`/menu/${m.id}`, 'PATCH', { active });
        notify(active ? `"${m.name_en}" is now visible on the menu` : `"${m.name_en}" is now hidden from the menu`);
      } catch (e) { m.active = prev; paint(); notify(e.message, false); }
    }

    // Pointer drag: follow the finger/mouse, then snap to whichever side the knob is closer to.
    let startX = 0, base = 0, dragging = false, moved = false;
    sw.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      startX = e.clientX; base = m.active ? TRAVEL : 0; dragging = true; moved = false;
      sw.setPointerCapture(e.pointerId);
    });
    sw.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true; sw.classList.add('dragging');
      knob.style.transform = `translateX(${Math.max(0, Math.min(TRAVEL, base + dx))}px)`;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false; sw.classList.remove('dragging');
      if (moved) { set(Math.max(0, Math.min(TRAVEL, base + e.clientX - startX)) > TRAVEL / 2); sw._justDragged = true; }
    };
    sw.addEventListener('pointerup', end);
    sw.addEventListener('pointercancel', () => { dragging = false; sw.classList.remove('dragging'); paint(); });
    sw.addEventListener('click', () => { if (sw._justDragged) { sw._justDragged = false; return; } set(!m.active); });
    sw.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); set(true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(false); }
    });
    return h('td', {}, h('div', { class: 'switch-wrap' }, sw));
  }

  function renderMenu() {
    const q = $('menu-search').value.trim().toLowerCase();
    const rows = menu.filter((m) => !q || [m.name_en, m.name_kh, m.category].some((v) => (v || '').toLowerCase().includes(q)));
    $('menu-empty').classList.toggle('hidden', rows.length > 0);
    $('menu-table').classList.toggle('filtered', !!q);
    const out = [];
    let lastCat = null;
    for (const m of rows) {
      if (m.category_id !== lastCat) {
        lastCat = m.category_id;
        out.push(h('tr', { class: 'group-row' }, h('td', { colspan: 7 }, m.category, h('span', { class: 'badge count' }, plural(rows.filter((r) => r.category_id === m.category_id).length, 'item')))));
      }
      out.push(h('tr', q ? {} : { 'data-id': m.id, 'data-group': m.category_id },
        h('td', { class: 'grip-cell' }, q ? '' : grip(m.name_en)),
        h('td', {}, m.image_url ? h('img', { class: 'thumb', src: imgUrl(m.image_url), alt: '' }) : h('div', { class: 'thumb' })),
        h('td', { class: 'wrap' }, m.chefs_pick ? h('span', { class: 'badge', title: "Chef's pick", style: 'margin-right:6px' }, '★ Chef') : '', m.name_en, m.name_kh ? h('div', { class: 'hint', style: 'margin:2px 0 0' }, m.name_kh) : '',
          (m.tags || []).length ? h('div', { class: 'chips', style: 'margin-top:4px' }, (m.tags || []).map((t) => h('span', { class: 'badge count' }, t))) : ''),
        h('td', {}, m.category),
        h('td', {}, money(m.price)),
        statusCell(m),
        h('td', { class: 'actions' },
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => menuModal(m) }, 'Edit'),
          h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete menu item', `Delete "${m.name_en}"? This cannot be undone.`, 'Delete', async () => {
            await api(`/menu/${m.id}`, 'DELETE'); notify('Menu item deleted'); await LOAD.menu();
          }) }, 'Delete'))));
    }
    $('menu-body').replaceChildren(...out);
  }
  // Items reorder within their own category (the order of categories is set on the Categories tab).
  sortable($('menu-body'), (ids, categoryId) => saveOrder('/menu/reorder', { category_id: parseInt(categoryId, 10), ids },
    () => {
      const pos = new Map(ids.map((id, i) => [id, i]));
      menu.sort((a, b) => (a.category_id === b.category_id && pos.has(a.id) && pos.has(b.id)) ? pos.get(a.id) - pos.get(b.id) : 0);
    }));
  $('menu-search').addEventListener('input', renderMenu);
  $('menu-new').addEventListener('click', () => menuModal(null));

  const MENU_TAGS = ['spicy', 'vegetarian', 'vegan', 'halal', 'gluten-free', 'new'];
  function menuModal(item) {
    if (!categories.length) { notify('Create a category first (Categories tab).', false); return; }
    const f = (id, label, val = '', attrs = {}) => [h('label', { for: id }, label), h('input', { id, value: val ?? '', ...attrs })];
    const desc = (id, label, val = '') => [h('label', { for: id }, label), h('textarea', { id, rows: 2, maxlength: 1000 }, val ?? '')];
    let imageUrl = item?.image_url ?? null;
    const body = h('form', { onsubmit: (e) => e.preventDefault() },
      f('m-name-en', 'Name (English)', item?.name_en, { required: true, maxlength: 120 }),
      f('m-name-kh', 'Name (Khmer)', item?.name_kh, { maxlength: 120 }),
      desc('m-desc-en', 'Description (English)', item?.description_en),
      desc('m-desc-kh', 'Description (Khmer)', item?.description_kh),
      h('div', { class: 'row2' },
        h('div', {}, h('label', { for: 'm-category' }, 'Category'),
          h('select', { id: 'm-category' }, categories.map((c) => h('option', { value: c.id, selected: c.id === (item?.category_id ?? categories[0]?.id) }, c.name_en)))),
        h('div', {}, f('m-price', 'Price ($)', item?.price ?? '', { type: 'number', min: 0, step: '0.01', required: true }))),
      h('label', {}, 'Photo'),
      imagePicker({ url: imageUrl, onChange: (u) => { imageUrl = u; } }),
      h('label', {}, 'Tags'),
      h('div', { class: 'chips', style: 'margin-bottom:12px', role: 'group', 'aria-label': 'Tags' },
        MENU_TAGS.map((t) => h('div', { class: 'check', style: 'margin-right:12px' },
          h('input', { id: `m-tag-${t}`, type: 'checkbox', 'data-tag': t, checked: (item?.tags || []).includes(t) }), h('label', { for: `m-tag-${t}` }, t)))),
      h('div', { class: 'check' }, h('input', { id: 'm-chef', type: 'checkbox', checked: !!item?.chefs_pick }), h('label', { for: 'm-chef' }, "Chef's pick (featured on the home page)")),
      h('div', { class: 'check' }, h('input', { id: 'm-active', type: 'checkbox', checked: item ? item.active : true }), h('label', { for: 'm-active' }, 'Visible on the menu')));
    const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const payload = {
        name_en: $('m-name-en').value, name_kh: $('m-name-kh').value || null,
        description_en: $('m-desc-en').value || null, description_kh: $('m-desc-kh').value || null,
        category_id: parseInt($('m-category').value, 10), price: $('m-price').value,
        image_url: imageUrl, active: $('m-active').checked,
        chefs_pick: $('m-chef').checked,
        tags: MENU_TAGS.filter((t) => $(`m-tag-${t}`).checked),
      };
      await (item ? api(`/menu/${item.id}`, 'PATCH', payload) : api('/menu', 'POST', payload));
      closeModal(); notify(item ? 'Menu item saved' : 'Menu item created'); await LOAD.menu();
    }) }, 'Save');
    openModal(item ? 'Edit menu item' : 'New menu item', body, [cancelBtn(), save]);
  }

  // ---------- Categories ----------
  function renderCategories() {
    $('cat-empty').classList.toggle('hidden', categories.length > 0);
    $('cat-list').replaceChildren(...categories.map((c) => h('li', { 'data-id': c.id },
      grip(`${c.name_en} category`),
      h('div', { class: 'cat-name' }, h('div', {}, c.name_en), c.name_kh ? h('div', { class: 'kh' }, c.name_kh) : ''),
      h('span', { class: 'badge count' }, plural(c.item_count, 'item')),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn-ghost small', type: 'button', onclick: () => categoryModal(c) }, 'Edit'),
        h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => c.item_count
          ? notify(`"${c.name_en}" still has ${plural(c.item_count, 'menu item')}. Move or delete them first.`, false)
          : confirmModal('Delete category', `Delete "${c.name_en}"?`, 'Delete', async () => {
            await api(`/menu/categories/${c.id}`, 'DELETE'); notify('Category deleted'); await LOAD.categories();
          }) }, 'Delete')))));
  }
  $('cat-new').addEventListener('click', () => categoryModal(null));
  sortable($('cat-list'), (ids) => saveOrder('/menu/categories/reorder', { ids },
    () => { categories.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); }));

  function categoryModal(c) {
    const body = h('form', { onsubmit: (e) => e.preventDefault() },
      h('label', { for: 'c-en' }, 'Name (English)'), h('input', { id: 'c-en', value: c?.name_en ?? '', maxlength: 60, required: true }),
      h('label', { for: 'c-kh' }, 'Name (Khmer)'), h('input', { id: 'c-kh', value: c?.name_kh ?? '', maxlength: 60 }));
    const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const payload = { name_en: $('c-en').value, name_kh: $('c-kh').value || null };
      await (c ? api(`/menu/categories/${c.id}`, 'PATCH', payload) : api('/menu/categories', 'POST', payload));
      closeModal(); notify(c ? 'Category saved' : 'Category created'); await LOAD.categories();
    }) }, 'Save');
    openModal(c ? 'Edit category' : 'New category', body, [cancelBtn(), save]);
    setTimeout(() => $('c-en').focus(), 0);
  }

  // ---------- Survey questions & answer scales ----------
  const label = (o) => o.name_en || o.name_kh || '';
  // Drag-and-drop (mouse) plus ArrowUp/ArrowDown on the grip (keyboard / touch-friendly).
  // Items are the direct children of `container` carrying data-id; onDone gets the new id order.
  function sortable(container, onDone) {
    let item = null, start = [], grp;
    // Items may carry data-group; they can only be reordered among items of the same group.
    const order = () => [...container.children].filter((c) => c.dataset.id && c.dataset.group === grp).map((c) => parseInt(c.dataset.id, 10));
    const done = () => { const now = order(); if (now.join() !== start.join()) onDone(now, grp); };
    const arm = (e, on) => { const g = e.target.closest('.grip'); const it = g && g.closest('[data-id]'); if (it && it.parentNode === container) it.draggable = on; };
    container.addEventListener('pointerdown', (e) => arm(e, true));
    container.addEventListener('dragstart', (e) => {
      if (e.target.parentNode !== container || !e.target.draggable) return;
      item = e.target; grp = item.dataset.group; start = order();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      requestAnimationFrame(() => item && item.classList.add('dragging'));
    });
    container.addEventListener('dragover', (e) => {
      if (!item || item.parentNode !== container) return;
      e.preventDefault();
      let t = e.target;
      while (t && t.parentNode !== container) t = t.parentNode;
      if (!t || t === item || !t.dataset.id || t.dataset.group !== grp) return;
      const r = t.getBoundingClientRect();
      container.insertBefore(item, e.clientY > r.top + r.height / 2 ? t.nextSibling : t);
    });
    container.addEventListener('drop', (e) => { if (item) e.preventDefault(); });
    container.addEventListener('dragend', () => {
      if (!item) return;
      item.classList.remove('dragging'); item.draggable = false;
      item = null; done();
    });
    container.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('grip') || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const it = e.target.closest('[data-id]');
      if (!it || it.parentNode !== container) return;
      e.preventDefault();
      grp = it.dataset.group; start = order();
      const other = e.key === 'ArrowUp' ? it.previousElementSibling : it.nextElementSibling;
      if (!other || !other.dataset.id || other.dataset.group !== grp) return;
      container.insertBefore(it, e.key === 'ArrowUp' ? other : other.nextSibling);
      e.target.focus();
      done();
    });
  }
  const grip = (what) => h('button', { class: 'grip', type: 'button', title: `Drag to reorder (or press ↑ ↓)`, 'aria-label': `Reorder ${what}` }, '⠿');
  const saveOrder = (path, body, apply) => guard(async () => {
    try { await api(path, 'PATCH', body); apply(); notify('Order saved'); }
    catch (e) { await LOAD.settings(); throw e; } // put the list back the way the server has it
  })();

  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function renderQuestions() {
    if (!groups.length) {
      $('question-list').replaceChildren(h('div', { class: 'card empty-state' },
        h('h3', {}, 'No answer scales yet'),
        h('p', { class: 'hint' }, 'Create a scale first (for example Agree / Disagree), then add questions to it.'),
        h('button', { class: 'btn-primary', type: 'button', onclick: () => scaleModal(null) }, 'New answer scale')));
      return;
    }
    $('question-list').replaceChildren(...groups.map((g) => h('div', { class: 'card scale-card', 'data-id': g.id },
      h('div', { class: 'q-head' },
        h('div', {},
          h('h3', {}, grip(`${g.name} scale`), g.name, h('span', { class: 'badge count' }, plural(g.menuOption.length, 'question'))),
          h('div', { class: 'chips', title: 'Answer choices, top to bottom' }, g.options.map((o, i) => h('span', { class: 'chip' }, h('b', {}, String(i + 1)), label(o))))),
        h('div', { class: 'q-actions' },
          h('button', { class: 'btn-primary small', type: 'button', onclick: () => questionModal(null, g) }, '+ Add question'),
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => scaleModal(g) }, 'Edit choices'),
          h('button', { class: 'btn-ghost small danger', type: 'button', title: 'Delete this answer scale', onclick: () => confirmModal('Delete answer scale',
            g.menuOption.length ? `Delete the "${g.name}" scale? Its ${plural(g.menuOption.length, 'question')} will be affected too.` : `Delete the "${g.name}" scale?`, 'Delete', async () => {
            await api(`/survey-config/scales/${g.id}`, 'DELETE'); notify('Answer scale deleted'); await LOAD.settings();
          }) }, 'Delete'))),
      g.menuOption.length
        ? h('ol', { class: 'q-list', 'data-group': g.id }, g.menuOption.map((q) => h('li', { 'data-id': q.id },
            grip('question'),
            h('div', { class: 'q-text' }, h('div', {}, q.name_en || q.name_kh),
              q.name_kh && q.name_en ? h('div', { class: 'kh' }, q.name_kh) : ''),
            h('div', { class: 'row-actions' },
              h('button', { class: 'btn-ghost small', type: 'button', onclick: () => questionModal(q, g) }, 'Edit'),
              h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete question', `Delete "${label(q)}"?`, 'Delete', async () => {
                await api(`/survey-config/questions/${q.id}`, 'DELETE'); notify('Question deleted'); await LOAD.settings();
              }) }, 'Delete')))))
        : h('div', { class: 'q-empty' }, 'No questions yet. ', h('button', { class: 'link', type: 'button', onclick: () => questionModal(null, g) }, 'Add the first question')))));
    bindQuestionLists();
  }
  $('scale-new').addEventListener('click', () => scaleModal(null));
  // Delegated listeners live on the stable container; per-scale lists are re-bound after each render.
  const scaleList = $('question-list');
  sortable(scaleList, (ids) => saveOrder('/survey-config/scales/reorder', { ids },
    () => { groups.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); }));
  function bindQuestionLists() {
    scaleList.querySelectorAll('ol.q-list').forEach((ol) => {
      const g = groups.find((x) => x.id === parseInt(ol.dataset.group, 10));
      sortable(ol, (ids) => saveOrder('/survey-config/questions/reorder', { group_option_id: g.id, ids },
        () => { g.menuOption.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); }));
    });
  }

  function questionModal(q, group) {
    const sel = h('select', { id: 'q-group' }, groups.map((g) => h('option', { value: g.id, selected: g.id === group.id }, `${g.name} (${g.options.map(label).join(', ')})`)));
    const body = h('form', { onsubmit: (e) => e.preventDefault() },
      h('label', { for: 'q-en' }, 'Question (English)'), h('input', { id: 'q-en', value: q?.name_en ?? '', maxlength: 200 }),
      h('label', { for: 'q-kh' }, 'Question (Khmer)'), h('input', { id: 'q-kh', value: q?.name_kh ?? '', maxlength: 200 }),
      h('label', { for: 'q-group' }, 'Answer choices'), sel);
    const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const payload = { name_en: $('q-en').value, name_kh: $('q-kh').value, group_option_id: parseInt(sel.value, 10) };
      await (q ? api(`/survey-config/questions/${q.id}`, 'PATCH', payload) : api('/survey-config/questions', 'POST', payload));
      closeModal(); notify(q ? 'Question saved' : 'Question added'); await LOAD.settings();
    }) }, 'Save');
    openModal(q ? 'Edit question' : 'New question', body, [cancelBtn(), save]);
  }

  function scaleModal(g) {
    const rows = h('div', { id: 'choice-rows' });
    const addRow = (o = {}) => {
      const row = h('div', { class: 'choice-row', 'data-id': o.id ?? '' },
        h('input', { class: 'c-en', placeholder: 'English', value: o.name_en ?? '', maxlength: 200 }),
        h('input', { class: 'c-kh', placeholder: 'Khmer', value: o.name_kh ?? '', maxlength: 200 }),
        h('button', { class: 'btn-ghost small', type: 'button', title: 'Move up', onclick: () => row.previousElementSibling && row.parentNode.insertBefore(row, row.previousElementSibling) }, '↑'),
        h('button', { class: 'btn-ghost small', type: 'button', title: 'Remove', onclick: () => row.remove() }, '✕'));
      rows.append(row);
    };
    (g?.options ?? [{}, {}]).forEach(addRow);
    const body = h('form', { onsubmit: (e) => e.preventDefault() },
      h('label', { for: 's-name' }, 'Scale name'), h('input', { id: 's-name', value: g?.name ?? '', maxlength: 100 }),
      h('label', {}, 'Choices (top to bottom)'), rows,
      h('button', { class: 'btn-ghost small', type: 'button', onclick: () => addRow() }, 'Add choice'),
      h('p', { class: 'hint' }, 'Past responses keep the wording they were answered with.'));
    const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const payload = {
        name: $('s-name').value,
        options: [...rows.children].map((r) => ({
          ...(r.dataset.id ? { id: parseInt(r.dataset.id, 10) } : {}),
          name_en: r.querySelector('.c-en').value, name_kh: r.querySelector('.c-kh').value,
        })),
      };
      await (g ? api(`/survey-config/scales/${g.id}`, 'PATCH', payload) : api('/survey-config/scales', 'POST', payload));
      closeModal(); notify(g ? 'Answer scale saved' : 'Answer scale created'); await LOAD.settings();
    }) }, 'Save');
    openModal(g ? 'Edit answer choices' : 'New answer scale', body, [cancelBtn(), save]);
  }

  // ---------- Surveys ----------
  function renderSurveys() {
    const q = $('survey-search').value.trim().toLowerCase();
    const rows = surveys.filter((s) => !q || s.name.toLowerCase().includes(q) || s.phoneNumber.includes(q));
    $('survey-empty').classList.toggle('hidden', rows.length > 0);
    $('survey-body').replaceChildren(...rows.map((s) => h('tr', {},
      h('td', {}, String(s.id)), h('td', {}, s.name), h('td', {}, s.phoneNumber),
      h('td', {}, s.usedToVisit ? 'Returning' : 'First time'), h('td', {}, when(s.created_at)),
      h('td', { class: 'actions' },
        h('button', { class: 'btn-ghost small', type: 'button', onclick: () => surveyModal(s) }, 'View'),
        h('button', { class: 'btn-ghost small', type: 'button', onclick: () => confirmModal('Delete response', `Delete the response from ${s.name}?`, 'Delete', async () => {
          await api(`/surveys/${s.id}`, 'DELETE'); notify('Response deleted'); await LOAD.records();
        }) }, 'Delete')))));
  }
  $('survey-search').addEventListener('input', renderSurveys);

  function surveyModal(s) {
    const body = h('div', {},
      h('p', {}, `${s.name} · ${s.phoneNumber}`),
      h('p', { class: 'hint' }, `Visit date ${new Date(s.dateVisit).toLocaleDateString()} · ${s.usedToVisit ? 'Returning customer' : 'First visit'}`),
      h('dl', { class: 'answers' }, s.answers.flatMap((a) => [h('dt', {}, a.question_en || a.question_kh), h('dd', {}, a.answer_en || a.answer_kh)])),
      s.message ? h('p', {}, h('strong', {}, 'Comment: '), s.message) : '');
    openModal(`Response #${s.id}`, body, [h('button', { class: 'btn-ghost', type: 'button', onclick: closeModal }, 'Close')]);
  }

  // ---------- Pages (list) ----------
  let pages = [], frontendUrl = '';
  const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);


  // ---------- Overview: "Your website at a glance" (counts + quick add) ----------
  const _overview = LOAD.overview;
  LOAD.overview = async function (...args) {
    await _overview.apply(this, args);
    const list = (r) => (Array.isArray(r) ? r : r?.items ?? null);
    const get = (path) => api(path).then(list).catch(() => null);
    const [menuItems, photos, offers, faqs, posts, jobs] = await Promise.all([get('/menu/all'), get('/gallery/all'), get('/offers/all'), get('/faq/all'), get('/blog/all/list'), get('/careers/all')]);
    const cards = [
      ['Menu dishes', menuItems && menuItems.filter((m) => m.active).length, 'menu', 'Add a dish'],
      ['Gallery photos', photos?.filter((p) => p.active).length, 'gallery', 'Add photos'],
      ['Offers & events', offers?.filter((o) => o.active).length, 'offers', 'Add an offer'],
      ['FAQ answers', faqs?.filter((f) => f.active).length, 'faq', 'Add a question'],
      ['Blog posts', posts?.filter((p) => p.published).length, 'blog', 'Write a post'],
      ['Open jobs', jobs?.filter((j) => j.active).length, 'careers', 'Add a job'],
    ];
    const box = $('view-overview');
    let card = $('glance');
    if (!card) { card = h('div', { class: 'card', id: 'glance' }); box.append(card); }
    card.replaceChildren(
      h('h3', {}, 'Your website at a glance'),
      h('p', { class: 'hint' }, 'What visitors can see right now. Click a card to manage it.'),
      h('div', { class: 'glance' }, ...cards.map(([label, n, view, cta]) => h('a', { class: `glance-card${n === 0 ? ' is-empty' : ''}`, href: `#${view}` },
        h('div', { class: 'n' }, n == null ? '–' : String(n)), h('div', { class: 'l' }, label), h('div', { class: 'cta' }, n === 0 ? `${cta} →` : 'Manage →')))));
  };

  LOAD.pages = async function () {
    [pages, { frontend_url: frontendUrl }] = await Promise.all([api('/pages'), api('/pages/config')]);
    $('pages-empty').classList.toggle('hidden', pages.length > 0);
    $('pages-body').replaceChildren(...pages.map((p) => h('tr', {},
      h('td', { class: 'wrap' }, h('a', { class: 'row-link', href: `#pages/${p.slug}` }, p.title)),
      h('td', {}, p.published
        ? h('a', { class: 'link', href: `${frontendUrl}${p.slug === 'home' ? '/' : '/' + p.slug}`, target: '_blank', rel: 'noopener' }, p.slug === 'home' ? '/ (front page)' : `/${p.slug}`)
        : h('span', { class: 'hint', style: 'margin:0' }, `/${p.slug}`)),
      h('td', {}, h('span', { class: `badge${p.published ? '' : ' off'}` }, p.published ? 'Published' : 'Draft')),
      h('td', {}, when(p.updated_at)),
      h('td', { class: 'actions' },
        h('a', { class: 'btn-ghost small', href: `#pages/${p.slug}` }, 'Edit design'),
        h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete page', `Delete "${p.title}"? This cannot be undone.`, 'Delete', async () => {
          await api(`/pages/${p.slug}`, 'DELETE'); notify('Page deleted'); await LOAD.pages();
        }) }, 'Delete')))));
  };

  $('page-new').addEventListener('click', () => {
    let touched = false;
    const title = h('input', { id: 'np-title', maxlength: 120, placeholder: 'e.g. About us', required: true });
    const slug = h('input', { id: 'np-slug', maxlength: 60, placeholder: 'about-us' });
    title.addEventListener('input', () => { if (!touched) slug.value = slugify(title.value); });
    slug.addEventListener('input', () => { touched = true; });
    const body = h('form', { onsubmit: (e) => e.preventDefault() },
      h('label', { for: 'np-title' }, 'Page title'), title,
      h('label', { for: 'np-slug' }, 'Address on your website'), slug,
      h('p', { class: 'hint' }, 'Lowercase letters, numbers and dashes. Use "home" to design the front page.'));
    const create = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const p = await api('/pages', 'POST', { title: title.value, slug: slug.value });
      closeModal(); location.hash = `#pages/${p.slug}`;
    }) }, 'Create and design');
    openModal('New page', body, [cancelBtn(), create]);
    setTimeout(() => title.focus(), 0);
  });

  // ---------- Page builder (GrapesJS) ----------
  const loadScript = (src) => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error(`Could not load ${src}`)); document.head.append(s); });
  let grapesReady = null;
  function loadGrapes() {
    grapesReady ??= (async () => {
      document.head.append(h('link', { rel: 'stylesheet', href: 'vendor/grapes.min.css' }));
      await loadScript('vendor/grapes.min.js');
      await loadScript('vendor/grapesjs-blocks-basic.js');
    })().catch((e) => { grapesReady = null; throw e; });
    return grapesReady;
  }

  function closePageEditor() {
    if (!pageEditor) return;
    window.onbeforeunload = null;
    try { pageEditor.gjs.destroy(); } catch (_) { /* already gone */ }
    pageEditor = null;
  }

  const BRAND = '#E5902C', CREAM = '#F3EABF';
  function registerBlocks(editor) {
    // The live menu is drawn by the real website; in the editor it is just a locked placeholder.
    editor.DomComponents.addType('itacate-menu', {
      isComponent: (el) => el.getAttribute && el.getAttribute('data-itacate') === 'menu' && { type: 'itacate-menu' },
      model: { defaults: { name: 'Live menu', droppable: false, editable: false, copyable: true,
        attributes: { 'data-itacate': 'menu' },
        style: { padding: '28px', border: `2px dashed ${BRAND}`, 'border-radius': '12px', 'text-align': 'center', color: BRAND, 'font-weight': '600' },
        components: 'Your live menu appears here' } },
    });
    editor.DomComponents.addType('itacate-language', {
      isComponent: (el) => el.getAttribute && el.getAttribute('data-itacate') === 'language' && { type: 'itacate-language' },
      model: { defaults: { name: 'Language buttons', droppable: false, editable: false,
        attributes: { 'data-itacate': 'language' },
        style: { padding: '14px 28px', border: `2px dashed ${BRAND}`, 'border-radius': '12px', 'text-align': 'center', color: BRAND, 'font-weight': '600' },
        components: 'ខ្មែរ · English buttons appear here' } },
    });
    const add = (id, label, category, content, icon) => editor.Blocks.add(id, { label, category, content, media: icon, select: true });
    const ico = (d) => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    add('hero', 'Hero', 'Sections', `<section style="padding:90px 20px;text-align:center"><h1 style="color:${BRAND};font-size:46px">Welcome to our restaurant</h1><p style="font-size:18px;max-width:640px;margin:0 auto 26px">Tell your guests what makes this place special.</p><a href="/menu" style="display:inline-block;background:${BRAND};color:${CREAM};padding:13px 30px;border-radius:8px;font-weight:700;text-decoration:none">See our menu</a></section>`, ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M9 14h6"/>'));
    add('live-menu', 'Live menu', 'Restaurant', { type: 'itacate-menu' }, ico('<path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v6M19 3c-2 2-3 5-3 8h3v10"/>'));
    add('language', 'Language buttons', 'Restaurant', { type: 'itacate-language' }, ico('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'));
    add('survey-btn', 'Survey button', 'Restaurant', `<div style="text-align:center;padding:24px"><a href="/survey" style="display:inline-block;background:${BRAND};color:${CREAM};padding:13px 30px;border-radius:8px;font-weight:700;text-decoration:none">Take our survey</a></div>`, ico('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'));
    add('heading', 'Heading', 'Text', `<h2 style="color:${BRAND}">Your heading</h2>`, ico('<path d="M6 5v14M18 5v14M6 12h12"/>'));
    add('paragraph', 'Paragraph', 'Text', '<p>Write something here. Double-click to edit this text.</p>', ico('<path d="M4 7h16M4 12h16M4 17h10"/>'));
    add('button', 'Button', 'Text', `<a href="#" style="display:inline-block;background:${BRAND};color:${CREAM};padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none">Button</a>`, ico('<rect x="3" y="8" width="18" height="8" rx="4"/>'));
    add('divider', 'Divider', 'Layout', '<hr/>', ico('<path d="M3 12h18"/>'));
    add('spacer', 'Spacer', 'Layout', '<div style="height:60px"></div>', ico('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'));
    add('card', 'Card', 'Layout', `<div style="background:#ffffff99;border:1px solid ${BRAND}40;border-radius:16px;padding:24px;max-width:420px;margin:16px auto"><h3 style="color:${BRAND}">Card title</h3><p>Short description for this card.</p></div>`, ico('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>'));
  }

  LOAD.editor = async function (slug) {
    if (pageEditor && pageEditor.slug === slug) { pageEditor.gjs.refresh(); return; } // same page, just re-shown
    closePageEditor();
    await loadGrapes();
    const [page, cfg] = await Promise.all([api(`/pages/${encodeURIComponent(slug)}/edit`), api('/pages/config')]);
    $('ed-title').value = page.title;
    $('ed-url').textContent = slug === 'home' ? 'Front page (/)' : `/${slug}`;
    $('ed-view').href = `${cfg.frontend_url}${slug === 'home' ? '/' : '/' + slug}`;
    $('view-title').textContent = 'Edit page';
    $('ed-styles').replaceChildren($('ed-style-hint'));
    $('ed-style-hint').classList.remove('hidden');
    $('ed-traits').replaceChildren(); $('ed-blocks').replaceChildren(); $('ed-layers').replaceChildren();

    const blocksBasic = window['gjs-blocks-basic'];
    const gjs = window.grapesjs.init({
      container: '#gjs', height: '100%', width: 'auto', fromElement: false, storageManager: false,
      protectedCss: '', // our base stylesheet replaces GrapesJS's default reset
      canvas: { styles: [new URL('page-base.css', location.href).href] },
      plugins: [(ed) => (blocksBasic.default || blocksBasic)(ed, { flexGrid: true, category: 'Layout', blocks: ['column1', 'column2', 'column3', 'image', 'link', 'video', 'map'], labelColumn1: '1 column', labelColumn2: '2 columns', labelColumn3: '3 columns' })],
      blockManager: { appendTo: '#ed-blocks' },
      layerManager: { appendTo: '#ed-layers' },
      traitManager: { appendTo: '#ed-traits' },
      selectorManager: { componentFirst: true },
      styleManager: { appendTo: '#ed-styles', sectors: [
        { name: 'Layout', open: true, properties: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'width', 'max-width', 'min-height', 'margin', 'padding'] },
        { name: 'Text', open: true, properties: ['font-family', 'font-size', 'font-weight', 'color', 'text-align', 'line-height', 'letter-spacing'] },
        { name: 'Background', open: false, properties: ['background-color', 'background-image', 'background-size', 'background-position'] },
        { name: 'Border', open: false, properties: ['border-radius', 'border', 'box-shadow'] },
      ] },
      panels: { defaults: [] },
      deviceManager: { devices: [
        { id: 'Desktop', name: 'Desktop', width: '' },
        { id: 'Tablet', name: 'Tablet', width: '820px', widthMedia: '992px' },
        { id: 'Mobile', name: 'Mobile', width: '390px', widthMedia: '480px' },
      ] },
      assetManager: { uploadFile: async (e) => {
        const files = [...(e.dataTransfer ? e.dataTransfer.files : e.target.files)];
        for (const f of files) {
          if (!IMG_TYPES.includes(f.type)) { notify('Only PNG, JPG, WEBP or GIF images are allowed', false); continue; }
          if (f.size > MAX_IMG) { notify(`${f.name} is over 3 MB`, false); continue; }
          try { const fd = new FormData(); fd.append('file', f); const { url } = await api('/uploads', 'POST', fd, true); gjs.AssetManager.add({ type: 'image', src: url, name: f.name }); }
          catch (err) { notify(err.message, false); }
        }
      } },
    });
    registerBlocks(gjs);
    gjs.getWrapper().addClass('itacate-page'); // same base look as the real site
    if (page.project) gjs.loadProjectData(page.project);
    else if (page.html) { gjs.setComponents(page.html); if (page.css) gjs.addStyle(page.css); } // page saved without editor data (e.g. created via the API)
    else gjs.setComponents(`<section style="padding:90px 20px;text-align:center"><h1 style="color:${BRAND}">${page.title.replace(/[<>&]/g, '')}</h1><p>Drag blocks from the left to build this page.</p></section>`);

    const state = pageEditor = { gjs, slug, dirty: false, published: page.published };
    gjs.UndoManager.clear();
    gjs.on('update', () => { state.dirty = true; window.onbeforeunload = () => true; });
    gjs.on('component:selected', () => { $('ed-style-hint').classList.add('hidden'); });
    gjs.on('component:deselected', () => { if (!gjs.getSelected()) $('ed-style-hint').classList.remove('hidden'); });
    paintPublished();
    // Reset toolbar state for this page.
    document.querySelectorAll('#ed-devices button').forEach((b) => b.classList.toggle('on', b.dataset.device === 'Desktop'));
  };

  function paintPublished() {
    const on = pageEditor.published;
    $('ed-published').classList.toggle('on', on);
    $('ed-published').setAttribute('aria-checked', String(on));
    $('ed-published-label').textContent = on ? 'Published' : 'Draft';
  }

  async function savePage() {
    const { gjs, slug } = pageEditor;
    const btn = $('ed-save'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api(`/pages/${encodeURIComponent(slug)}`, 'PUT', {
        title: $('ed-title').value, project: gjs.getProjectData(), html: gjs.getHtml().replace(/^\s*<body[^>]*>/i, '').replace(/<\/body>\s*$/i, ''), css: gjs.getCss(), published: pageEditor.published,
      });
      pageEditor.dirty = false; window.onbeforeunload = null;
      notify(pageEditor.published ? 'Saved. This page is live on your website.' : 'Saved as a draft. Turn on Published to put it on your website.');
    } finally { btn.disabled = false; btn.textContent = 'Save'; }
  }

  $('ed-save').addEventListener('click', guard(savePage));
  document.addEventListener('keydown', (e) => { if (pageEditor && (e.metaKey || e.ctrlKey) && e.key === 's' && !$('view-editor').classList.contains('hidden')) { e.preventDefault(); guard(savePage)(); } });
  $('ed-back').addEventListener('click', () => { location.hash = '#pages'; });
  $('ed-title').addEventListener('input', () => { if (pageEditor) { pageEditor.dirty = true; window.onbeforeunload = () => true; } });
  $('ed-undo').addEventListener('click', () => pageEditor?.gjs.UndoManager.undo());
  $('ed-redo').addEventListener('click', () => pageEditor?.gjs.UndoManager.redo());
  $('ed-published').addEventListener('click', () => { if (!pageEditor) return; pageEditor.published = !pageEditor.published; pageEditor.dirty = true; window.onbeforeunload = () => true; paintPublished(); });
  $('ed-devices').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !pageEditor) return;
    pageEditor.gjs.setDevice(b.dataset.device);
    document.querySelectorAll('#ed-devices button').forEach((x) => x.classList.toggle('on', x === b));
  });
  for (const id of ['ed-left-tabs', 'ed-right-tabs']) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $(id).querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); $(x.dataset.pane).classList.toggle('hidden', x !== b); });
    });
  }

  // ---------- Boot ----------
  function start() {
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    api('/shop').then((s) => { shop = s; applyBrand(); }).catch(() => {});
    route();
  }
  window.addEventListener('hashchange', () => token && route());
  if (token) start(); else showAuth();
})();
