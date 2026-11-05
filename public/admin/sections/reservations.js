// Admin section: Reservations. Owned by the "reservations" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'reservations', label: 'Reservations', group: 'Guests',
  async load(el, kit) {
    const { h } = kit;
    el.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'hint' }, 'Reservations: coming soon.')));
  },
});
