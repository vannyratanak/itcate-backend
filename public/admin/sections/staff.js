// Admin section: Staff & Roles. Owned by the "staff" feature (this file only).
// Also applies a cosmetic read-only mode for viewers (the server is the real authority: see src/auth/roles.ts).
(() => {
  const TOKEN_KEY = 'itacate_admin_token';
  const roleFromToken = () => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t) return '';
      const r = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
      return r === 'admin' ? 'owner' : r;
    } catch { return ''; }
  };
  const style = document.createElement('style');
  style.textContent = `
    body[data-role="viewer"] #app .btn-primary:not(.keep),
    body[data-role="viewer"] #app .btn-danger,
    body[data-role="viewer"] #app .danger,
    body[data-role="viewer"] #app .grip { display: none !important; }
    body[data-role="viewer"] #view-title::after { content: " · read-only"; font-size: 12px; font-weight: 500; opacity: .6; }
    .staff-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin-bottom: 20px; }
    .staff-grid .card form label { display: block; margin-top: 10px; }
    .role-badge { text-transform: capitalize; }
    .pw-row { display: flex; gap: 8px; align-items: center; }
    .pw-row input { flex: 1; }
  `;
  document.head.append(style);
  const applyRole = () => { const r = roleFromToken(); if (document.body.dataset.role !== r) document.body.dataset.role = r; };
  applyRole();
  setInterval(applyRole, 1500);

  const ROLE_HELP = {
    owner: 'Everything, including staff and the activity log.',
    manager: 'Everything except staff and the activity log.',
    viewer: 'Read-only: can look at everything, change nothing.',
  };
  const randomPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint32Array(16); crypto.getRandomValues(a);
    return Array.from(a, (n) => chars[n % chars.length]).join('');
  };

  (window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
    id: 'staff', label: 'Staff & Roles', group: 'Admin',
    async load(el, kit) {
      const { h, api, notify, guard, openModal, closeModal, confirmModal, cancelBtn, when } = kit;
      const me = await api('/auth/me');

      // ----- My account (everyone) -----
      const cur = h('input', { type: 'password', id: 'pw-cur', autocomplete: 'current-password', required: true });
      const nw = h('input', { type: 'password', id: 'pw-new', autocomplete: 'new-password', minlength: 10, required: true });
      const nw2 = h('input', { type: 'password', id: 'pw-new2', autocomplete: 'new-password', required: true });
      const changeCard = me.bootstrap
        ? h('div', { class: 'card' }, h('h3', {}, 'My account'),
            h('p', {}, h('strong', {}, me.username), ' ', h('span', { class: 'badge role-badge' }, me.role)),
            h('p', { class: 'hint' }, "This is the server login. Its password is set in the server's .env file, so it can't be changed here."))
        : h('div', { class: 'card' }, h('h3', {}, 'My account'),
            h('p', {}, h('strong', {}, me.username), ' ', h('span', { class: 'badge role-badge' }, me.role)),
            h('p', { class: 'hint' }, ROLE_HELP[me.role] || ''),
            h('form', { onsubmit: (e) => e.preventDefault() },
              h('h4', {}, 'Change my password'),
              h('label', { for: 'pw-cur' }, 'Current password'), cur,
              h('label', { for: 'pw-new' }, 'New password (at least 10 characters)'), nw,
              h('label', { for: 'pw-new2' }, 'Repeat new password'), nw2,
              h('p', {}, h('button', { class: 'btn-primary keep', type: 'submit', onclick: guard(async () => {
                if (nw.value !== nw2.value) throw new Error('The two new passwords do not match');
                await api('/auth/change-password', 'POST', { current_password: cur.value, new_password: nw.value });
                notify('Password changed. Please sign in again.');
                localStorage.removeItem(TOKEN_KEY);
                setTimeout(() => document.getElementById('logout-btn')?.click(), 900);
              }) }, 'Change password'))));

      if (me.role !== 'owner') {
        el.replaceChildren(h('div', { class: 'staff-grid' }, changeCard),
          h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Only owners can add or manage staff accounts.')));
        return;
      }

      // ----- Staff list (owners) -----
      const { users, bootstrap } = await api('/staff');
      const roleSelect = (id, value) => h('select', { id },
        ...['owner', 'manager', 'viewer'].map((r) => h('option', { value: r, selected: r === value }, `${r[0].toUpperCase()}${r.slice(1)}: ${ROLE_HELP[r]}`)));

      const reload = () => this.load(el, kit);

      function addModal() {
        const pw = h('input', { id: 'su-pw', type: 'text', autocomplete: 'off', minlength: 10, required: true, value: randomPassword() });
        const body = h('form', { onsubmit: (e) => e.preventDefault() },
          h('label', { for: 'su-name' }, 'Username (letters, numbers, . _ -)'), h('input', { id: 'su-name', maxlength: 32, required: true, autocomplete: 'off' }),
          h('label', { for: 'su-role' }, 'Role'), roleSelect('su-role', 'viewer'),
          h('label', { for: 'su-pw' }, 'Temporary password'),
          h('div', { class: 'pw-row' }, pw, h('button', { class: 'btn-ghost small', type: 'button', onclick: () => { pw.value = randomPassword(); } }, 'Generate')),
          h('p', { class: 'hint' }, 'Copy it now and give it to them. They can change it under "My account"; you will not be able to see it again.'));
        const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
          await api('/staff', 'POST', { username: document.getElementById('su-name').value, role: document.getElementById('su-role').value, password: pw.value });
          closeModal(); notify('Account created'); await reload();
        }) }, 'Create account');
        openModal('Add staff account', body, [cancelBtn(), save]);
        setTimeout(() => document.getElementById('su-name').focus(), 0);
      }

      function roleModal(u) {
        const body = h('form', { onsubmit: (e) => e.preventDefault() }, h('label', { for: 'er-role' }, `Role for ${u.username}`), roleSelect('er-role', u.role));
        const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
          await api(`/staff/${u.id}`, 'PATCH', { role: document.getElementById('er-role').value });
          closeModal(); notify('Role updated'); await reload();
        }) }, 'Save');
        openModal('Change role', body, [cancelBtn(), save]);
      }

      function resetModal(u) {
        const pw = h('input', { id: 'rp-pw', type: 'text', autocomplete: 'off', minlength: 10, required: true, value: randomPassword() });
        const body = h('form', { onsubmit: (e) => e.preventDefault() },
          h('label', { for: 'rp-pw' }, `New password for ${u.username}`),
          h('div', { class: 'pw-row' }, pw, h('button', { class: 'btn-ghost small', type: 'button', onclick: () => { pw.value = randomPassword(); } }, 'Generate')),
          h('p', { class: 'hint' }, 'They will be signed out everywhere and must use this password next time.'));
        const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
          await api(`/staff/${u.id}/reset-password`, 'POST', { password: pw.value });
          closeModal(); notify('Password reset'); await reload();
        }) }, 'Reset password');
        openModal('Reset password', body, [cancelBtn(), save]);
      }

      const rows = users.map((u) => {
        const self = u.id === me.id;
        return h('tr', {},
          h('td', {}, h('strong', {}, u.username), self ? h('span', { class: 'hint', style: 'margin:0 0 0 6px' }, '(you)') : ''),
          h('td', {}, h('span', { class: 'badge role-badge' }, u.role)),
          h('td', {}, h('span', { class: `badge${u.active ? '' : ' off'}` }, u.active ? 'Active' : 'Deactivated')),
          h('td', {}, u.last_login_at ? when(u.last_login_at) : 'Never'),
          h('td', { class: 'actions' },
            h('button', { class: 'btn-ghost small', type: 'button', onclick: () => roleModal(u) }, 'Role'),
            h('button', { class: 'btn-ghost small', type: 'button', onclick: () => resetModal(u) }, 'Reset password'),
            self ? '' : h('button', { class: 'btn-ghost small', type: 'button', onclick: guard(async () => {
              await api(`/staff/${u.id}`, 'PATCH', { active: !u.active });
              notify(u.active ? 'Account deactivated' : 'Account re-activated'); await reload();
            }) }, u.active ? 'Deactivate' : 'Activate'),
            self ? '' : h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete account', `Delete "${u.username}"? They will be signed out and can't sign in again.`, 'Delete', async () => {
              await api(`/staff/${u.id}`, 'DELETE'); notify('Account deleted'); await reload();
            }) }, 'Delete')));
      });

      el.replaceChildren(
        h('div', { class: 'staff-grid' }, changeCard,
          h('div', { class: 'card' }, h('h3', {}, 'Roles'),
            h('dl', { class: 'answers' }, ...['owner', 'manager', 'viewer'].flatMap((r) => [h('dt', {}, r[0].toUpperCase() + r.slice(1)), h('dd', {}, ROLE_HELP[r])])))),
        h('div', { class: 'toolbar' },
          h('p', { class: 'hint intro' }, bootstrap ? `The server login "${bootstrap}" (from the .env file) is always an owner and is not listed here.` : 'Staff accounts sign in with their own username and password.'),
          h('button', { class: 'btn-primary keep', type: 'button', onclick: addModal }, 'Add staff account')),
        h('div', { class: 'table-wrap' },
          h('table', {},
            h('thead', {}, h('tr', {}, ...['Username', 'Role', 'Status', 'Last sign-in', ''].map((t) => h('th', {}, t)))),
            h('tbody', {}, ...rows)),
          users.length ? '' : h('p', { class: 'empty' }, 'No staff accounts yet. Add one to give a teammate their own login.')));
    },
  });
})();
