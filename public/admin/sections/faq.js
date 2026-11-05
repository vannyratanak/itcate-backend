// Admin section: FAQ. Owned by the "faq" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'faq', label: 'FAQ', group: 'Content',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'FAQ: coming soon.')));
  },
});
