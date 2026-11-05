// Admin section: Staff & Roles. Owned by the "staff" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'staff', label: 'Staff & Roles', group: 'Admin',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Staff & Roles: coming soon.')));
  },
});
