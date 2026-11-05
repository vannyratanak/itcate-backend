// Admin section: Blog. Owned by the "blog" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'blog', label: 'Blog', group: 'Content',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Blog: coming soon.')));
  },
});
