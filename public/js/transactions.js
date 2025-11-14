// public/js/transactions.js
// Fetch and render user's transactions (purchase history)

(function() {
  const tableWrap = document.getElementById('tableWrap');
  const loadingEl = document.getElementById('loading');
  const errorBox = document.getElementById('errorBox');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const paginationEl = document.getElementById('pagination');
  const summaryText = document.getElementById('summaryText');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  // state
  let transactions = []; // full dataset
  let filtered = [];
  let page = 1;
  const perPage = 8;

  function showLoading(show=true) {
    loadingEl.style.display = show ? 'block' : 'none';
  }
  function showError(msg='') {
    if (!msg) { errorBox.style.display = 'none'; errorBox.textContent = ''; }
    else { errorBox.style.display = 'block'; errorBox.textContent = msg; }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function formatPrice(p) {
    return Number(p).toLocaleString(undefined, { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
  }

  function statusClass(status) {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'completed') return 'status-paid';
    if (s === 'cancelled' || s === 'canceled') return 'status-cancelled';
    return 'status-pending';
  }

  function renderTable(pageNum=1) {
    page = pageNum;
    const start = (page-1)*perPage;
    const pageItems = filtered.slice(start, start+perPage);

    if (!pageItems.length) {
      tableWrap.innerHTML = `<div class="empty-box">No transactions found.</div>`;
      paginationEl.innerHTML = '';
      summaryText.textContent = `Showing 0 of ${filtered.length}`;
      return;
    }

    let html = `<table class="transactions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Seller</th>
          <th>Price</th>
          <th>Status</th>
          <th style="width:120px">Actions</th>
        </tr>
      </thead>
      <tbody>`;

    for (const tx of pageItems) {
      html += `<tr data-id="${tx._id ?? tx.id ?? ''}">
        <td>${formatDate(tx.createdAt ?? tx.date ?? tx.timestamp ?? '')}</td>
        <td style="font-weight:700">${escapeHtml(tx.title ?? tx.item ?? '')}</td>
        <td>${escapeHtml(tx.seller ?? tx.sellerName ?? tx.username ?? '')}</td>
        <td>${formatPrice(tx.price ?? tx.amount ?? 0)}</td>
        <td><span class="status-pill ${statusClass(tx.status)}">${escapeHtml(tx.status ?? 'pending')}</span></td>
        <td>
          <button class="action-btn view-btn" data-id="${tx._id ?? tx.id ?? ''}"><i class="fa-solid fa-eye"></i>&nbsp;View</button>
        </td>
      </tr>`;
    }

    html += `</tbody></table>`;
    tableWrap.innerHTML = html;

    // summary & pagination
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    summaryText.textContent = `Showing ${Math.min(total, start+1)}–${Math.min(total, start+pageItems.length)} of ${total}`;

    // pagination controls
    let pgHtml = '';
    if (pages > 1) {
      // prev
      pgHtml += `<button class="page-btn" data-page="${Math.max(1,page-1)}">&laquo;</button>`;
      for (let i=1;i<=pages;i++) {
        pgHtml += `<button class="page-btn ${i===page? 'active':''}" data-page="${i}">${i}</button>`;
        if (i>=8 && i < pages-1 && pages>10) { pgHtml += `<span style="color:rgba(230,240,255,0.7);padding:0 8px">...</span>`; i = pages-2; }
      }
      // next
      pgHtml += `<button class="page-btn" data-page="${Math.min(pages,page+1)}">&raquo;</button>`;
    }
    paginationEl.innerHTML = pgHtml;

    // hook pagination
    paginationEl.querySelectorAll('.page-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> {
        const p = Number(btn.dataset.page || 1);
        renderTable(p);
      });
    });

    // hook view buttons
    tableWrap.querySelectorAll('.view-btn').forEach(b=>{
      b.addEventListener('click', (e)=>{
        const id = b.dataset.id;
        const tx = transactions.find(t => String(t._id ?? t.id ?? '') === String(id));
        if (tx) openModal(tx);
        else console.debug('transaction not found for id', id);
      });
    });
  }

  // simple XSS-safe text escaper
  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function openModal(tx) {
    const mb = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    title.textContent = `Transaction — ${tx.title ?? tx.item ?? tx._id ?? ''}`;
    // build details
    let html = '';
    html += `<div class="row"><div><strong>Item</strong><div>${escapeHtml(tx.title ?? tx.item ?? '')}</div></div><div><strong>Price</strong><div>${formatPrice(tx.price ?? tx.amount ?? 0)}</div></div></div>`;
    html += `<div class="row"><div><strong>Seller</strong><div>${escapeHtml(tx.seller ?? tx.sellerName ?? '')}</div></div><div><strong>Date</strong><div>${formatDate(tx.createdAt ?? tx.date ?? '')}</div></div></div>`;
    html += `<div class="row"><div style="flex:1"><strong>Status</strong><div><span class="status-pill ${statusClass(tx.status)}">${escapeHtml(tx.status ?? 'pending')}</span></div></div><div style="flex:1"><strong>Contact</strong><div>${escapeHtml(tx.contact ?? tx.sellerContact ?? '')}</div></div></div>`;
    html += `<div style="margin-top:12px"><strong>Description</strong><div style="margin-top:6px;color:#34495e;background:#f6f8fa;padding:10px;border-radius:6px;">${escapeHtml(tx.description ?? tx.note ?? '')}</div></div>`;

    mb.innerHTML = html;
    const backdrop = document.getElementById('modalBackdrop');
    backdrop.style.display = 'flex';
    backdrop.setAttribute('aria-hidden','false');
  }

  function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    backdrop.style.display = 'none';
    backdrop.setAttribute('aria-hidden','true');
  }

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });

  // Apply filters & search to transactions
  function applyFilters() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const status = (statusFilter.value || '').toLowerCase();

    filtered = transactions.filter(tx => {
      let ok = true;
      if (status) ok = (String(tx.status || '').toLowerCase() === status);
      if (!ok) return false;

      if (!q) return true;
      const hay = `${tx.title ?? ''} ${tx.seller ?? tx.sellerName ?? ''} ${tx.description ?? ''}`.toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    renderTable(1);
  }

  // Export visible (filtered) set as CSV
  function exportCsv() {
    const rows = [['Date','Item','Seller','Price','Status','Description']];
    for (const tx of filtered) {
      rows.push([
        formatDate(tx.createdAt ?? tx.date ?? ''),
        (tx.title ?? tx.item ?? '').replaceAll('"','""'),
        (tx.seller ?? tx.sellerName ?? '').replaceAll('"','""'),
        (tx.price ?? tx.amount ?? 0),
        tx.status ?? '',
        (tx.description ?? tx.note ?? '').replaceAll('"','""')
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  exportCsvBtn.addEventListener('click', exportCsv);

  // Fetch transactions from /api/transactions
  async function loadTransactions() {
    showError('');
    showLoading(true);
    tableWrap.innerHTML = '';
    try {
      const res = await fetch('/api/transactions', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 401) {
          showError('Not authenticated. Please login.');
          showLoading(false);
          return;
        }
        const err = await res.json().catch(()=>({}));
        showError(err.error || `Failed to load transactions (status ${res.status})`);
        showLoading(false);
        return;
      }
      const data = await res.json().catch(()=>[]);
      // ensure array
      transactions = Array.isArray(data) ? data : (data.transactions || []);
      // normalise date fields to ISO if possible
      transactions = transactions.map(t => {
        if (!t.createdAt && t.date) t.createdAt = t.date;
        return t;
      });
      applyFilters();
    } catch (err) {
      console.error('Error fetching transactions', err);
      showError('Network error while fetching transactions.');
    } finally {
      showLoading(false);
    }
  }

  // initial attach listeners
  searchInput.addEventListener('input', ()=> {
    // debounce a bit
    clearTimeout(searchInput._deb);
    searchInput._deb = setTimeout(()=> applyFilters(), 220);
  });

  statusFilter.addEventListener('change', ()=> applyFilters());

  // on DOMContentLoaded, load data
  document.addEventListener('DOMContentLoaded', () => {
    loadTransactions();
  });

  // If DOM already loaded earlier
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(loadTransactions, 10);
  }

})();
