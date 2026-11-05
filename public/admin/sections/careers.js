// Admin section: Jobs (careers page). Owned by the "careers" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'careers', label: 'Jobs', group: 'Guests',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, sortable, grip } = kit;
    let jobs = await api('/careers/all');

    const reload = async () => { jobs = await api('/careers/all'); draw(); };

    const list = h('ul', { class: 'cat-list' });
    const empty = h('p', { class: 'empty hidden' }, 'No jobs yet. Add one and it appears on the Careers page.');
    el.replaceChildren(
      h('div', { class: 'toolbar' },
        h('p', { class: 'hint intro' }, 'Open positions shown on the Careers page. Drag ⠿ to change the order. Applications arrive in the Messages inbox (type: career).'),
        h('button', { class: 'btn-primary', type: 'button', onclick: () => jobModal(null) }, 'New job')),
      h('div', { class: 'card cat-card' }, list, empty));

    sortable(list, async (ids) => {
      try { await api('/careers/reorder', 'PATCH', { ids }); jobs.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id)); notify('Order saved'); }
      catch (e) { notify(e.message, false); await reload(); } // put the list back the way the server has it
    });

    function draw() {
      empty.classList.toggle('hidden', jobs.length > 0);
      list.replaceChildren(...jobs.map((j) => h('li', { 'data-id': j.id },
        grip(`${j.title_en} job`),
        h('div', { class: 'cat-name' }, h('div', {}, j.title_en), j.title_kh ? h('div', { class: 'kh' }, j.title_kh) : ''),
        j.type_en ? h('span', { class: 'badge count' }, j.type_en) : '',
        h('span', { class: `badge ${j.active ? '' : 'off'}` }, j.active ? 'Open' : 'Hidden'),
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn-ghost small', type: 'button', onclick: guard(async () => {
            await api(`/careers/${j.id}`, 'PATCH', { active: !j.active }); notify(j.active ? 'Job hidden' : 'Job is open'); await reload();
          }) }, j.active ? 'Hide' : 'Open'),
          h('button', { class: 'btn-ghost small', type: 'button', onclick: () => jobModal(j) }, 'Edit'),
          h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete job', `Delete "${j.title_en}"?`, 'Delete', async () => {
            await api(`/careers/${j.id}`, 'DELETE'); notify('Job deleted'); await reload();
          }) }, 'Delete')))));
    }

    function jobModal(j) {
      const f = (id, label, val, attrs = {}, tag = 'input') => [h('label', { for: id }, label), h(tag, { id, ...attrs }, tag === 'textarea' ? (val ?? '') : undefined)]
        .map((n, i) => { if (i && tag === 'input') n.value = val ?? ''; return n; });
      const body = h('form', { onsubmit: (e) => e.preventDefault() },
        ...f('j-en', 'Title (English)', j?.title_en, { maxlength: 120, required: true }),
        ...f('j-kh', 'Title (Khmer)', j?.title_kh, { maxlength: 120 }),
        ...f('j-ten', 'Type (English), e.g. Full-time', j?.type_en, { maxlength: 60 }),
        ...f('j-tkh', 'Type (Khmer)', j?.type_kh, { maxlength: 60 }),
        ...f('j-den', 'Description (English)', j?.description_en, { rows: 4, maxlength: 3000 }, 'textarea'),
        ...f('j-dkh', 'Description (Khmer)', j?.description_kh, { rows: 4, maxlength: 3000 }, 'textarea'));
      const v = (id) => document.getElementById(id).value.trim() || null;
      const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        const payload = { title_en: v('j-en'), title_kh: v('j-kh'), type_en: v('j-ten'), type_kh: v('j-tkh'), description_en: v('j-den'), description_kh: v('j-dkh') };
        await (j ? api(`/careers/${j.id}`, 'PATCH', payload) : api('/careers', 'POST', payload));
        closeModal(); notify(j ? 'Job saved' : 'Job created'); await reload();
      }) }, 'Save');
      openModal(j ? 'Edit job' : 'New job', body, [cancelBtn(), save]);
      setTimeout(() => document.getElementById('j-en').focus(), 0);
    }

    draw();
  },
});
