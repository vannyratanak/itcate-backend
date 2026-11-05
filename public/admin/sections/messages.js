// Admin section: Messages. Owned by the "messages" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'messages', label: 'Messages', group: 'Guests',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Messages: coming soon.')));
  },
});
