// Admin section: FAQ. Owned by the "faq" feature (this file only).
(window.ADMIN_SECTIONS = window.ADMIN_SECTIONS || []).push({
  id: 'faq', label: 'FAQ', group: 'Content',
  async load(el, kit) {
    const { api, h, notify, guard, openModal, closeModal, confirmModal, cancelBtn, sortable, grip } = kit;

    if (!document.getElementById('faq-admin-css')) {
      const st = document.createElement('style');
      st.id = 'faq-admin-css';
      st.textContent = `
        .faq-list li { align-items: flex-start; }
        .faq-list li.off .faq-main { opacity: .5; }
        .faq-main { flex: 1; min-width: 0; }
        .faq-q { font-weight: 600; }
        .faq-a { color: var(--text-dim); font-size: 13px; margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .faq-kh { color: var(--text-dim); font-size: 13px; margin-top: 2px; }
        .faq-side { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
      `;
      document.head.append(st);
    }

    let faqs = [];
    const newBtn = h('button', { class: 'btn-primary', type: 'button', onclick: () => faqModal(null) }, 'New question');
    const list = h('ul', { class: 'cat-list faq-list' });
    const empty = h('p', { class: 'empty hidden' }, 'No questions yet.');
    el.replaceChildren(
      h('div', { class: 'toolbar' }, h('p', { class: 'hint intro' }, 'Questions shown on the public FAQ page. Drag ⠿ to change the order. Use the switch to hide one without deleting it.'), newBtn),
      h('div', { class: 'card cat-card' }, list, empty));

    async function reload() { faqs = await api('/faq/all'); render(); }

    function sw(f) {
      const b = h('button', { class: `switch${f.active ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(f.active), 'aria-label': `Show "${f.question_en}" on the FAQ page`, title: f.active ? 'Visible' : 'Hidden' }, h('span', { class: 'knob' }));
      b.addEventListener('click', guard(async () => {
        const next = !f.active;
        await api(`/faq/${f.id}`, 'PATCH', { active: next });
        f.active = next; render(); notify(next ? 'Question is now visible' : 'Question is now hidden');
      }));
      return b;
    }

    function render() {
      empty.classList.toggle('hidden', faqs.length > 0);
      list.replaceChildren(...faqs.map((f) => h('li', { 'data-id': f.id, class: f.active ? '' : 'off' },
        grip(`question ${f.question_en}`),
        h('div', { class: 'faq-main' },
          h('div', { class: 'faq-q' }, f.question_en),
          f.question_kh ? h('div', { class: 'faq-kh' }, f.question_kh) : '',
          h('div', { class: 'faq-a' }, f.answer_en)),
        h('div', { class: 'faq-side' },
          sw(f),
          h('div', { class: 'row-actions', style: 'opacity:1' },
            h('button', { class: 'btn-ghost small', type: 'button', onclick: () => faqModal(f) }, 'Edit'),
            h('button', { class: 'btn-ghost small danger', type: 'button', onclick: () => confirmModal('Delete question', `Delete "${f.question_en}"?`, 'Delete', async () => {
              await api(`/faq/${f.id}`, 'DELETE'); notify('Question deleted'); await reload();
            }) }, 'Delete'))))));
    }

    sortable(list, async (ids) => {
      try {
        await api('/faq/reorder', 'PATCH', { ids });
        faqs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        notify('Order saved');
      } catch (e) { notify(e.message, false); await reload(); }
    });

    function faqModal(f) {
      const g = (id) => document.getElementById(id);
      const body = h('form', { onsubmit: (e) => e.preventDefault() },
        h('label', { for: 'f-qen' }, 'Question (English)'), h('input', { id: 'f-qen', value: f?.question_en ?? '', maxlength: 300, required: true }),
        h('label', { for: 'f-qkh' }, 'Question (Khmer)'), h('input', { id: 'f-qkh', value: f?.question_kh ?? '', maxlength: 300 }),
        h('label', { for: 'f-aen' }, 'Answer (English)'), h('textarea', { id: 'f-aen', rows: 4, maxlength: 4000, required: true }, f?.answer_en ?? ''),
        h('label', { for: 'f-akh' }, 'Answer (Khmer)'), h('textarea', { id: 'f-akh', rows: 4, maxlength: 4000 }, f?.answer_kh ?? ''),
        h('label', { style: 'margin-top:10px;display:flex;gap:8px;align-items:center' },
          h('input', { id: 'f-active', type: 'checkbox', ...((f?.active ?? true) ? { checked: true } : {}) }), 'Visible on the FAQ page'));
      const save = h('button', { class: 'btn-primary', type: 'button', onclick: guard(async () => {
        const payload = {
          question_en: g('f-qen').value, question_kh: g('f-qkh').value || null,
          answer_en: g('f-aen').value, answer_kh: g('f-akh').value || null,
          active: g('f-active').checked,
        };
        await (f ? api(`/faq/${f.id}`, 'PATCH', payload) : api('/faq', 'POST', payload));
        closeModal(); notify(f ? 'Question saved' : 'Question added'); await reload();
      }) }, 'Save');
      openModal(f ? 'Edit question' : 'New question', body, [cancelBtn(), save]);
      setTimeout(() => g('f-qen').focus(), 0);
    }

    await reload();
  },
});
