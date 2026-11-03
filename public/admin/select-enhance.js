// Wraps a native <select> with a fully custom-rendered dropdown, so the open menu looks
// identical in every browser (a native select's open popup is OS-drawn and can't be styled).
// The original <select> stays in the DOM (hidden) as the source of truth: its .value stays
// in sync, and it still dispatches 'change' events — so any existing code that reads
// select.value or listens for 'change' keeps working with zero other changes.
//
// Replacing the native control also means reimplementing the keyboard/screen-reader
// behavior it gave away for free: the trigger exposes role="combobox" over the options
// listbox (aria-haspopup/aria-expanded/aria-controls), the open menu is a real
// role="listbox", and Up/Down/Home/End/Enter/Escape all work while it's open.
function enhanceSelect(select) {
  if (!select || select.dataset.enhanced === 'true') return;
  select.dataset.enhanced = 'true';

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (select.disabled) trigger.disabled = true;
  linkTriggerToOwnLabel(select, trigger);

  // Hide the native select from the accessibility tree only after linkTriggerToOwnLabel
  // has had a chance to read its id — order doesn't actually matter here since that helper
  // never inspects .custom-select-native, but keeping the class add next to the other
  // "make it inert" step below documents that relationship for later edits.
  select.classList.add('custom-select-native');

  wrapper.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu hidden';
  menu.setAttribute('role', 'listbox');
  const menuId = select.id ? `${select.id}-listbox` : `custom-select-listbox-${Math.random().toString(36).slice(2)}`;
  menu.id = menuId;
  trigger.setAttribute('aria-controls', menuId);
  wrapper.appendChild(menu);

  let activeIndex = -1;

  function optionId(i) {
    return `${menuId}-option-${i}`;
  }

  function renderMenu() {
    menu.innerHTML = '';
    Array.from(select.options).forEach((opt, i) => {
      const item = document.createElement('div');
      item.id = optionId(i);
      item.className = 'custom-select-option' + (i === select.selectedIndex ? ' selected' : '');
      item.textContent = opt.textContent;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', i === select.selectedIndex ? 'true' : 'false');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        chooseIndex(i);
      });
      item.addEventListener('mouseenter', () => setActive(i));
      menu.appendChild(item);
    });
  }

  function setActive(i) {
    if (i < 0 || i >= select.options.length) return;
    activeIndex = i;
    Array.from(menu.children).forEach((el, idx) => el.classList.toggle('active', idx === i));
    trigger.setAttribute('aria-activedescendant', optionId(i));
    menu.children[i]?.scrollIntoView({ block: 'nearest' });
  }

  function chooseIndex(i) {
    const opt = select.options[i];
    if (!opt) return;
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeMenu();
  }

  function syncTrigger() {
    const selected = select.options[select.selectedIndex];
    trigger.textContent = selected ? selected.textContent : '';
  }

  function openMenu() {
    closeAllCustomSelects();
    renderMenu();
    menu.classList.remove('hidden');
    trigger.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    setActive(select.selectedIndex >= 0 ? select.selectedIndex : 0);

    // Flip the menu to open upward instead of downward if there isn't enough room below
    // within the nearest scrollable/clipping ancestor (e.g. a table's last row has no
    // table content left below it, so the menu would otherwise get cut off by
    // .table-scroll's clipping rather than actually fitting on screen).
    menu.classList.remove('menu-flip-up');
    const boundary = findClippingAncestor(wrapper);
    const boundaryRect = boundary ? boundary.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.getBoundingClientRect().height;
    const spaceBelow = boundaryRect.bottom - triggerRect.bottom;
    const spaceAbove = triggerRect.top - boundaryRect.top;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      menu.classList.add('menu-flip-up');
    }
  }

  function closeMenu() {
    menu.classList.add('hidden');
    trigger.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    syncTrigger();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.disabled) return;
    menu.classList.contains('hidden') ? openMenu() : closeMenu();
  });

  trigger.addEventListener('keydown', (e) => {
    const isOpen = !menu.classList.contains('hidden');
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        isOpen ? setActive(Math.min(activeIndex + 1, select.options.length - 1)) : openMenu();
        break;
      case 'ArrowUp':
        e.preventDefault();
        isOpen ? setActive(Math.max(activeIndex - 1, 0)) : openMenu();
        break;
      case 'Home':
        if (isOpen) { e.preventDefault(); setActive(0); }
        break;
      case 'End':
        if (isOpen) { e.preventDefault(); setActive(select.options.length - 1); }
        break;
      case 'Enter':
      case ' ':
        // When closed, the button's own default action already fires 'click' (which opens
        // the menu) for both keys — nothing to add. When open, commit the active option.
        if (isOpen) {
          e.preventDefault();
          chooseIndex(activeIndex);
        }
        break;
      case 'Escape':
        if (isOpen) { e.preventDefault(); closeMenu(); }
        break;
      case 'Tab':
        if (isOpen) closeMenu();
        break;
    }
  });

  // If code elsewhere sets select.value directly (e.g. pre-filling an edit form), reflect it.
  select.addEventListener('change', syncTrigger);

  syncTrigger();
}

// Nearest ancestor that would actually clip an overflowing absolutely-positioned child
// (e.g. .table-scroll, which sets overflow-x: auto — per the CSS spec this forces
// overflow-y to compute as auto too, so anything extending past its bottom edge gets cut
// off even though nothing about it looks like a "scroll box" at a glance).
function findClippingAncestor(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select-menu').forEach((m) => m.classList.add('hidden'));
  document.querySelectorAll('.custom-select-trigger').forEach((t) => {
    t.classList.remove('open');
    t.setAttribute('aria-expanded', 'false');
    t.removeAttribute('aria-activedescendant');
  });
}

document.addEventListener('click', closeAllCustomSelects);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllCustomSelects();
});

// Copied from the dashboard's app.js: points the visible trigger at the field's existing <label>.
function linkTriggerToOwnLabel(nativeControl, trigger) {
  // A select/input authored with aria-label instead of a <label> (e.g. a compact,
  // repeated field-builder row with no room for a visible label) — just copy it straight
  // across, no <label> element exists to click-forward.
  const ariaLabel = nativeControl.getAttribute('aria-label');
  if (ariaLabel) {
    trigger.setAttribute('aria-label', ariaLabel);
    return;
  }
  // Already pointed at a label by id (e.g. a timestamp field's shared date+time label —
  // see custom-tables.js) rather than a <label for> — same idea, just already resolved.
  const existingLabelledby = nativeControl.getAttribute('aria-labelledby');
  if (existingLabelledby) {
    trigger.setAttribute('aria-labelledby', existingLabelledby);
    return;
  }
  if (!nativeControl.id) return;
  const ownLabel = document.querySelector(`label[for="${CSS.escape(nativeControl.id)}"]`);
  if (!ownLabel) return;
  if (!ownLabel.id) ownLabel.id = `${nativeControl.id}-label`;
  trigger.setAttribute('aria-labelledby', ownLabel.id);
  ownLabel.addEventListener('click', (e) => {
    e.preventDefault();
    trigger.focus();
  });
}
