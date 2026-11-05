// Admin section: Survey Results. Owned by the "analytics" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'analytics', label: 'Survey Results', group: 'Insights',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Survey Results: coming soon.')));
  },
});
