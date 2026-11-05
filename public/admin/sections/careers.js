// Admin section: Jobs. Owned by the "careers" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'careers', label: 'Jobs', group: 'Guests',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Jobs: coming soon.')));
  },
});
