// Admin section: Reviews. Owned by the "reviews" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'reviews', label: 'Reviews', group: 'Content',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Reviews: coming soon.')));
  },
});
