// Admin section: Activity Log. Owned by the "activity" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'activity', label: 'Activity Log', group: 'Admin',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Activity Log: coming soon.')));
  },
});
