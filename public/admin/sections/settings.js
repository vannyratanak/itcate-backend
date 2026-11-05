// Admin section: Hours & Contact (SiteSetting). Owned by the "settings" feature.
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'settings', label: 'Hours & Contact', group: 'Site',
  async load(el, kit) {
    const { h, api, notify, guard } = kit;
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const s = await api('/settings');
    const field = (id, label, val, attrs = {}) => h('div', {}, h('label', { for: `st-${id}` }, label), h('input', { id: `st-${id}`, value: val ?? '', ...attrs }));
    const rows = s.hours.map((d, i) => {
      const open = h('input', { id: `st-open-${i}`, type: 'time', value: d.open, 'aria-label': `${DAYS[i]} opens`, disabled: d.closed });
      const close = h('input', { id: `st-close-${i}`, type: 'time', value: d.close, 'aria-label': `${DAYS[i]} closes`, disabled: d.closed });
      const closed = h('input', { id: `st-closed-${i}`, type: 'checkbox', checked: d.closed, onchange: (e) => { open.disabled = close.disabled = e.target.checked; } });
      return h('tr', {}, h('td', {}, DAYS[i]), h('td', {}, open), h('td', {}, close),
        h('td', {}, h('div', { class: 'check', style: 'margin:0' }, closed, h('label', { for: `st-closed-${i}`, style: 'margin:0;font-weight:500' }, 'Closed'))));
    });
    const copy = h('button', { class: 'btn-ghost small', type: 'button', onclick: () => {
      for (let i = 1; i < 7; i++) {
        $v(`st-open-${i}`).value = $v('st-open-0').value; $v(`st-close-${i}`).value = $v('st-close-0').value;
        $v(`st-closed-${i}`).checked = $v('st-closed-0').checked;
        $v(`st-open-${i}`).disabled = $v(`st-close-${i}`).disabled = $v('st-closed-0').checked;
      }
      notify('Monday copied to every day (not saved yet)');
    } }, 'Copy Monday to all days');
    const $v = (id) => el.querySelector(`#${id}`);
    const val = (id) => $v(`st-${id}`).value.trim() || null;

    const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
      const payload = {
        phone: val('phone'), email: val('email'), address_en: val('address_en'), address_kh: val('address_kh'),
        map_url: val('map_url'), map_embed: val('map_embed'),
        facebook: val('facebook'), instagram: val('instagram'), telegram: val('telegram'), tiktok: val('tiktok'),
        notice: val('notice'),
        hours: DAYS.map((_, i) => ({ day: i, open: $v(`st-open-${i}`).value || '10:00', close: $v(`st-close-${i}`).value || '22:00', closed: $v(`st-closed-${i}`).checked })),
      };
      await api('/settings', 'PUT', payload);
      notify('Hours & contact saved');
    }) }, 'Save changes');

    el.replaceChildren(
      h('div', { class: 'card' },
        h('h3', {}, 'Contact'), h('p', { class: 'hint' }, 'Shown in the website footer, on the home page and on the contact page.'),
        h('div', { class: 'row2' }, field('phone', 'Phone', s.phone, { maxlength: 30, placeholder: '+855 12 345 678' }), field('email', 'Email', s.email, { type: 'email', maxlength: 120 })),
        h('div', { class: 'row2' }, field('address_en', 'Address (English)', s.address_en, { maxlength: 300 }), field('address_kh', 'Address (Khmer)', s.address_kh, { maxlength: 300 })),
        field('map_url', 'Google Maps link', s.map_url, { maxlength: 500, placeholder: 'https://maps.google.com/?q=...' }),
        field('map_embed', 'Google Maps embed address (optional, the src of the embed iframe)', s.map_embed, { maxlength: 1000, placeholder: 'https://www.google.com/maps/embed?pb=...' })),
      h('div', { class: 'card', style: 'margin-top:16px' },
        h('h3', {}, 'Social links'), h('p', { class: 'hint' }, 'Leave empty to hide a link. Links must start with https://'),
        h('div', { class: 'row2' }, field('facebook', 'Facebook', s.facebook, { maxlength: 300 }), field('instagram', 'Instagram', s.instagram, { maxlength: 300 })),
        h('div', { class: 'row2' }, field('telegram', 'Telegram', s.telegram, { maxlength: 300 }), field('tiktok', 'TikTok', s.tiktok, { maxlength: 300 }))),
      h('div', { class: 'card', style: 'margin-top:16px' },
        h('h3', {}, 'Opening hours'), h('p', { class: 'hint' }, 'Visitors see these in the footer and on the home page, with an Open now / Closed badge.'),
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'Opens'), h('th', {}, 'Closes'), h('th', {}, ''))), h('tbody', {}, rows)),
        h('div', { style: 'margin-top:12px' }, copy)),
      h('div', { class: 'card', style: 'margin-top:16px' },
        h('h3', {}, 'Notice banner'), h('p', { class: 'hint' }, 'A short message across the top of every page, e.g. "Closed on 14 April for the holiday". Empty = no banner.'),
        field('notice', 'Banner text (max 160 characters)', s.notice, { maxlength: 160 })),
      h('div', { style: 'margin-top:16px' }, save));
  },
});
