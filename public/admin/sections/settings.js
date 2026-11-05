// Admin section: Hours & Contact. Owned by the "settings" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'settings', label: 'Hours & Contact', group: 'Site',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Hours & Contact: coming soon.')));
  },
});
