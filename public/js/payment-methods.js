// public/js/payment-methods.js
document.addEventListener('DOMContentLoaded', function () {
  // small defensive boot: ensure container exists
  const pmListEl = document.getElementById('pmList');
  if (!pmListEl) {
    console.error('[payment-methods.js] #pmList element not found. Did you open the right HTML?');
    return;
  }

  // keep other element refs
  const pmEmpty = document.getElementById('pmEmpty');
  const pmSummary = document.getElementById('pmSummary');
  const addBtn = document.getElementById('addMethodBtn');
  const modalBackdrop = document.getElementById('pmModalBackdrop');
  const modalTitle = document.getElementById('pmModalTitle');
  const pmForm = document.getElementById('pmForm');
  const pmModalClose = document.getElementById('pmModalClose');
  const pmCancel = document.getElementById('pmCancel');
  const pmType = document.getElementById('pmType');
  const pmLabel = document.getElementById('pmLabel');
  const pmNumber = document.getElementById('pmNumber');
  const pmExpiry = document.getElementById('pmExpiry');
  const pmAccount = document.getElementById('pmAccount');
  const cardFields = document.getElementById('cardFields');
  const walletFields = document.getElementById('walletFields');

  if (!pmForm) {
    console.error('[payment-methods.js] #pmForm not found — the modal markup must exist in HTML.');
  }

  let methods = [];
  let editingId = null;

  function renderList() {
    pmListEl.innerHTML = '';
    if (!methods.length) {
      pmEmpty.style.display = 'block';
      pmSummary.textContent = '';
      return;
    }
    pmEmpty.style.display = 'none';
    pmSummary.textContent = `${methods.length} saved method${methods.length === 1 ? '' : 's'}`;

    methods.forEach(m => {
      const card = document.createElement('div');
      card.className = 'pm-card';
      card.dataset.id = m.id ?? m._id ?? m.key ?? '';
      const left = document.createElement('div'); left.className = 'pm-left-side';
      const icon = document.createElement('div'); icon.className = 'pm-icon';
      icon.innerHTML = (function (t) {
        switch ((t||'').toLowerCase()) {
          case 'card': return '<i class="fa-solid fa-credit-card"></i>';
          case 'gcash': return '<i class="fa-solid fa-mobile-screen-button"></i>';
          case 'paymaya': return '<i class="fa-solid fa-wallet"></i>';
          case 'bank': return '<i class="fa-solid fa-building-columns"></i>';
          default: return '<i class="fa-solid fa-credit-card"></i>';
        }
      })(m.type);
      const details = document.createElement('div'); details.className = 'pm-details';
      const title = document.createElement('div'); title.className = 'pm-title';
      title.textContent = m.label || (m.type || '').toUpperCase();
      const sub = document.createElement('div'); sub.className = 'pm-sub';
      if ((m.type || '').toLowerCase() === 'card') sub.textContent = `•••• ${String(m.number || '').slice(-4)} • ${m.holder || ''}`;
      else sub.textContent = m.account || m.number || '';
      details.appendChild(title); details.appendChild(sub);
      left.appendChild(icon); left.appendChild(details);

      const actions = document.createElement('div'); actions.className = 'pm-actions';

      if (m.primary) {
        const badge = document.createElement('div'); badge.className = 'pm-primary'; badge.textContent = 'Primary';
        actions.appendChild(badge);
      } else {
        const setBtn = document.createElement('button'); setBtn.className = 'pm-action-btn'; setBtn.textContent = 'Set Primary';
        setBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setPrimary(m); });
        actions.appendChild(setBtn);
      }

      const editBtn = document.createElement('button'); editBtn.className = 'pm-action-btn'; editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
      editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openEdit(m); });
      const delBtn = document.createElement('button'); delBtn.className = 'pm-action-btn'; delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteMethod(m); });

      actions.appendChild(editBtn); actions.appendChild(delBtn);
      card.appendChild(left); card.appendChild(actions);
      card.addEventListener('click', () => setPrimary(m));
      pmListEl.appendChild(card);
    });
  }

  function seedDemo() {
    methods = [
      { id: '1', type: 'card', label: 'Personal Visa', number: '4242424242424242', expiry: '08/27', holder: 'C. R.', primary: true },
      { id: '2', type: 'gcash', label: 'GCash - Main', account: '09171234567' }
    ];
    renderList();
  }

  async function loadMethods() {
    try {
      const res = await fetch('/api/payment-methods', { credentials: 'same-origin' });
      if (!res.ok) {
        console.debug('[pm] /api/payment-methods not available or returned', res.status);
        seedDemo();
        return;
      }
      const data = await res.json();
      methods = Array.isArray(data) ? data : (data.methods || []);
      if (!methods.length) seedDemo();
      renderList();
    } catch (err) {
      console.debug('[pm] network error loading payment-methods', err);
      seedDemo();
    }
  }

  async function saveMethod(payload) {
    try {
      if (editingId) {
        const res = await fetch(`/api/payment-methods/${editingId}`, {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          methods = methods.map(m => (m.id == editingId || m._id == editingId) ? { ...m, ...payload } : m);
          renderList();
          return;
        }
      } else {
        const res = await fetch('/api/payment-methods', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json().catch(() => null);
          const obj = created && (created.method || created) ? (created.method || created) : { ...payload, id: String(Date.now()) };
          methods.unshift(obj);
          renderList();
          return;
        }
      }
    } catch (err) {
      console.debug('[pm] API op failed, falling back to local', err);
    }

    if (editingId) {
      methods = methods.map(m => (m.id == editingId || m._id == editingId) ? { ...m, ...payload } : m);
    } else {
      methods.unshift({ ...payload, id: String(Date.now()) });
    }
    renderList();
  }

  async function deleteMethod(m) {
    if (!confirm('Delete this payment method?')) return;
    try {
      const id = m.id ?? m._id ?? m.key;
      const res = await fetch(`/api/payment-methods/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) { methods = methods.filter(x => (x.id || x._id || x.key) !== id); renderList(); return; }
    } catch (err) { /* ignore */ }
    methods = methods.filter(x => (x.id || x._id || x.key) !== (m.id || m._id || m.key));
    renderList();
  }

  async function setPrimary(m) {
    methods = methods.map(x => ({ ...x, primary: (x === m) }));
    renderList();
    try {
      const id = m.id ?? m._id ?? m.key;
      await fetch(`/api/payment-methods/${id}/primary`, { method: 'PUT', credentials: 'same-origin' });
    } catch (err) { /* ignore */ }
  }

  function openEdit(m) {
    editingId = m.id ?? m._id ?? m.key;
    modalTitle.textContent = 'Edit Payment Method';
    pmType.value = m.type || 'card';
    pmLabel.value = m.label || '';
    pmNumber.value = m.number || '';
    pmExpiry.value = m.expiry || '';
    pmAccount.value = m.account || '';
    pmType.dispatchEvent(new Event('change'));
    modalBackdrop.style.display = 'flex';
  }

  function closeModal() {
    editingId = null; pmForm.reset(); modalBackdrop.style.display = 'none';
  }

  pmType.addEventListener('change', () => {
    if (pmType.value === 'card') { cardFields.style.display = 'block'; walletFields.style.display = 'none'; }
    else { cardFields.style.display = 'none'; walletFields.style.display = 'block'; }
  });

  pmForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      type: pmType.value,
      label: pmLabel.value.trim(),
      number: pmNumber.value.trim(),
      expiry: pmExpiry.value.trim(),
      account: pmAccount.value.trim()
    };
    saveMethod(payload);
    closeModal();
  });

  addBtn.addEventListener('click', () => { modalTitle.textContent = 'Add Payment Method'; pmForm.reset(); pmType.dispatchEvent(new Event('change')); modalBackdrop.style.display = 'flex'; });
  pmModalClose.addEventListener('click', closeModal);
  pmCancel.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  // init load
  loadMethods();
});
