// public/js/view-sales.js
document.addEventListener("DOMContentLoaded", () => {
  const ordersContainer = document.getElementById("ordersContainer");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const loading = document.getElementById("loading");
  const errorBox = document.getElementById("errorBox");
  const summaryText = document.getElementById("summaryText");

  let currentUser = "";
  let orders = [];

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) { currentUser = ""; return; }
      const p = await res.json();
      currentUser = p.username || "";
    } catch (err) { currentUser = ""; }
  }

  async function loadOrders() {
    loading.style.display = "block";
    errorBox.style.display = "none";
    try {
      const res = await fetch("/api/orders/my", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        ordersContainer.innerHTML = `<div class="empty-box">${esc(j.error || "Could not load orders.")}</div>`;
        loading.style.display = "none";
        return;
      }
      orders = await res.json();
      render();
    } catch (err) {
      console.error(err);
      ordersContainer.innerHTML = `<div class="empty-box">Error loading sales.</div>`;
    } finally { loading.style.display = "none"; }
  }

  function filterOrders() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const status = statusFilter.value;

    return orders.filter(o => {
      // only seller's orders (sales)
      if (o.seller !== currentUser) return false;

      if (status && o.status !== status) return false;

      if (!q) return true;

      // search fields: buyer username, item title
      const title = (o.itemSnapshot?.title || "").toLowerCase();
      const buyer = (o.buyer || "").toLowerCase();

      return title.includes(q) || buyer.includes(q);
    });
  }

  function render() {
    const filtered = filterOrders();
    summaryText.textContent = `${filtered.length} sale(s) found`;

    if (!filtered.length) {
      ordersContainer.innerHTML = `<div class="empty-box">No sales found.</div>`;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "orders-list";

    filtered.forEach(order => {
      const card = document.createElement("div");
      card.className = "order-card";

      const left = document.createElement("div");
      left.className = "order-left";

      const img = document.createElement("img");
      img.className = "order-thumb";
      img.src = order.itemSnapshot?.imageUrl || "images/usb.jpg";
      img.alt = esc(order.itemSnapshot?.title || "item");

      const info = document.createElement("div");
      info.className = "order-info";
      info.innerHTML = `
        <div style="font-weight:800">${esc(order.itemSnapshot?.title || "Item")}</div>
        <div class="order-meta">₱${order.itemSnapshot?.price ?? ""} • Buyer: ${esc(order.buyer)}</div>
        <div class="order-meta">Order ID: ${esc(order._id)}</div>
      `;

      left.appendChild(img);
      left.appendChild(info);

      const right = document.createElement("div");
      right.className = "order-actions";

      const status = document.createElement("div");
      status.className = "status-pill " + (order.status === "completed" ? "status-completed" : "status-pending");
      status.textContent = order.status === "completed" ? "Completed" : "Pending";
      right.appendChild(status);

      const isSeller = order.seller === currentUser;

      // seller actions
      if (order.status === "pending" && isSeller) {
        if (!order.meetupConfirmedBySeller) {
          const soldBtn = document.createElement("button");
          soldBtn.className = "btn primary";
          soldBtn.textContent = "Item Sold";
          soldBtn.onclick = () => confirmOrder(order._id);
          right.appendChild(soldBtn);
        }
      }

      const viewBtn = document.createElement("button");
      viewBtn.className = "btn ghost";
      viewBtn.textContent = "View Item";
      viewBtn.onclick = () => (window.location.href = "item.html?id=" + encodeURIComponent(order.itemId));
      right.appendChild(viewBtn);

      card.appendChild(left);
      card.appendChild(right);
      wrapper.appendChild(card);
    });

    ordersContainer.innerHTML = "";
    ordersContainer.appendChild(wrapper);
  }

  async function confirmOrder(orderId) {
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST", credentials: "include" });
      const j = await res.json();
      if (!res.ok) return alert(j.error || "Failed to confirm");
      await loadOrders();
    } catch (err) {
      alert("Error confirming order");
    }
  }

  // event listeners
  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  // load
  (async () => {
    await fetchCurrentUser();
    await loadOrders();
  })();
});
