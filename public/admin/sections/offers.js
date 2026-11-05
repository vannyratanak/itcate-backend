// Admin section: Offers & Events. Owned by the "offers" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'offers', label: 'Offers & Events', group: 'Content',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Offers & Events: coming soon.')));
  },
});
