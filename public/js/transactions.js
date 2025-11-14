// public/js/transactions.js
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("tableWrap") || document.getElementById("transactionsContainer") || document.body;
  const loading = document.getElementById("loading");
  const errorBox = document.getElementById("errorBox");

  function esc(s='') { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'); }

  async function loadOrders() {
    if (loading) loading.style.display = '';
    try {
      const res = await fetch('/api/orders/my', { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(()=>({error:""}));
        if (errorBox) { errorBox.style.display=''; errorBox.textContent = j.error || 'Failed to load orders'; }
        return;
      }
      const orders = await res.json();
      renderOrders(orders);
    } catch (err) {
      console.error(err);
      if (errorBox) { errorBox.style.display=''; errorBox.textContent = 'Error loading orders'; }
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  function renderOrders(orders) {
    // If your transactions page expects a table, we will create a simple table display
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '12px';

    if (!orders || orders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-box';
      empty.textContent = 'No transactions yet.';
      wrapper.appendChild(empty);
    } else {
      orders.forEach(order => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.background = 'rgba(255,255,255,0.03)';
        row.style.padding = '12px';
        row.style.borderRadius = '8px';
        row.style.border = '1px solid rgba(255,255,255,0.04)';

        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.gap = '12px';
        left.style.alignItems = 'center';

        const img = document.createElement('img');
        img.src = order.itemSnapshot?.imageUrl || 'images/usb.jpg';
        img.style.width = '84px';
        img.style.height = '64px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';

        const info = document.createElement('div');
        info.innerHTML = `<div style="font-weight:800">${esc(order.itemSnapshot?.title || 'Item')}</div>
                          <div style="font-size:13px;color:#ccc">₱${order.itemSnapshot?.price ?? ''} • ${esc(order.status)}</div>
                          <div style="font-size:12px;color:#999">Seller: ${esc(order.seller)} • Buyer: ${esc(order.buyer)}</div>`;

        left.appendChild(img);
        left.appendChild(info);

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.flexDirection = 'column';
        right.style.alignItems = 'flex-end';
        right.style.gap = '8px';

        const role = (order.buyer === window.__CURRENT_USERNAME__) ? 'buyer' : ((order.seller === window.__CURRENT_USERNAME__) ? 'seller' : 'viewer');

        // Build actions depending on role & status
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';

        // Show a view button to go to item
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.textContent = 'View Item';
        viewBtn.addEventListener('click', () => {
          const id = order.itemId ?? (order.itemId && String(order.itemId)) ?? order.itemSnapshot?._id ?? '';
          window.location.href = `item.html?id=${encodeURIComponent(id)}`;
        });
        actions.appendChild(viewBtn);

        if (order.status === 'pending') {
          if (order.buyer === window.__CURRENT_USERNAME__) {
            // buyer actions
            if (!order.meetupConfirmedByBuyer) {
              const btn = document.createElement('button');
              btn.className = 'action-btn';
              btn.textContent = 'I Received Item';
              btn.addEventListener('click', async () => {
                await confirmOrder(order._id);
              });
              actions.appendChild(btn);
            } else {
              const info = document.createElement('div'); info.style.color = '#9ad'; info.textContent = 'You confirmed';
              actions.appendChild(info);
            }
          } else if (order.seller === window.__CURRENT_USERNAME__) {
            // seller actions
            if (!order.meetupConfirmedBySeller) {
              const btn = document.createElement('button');
              btn.className = 'action-btn';
              btn.textContent = 'Item Sold';
              btn.addEventListener('click', async () => {
                await confirmOrder(order._id);
              });
              actions.appendChild(btn);
            } else {
              const info = document.createElement('div'); info.style.color = '#9ad'; info.textContent = 'You confirmed';
              actions.appendChild(info);
            }
          } else {
            // neither buyer nor seller (shouldn't happen often)
          }
        } else if (order.status === 'completed') {
          const done = document.createElement('div');
          done.style.color = '#bff0b8';
          done.style.fontWeight = '800';
          done.textContent = 'Completed';
          actions.appendChild(done);
        } else if (order.status === 'cancelled') {
          const c = document.createElement('div'); c.style.color='#ffb8b8'; c.textContent='Cancelled'; actions.appendChild(c);
        }

        right.appendChild(actions);

        row.appendChild(left);
        row.appendChild(right);

        wrapper.appendChild(row);
      });
    }

    // replace existing tableWrap or show below
    if (container) {
      container.innerHTML = '';
      container.appendChild(wrapper);
    } else {
      document.body.appendChild(wrapper);
    }
  }

  async function confirmOrder(orderId) {
    try {
      const resp = await fetch(`/api/orders/${encodeURIComponent(orderId)}/confirm`, {
        method: 'POST',
        credentials: 'include'
      });
      const j = await resp.json();
      if (!resp.ok) return alert(j.error || 'Failed to confirm');
      // reload
      await loadOrders();
    } catch (err) {
      console.error(err);
      alert('Error confirming order');
    }
  }

  // try to fetch current username to help UI decisions (non-blocking)
  (async function setCurrentUser() {
    try {
      const r = await fetch('/api/profile', { credentials: 'include' });
      if (r.ok) {
        const p = await r.json();
        window.__CURRENT_USERNAME__ = p.username || '';
      } else {
        window.__CURRENT_USERNAME__ = '';
      }
    } catch (e) {
      window.__CURRENT_USERNAME__ = '';
    } finally {
      // now load orders
      loadOrders();
    }
  })();

});
