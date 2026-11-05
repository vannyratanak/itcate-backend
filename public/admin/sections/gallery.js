// Admin section: Gallery. Owned by the "gallery" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'gallery', label: 'Gallery', group: 'Content',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Gallery: coming soon.')));
  },
});
