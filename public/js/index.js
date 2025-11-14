// js/index.js
// Global navbar + auth UI + create-listing visibility + safe dropdown positioning + listings loader
// Keeps behavior consistent across pages (index, add-item, profile, etc.)

document.addEventListener("DOMContentLoaded", () => {
  /* ========= Utilities ========= */
  function escapeHTML(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const nav = document.querySelector(".navLinks") || document.body;

  /* ========= Create New Listing toggle ========= */
  function toggleCreateListing(visible) {
    const createBtn = document.querySelector(".createNewListingBtn");
    if (!createBtn) return;
    // createNewListingBtn is wrapped by an <a> in markup; handle both cases
    const wrapper = createBtn.closest("a") || createBtn;
    wrapper.style.display = visible ? "" : "none";
  }

  /* ========= Ensure loginbtn & user-dropdown exist (do not overwrite if present) ========= */
  let loginBtn = document.querySelector(".loginbtn");
  if (!loginBtn) {
    loginBtn = document.createElement("div");
    loginBtn.className = "loginbtn";
    nav.appendChild(loginBtn);
  }

  // Only create a user-dropdown if none exists. If markup already exists, keep it.
  let userDropdown = document.querySelector(".user-dropdown");
  if (!userDropdown) {
    userDropdown = document.createElement("div");
    userDropdown.className = "user-dropdown logged-out";

    userDropdown.innerHTML = `
      <div class="user-summary">
        <div class="loginbtn-placeholder"></div>
        <img class="userPic" src="images/userPic.jpg" alt="user pic">
      </div>
      <div class="user-dropdown-content hidden" style="display:none;">
        <a href="index.html">Dashboard</a>
        <a href="profile.html">My Profile</a>
        <a href="#">Settings</a>
        <a href="#" id="logoutLink">Logout</a>
      </div>
    `;
    nav.appendChild(userDropdown);
  } else {
    // If the dropdown exists in HTML but lacks Dashboard, ensure Dashboard is present (non-destructive)
    try {
      const existingContent = userDropdown.querySelector(".user-dropdown-content");
      if (existingContent && !/Dashboard/i.test(existingContent.innerText)) {
        const dashboardLink = document.createElement("a");
        dashboardLink.href = "index.html";
        dashboardLink.textContent = "Dashboard";
        existingContent.insertBefore(dashboardLink, existingContent.firstChild);
      }
    } catch (e) {
      // ignore unexpected structure
    }
  }

  // Re-query after possible creation
  const userPic = document.querySelector(".userPic");
  const userDropdownContent = document.querySelector(".user-dropdown-content");

  /* ========= Sign-in anchor helper ========= */
  function makeSigninAnchor() {
    const a = document.createElement("a");
    a.href = "login-register.html";
    a.id = "signinLink";
    a.textContent = "Sign in / Log in";
    a.setAttribute("role", "link");
    a.setAttribute("tabindex", "0");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "login-register.html";
    });
    return a;
  }

  /* ========= Logout handler ========= */
  function attachLogoutHandler() {
    let logout = document.getElementById("logoutLink");
    if (!logout) return;

    // ensure fresh handler
    logout.replaceWith(logout.cloneNode(true));
    logout = document.getElementById("logoutLink");
    if (!logout) return;

    logout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          resetLoggedOutUI();
          setTimeout(updateAuthUI, 150);
        } else {
          alert("Logout failed.");
        }
      } catch (err) {
        console.error("Logout error", err);
        alert("Error logging out.");
      }
    });
  }

  /* ========= Reset to logged-out UI ========= */
  function resetLoggedOutUI() {
    loginBtn.innerHTML = "";
    const a = makeSigninAnchor();
    loginBtn.appendChild(a);
    loginBtn.style.zIndex = "2147483647";
    loginBtn.style.pointerEvents = "auto";

    toggleCreateListing(false);

    if (userPic) {
      userPic.style.opacity = "1";
      userPic.style.pointerEvents = "none";
      userPic.style.cursor = "default";
      userPic.src = userPic.src || "images/userPic.jpg";
    }

    if (userDropdown) {
      userDropdown.classList.add("logged-out");
      userDropdown.classList.remove("open");
    }

    if (userDropdownContent) {
      userDropdownContent.classList.add("hidden");
      userDropdownContent.style.display = "none";
      userDropdownContent.style.removeProperty("left");
      userDropdownContent.style.removeProperty("top");
      userDropdownContent.style.removeProperty("position");
      userDropdownContent.style.removeProperty("visibility");
      userDropdownContent.style.removeProperty("maxWidth");
      userDropdownContent.style.removeProperty("width");
      userDropdownContent.style.removeProperty("boxSizing");
    }

    attachLogoutHandler();
  }

  /* ========= Update UI for authenticated user ========= */
  async function updateAuthUI() {
    try {
      const res = await fetch("/api/profile", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        resetLoggedOutUI();
        return;
      }

      const profile = await res.json();
      const username = profile.username || "Account";

      loginBtn.innerHTML = `<span class="welcome-text">Hi, ${escapeHTML(username)}</span>`;
      loginBtn.style.pointerEvents = "auto";
      loginBtn.style.zIndex = "2147483647";

      if (userPic) {
        userPic.style.opacity = "1";
        userPic.style.pointerEvents = "auto";
        userPic.style.cursor = "pointer";
        userPic.src = profile.avatar || userPic.src || "images/userPic.jpg";
      }

      if (userDropdown) {
        userDropdown.classList.remove("logged-out");
        userDropdown.classList.remove("open");
      }
      if (userDropdownContent) {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }

      toggleCreateListing(true);

      attachLogoutHandler();
    } catch (err) {
      console.error("Auth check failed", err);
      resetLoggedOutUI();
    }
  }

  /* ========= Dropdown positioning + sizing logic (compact menu) ========= */
  function openDropdownNearAvatar() {
    if (!userPic || !userDropdownContent) return;

    const rect = userPic.getBoundingClientRect();

    // Prepare for measurement: make visible but hidden to get accurate sizes
    userDropdownContent.style.position = "fixed";
    userDropdownContent.style.top = `${rect.bottom + 6}px`;
    userDropdownContent.style.left = `0px`; // temp
    userDropdownContent.style.display = "block";
    userDropdownContent.style.visibility = "hidden";
    userDropdownContent.classList.remove("hidden");

    // Enforce a compact max width to prevent full-stretch (matches compact menu)
    const COMPACT_MAX = 220; // px
    userDropdownContent.style.boxSizing = "border-box";
    userDropdownContent.style.maxWidth = `${COMPACT_MAX}px`;
    userDropdownContent.style.width = "auto";

    // measure
    const dropdownWidth = Math.min(userDropdownContent.offsetWidth || COMPACT_MAX, COMPACT_MAX);
    const dropdownHeight = userDropdownContent.offsetHeight || 120;

    // Align right edge of dropdown to avatar's right edge (compact look)
    let leftPos = Math.round(rect.right - dropdownWidth);

    // clamp inside viewport with 10px padding
    const minLeft = 10;
    const maxLeft = Math.max(10, window.innerWidth - dropdownWidth - 10);
    leftPos = Math.min(Math.max(leftPos, minLeft), maxLeft);

    // If dropdown would extend below viewport bottom, prefer above avatar
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < dropdownHeight + 12) {
      const topPos = rect.top - dropdownHeight - 6;
      if (topPos > 6) {
        userDropdownContent.style.top = `${topPos}px`;
      } // otherwise keep below
    } else {
      userDropdownContent.style.top = `${rect.bottom + 6}px`;
    }

    // Apply final position and reveal
    userDropdownContent.style.left = `${leftPos}px`;
    userDropdownContent.style.visibility = "visible";
    userDropdownContent.style.zIndex = "2147483647";
  }

  /* ========= Click handling to toggle dropdown ========= */
  document.addEventListener("click", (ev) => {
    if (!userDropdown || !userDropdownContent || !userPic) return;

    if (userDropdown.classList.contains("logged-out")) return;

    if (userPic.contains(ev.target)) {
      const open = userDropdown.classList.toggle("open");
      if (open) {
        openDropdownNearAvatar();
      } else {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }
      ev.stopPropagation();
      return;
    }

    if (!userDropdown.contains(ev.target)) {
      userDropdown.classList.remove("open");
      if (userDropdownContent) {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }
    }
  });

  /* ========= Keyboard accessibility: close on Escape ========= */
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (userDropdown) userDropdown.classList.remove("open");
      if (userDropdownContent) {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }
    }
  });

  /* ========= Init UI ========= */
  toggleCreateListing(false);
  resetLoggedOutUI();
  updateAuthUI();

  /* ========= Listings loader (robust across pages) ========= */
  (async function loadListings() {
    // prefer the primary container ids/classes used in your markup
    const container = document.querySelector(".listed-items-container")
      || document.querySelector(".listed-items")
      || document.getElementById("itemsContainer")
      || document.querySelector(".items-container")
      || document.getElementById("new-listed-items");

    if (!container) return;

    try {
      const response = await fetch("/api/listings");
      if (!response.ok) throw new Error("Listings fetch failed");
      const listings = await response.json();

      container.innerHTML = "";
      listings.forEach((item) => {
        // create clickable card element
        const card = document.createElement("div");
        card.classList.add("item-card");
        card.style.cursor = "pointer";
        // keep a data-id attribute so other scripts can use it
        const itemId = item.id ?? item._id ?? item._id_str ?? "";
        if (itemId) card.setAttribute("data-id", String(itemId));

        card.innerHTML = `
          <div class="card shadow-md p-3 m-2 rounded-xl" style="width:200px;">
            <img src="${escapeHTML(item.imageUrl || 'images/usb.jpg')}" alt="${escapeHTML(item.title || 'Item')}" class="w-full rounded-lg mb-2 listing-image" style="height:150px; object-fit:cover;" />
            <div class="product-details">
              <h3 class="listing-title">${escapeHTML(item.title || '')}</h3>
              <div class="listing-price">₱${item.price ?? ''}</div>
              <div class="listing-description">${escapeHTML((item.description || '').slice(0, 120))}${(item.description && item.description.length>120)?'...':''}</div>
              <div class="seller" style="font-size:12px;color:#666;margin-top:6px;">Seller: ${escapeHTML(item.sellerName ?? '')}</div>
            </div>
          </div>
        `;

        // click navigates to item detail page, pass id in query
        card.addEventListener('click', () => {
          const id = item.id ?? item._id ?? item._id_str ?? "";
          if (!id) {
            // try to encode the whole item as fallback (not ideal) but avoid breaking UX
            console.warn("Item id missing for listing click", item);
            alert("Cannot open item: missing id.");
            return;
          }
          window.location.href = `item.html?id=${encodeURIComponent(String(id))}`;
        });

        container.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load listings:", err);
    }

    // auto-refresh once after adding item (used by add-item page)
    if (localStorage.getItem("reloadListings") === "true") {
      localStorage.removeItem("reloadListings");
      location.reload();
    }
  })();

  /* ========= Window resize: reposition open dropdown ========= */
  window.addEventListener("resize", () => {
    if (userDropdown && userDropdown.classList.contains("open")) {
      openDropdownNearAvatar();
    }
  });

  /* ========= Sidebar open/close handlers (if present on page) ========= */
  const openSidebarBtn = document.querySelector(".sideBarBtn");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebarBtn = document.getElementById("closeSidebar");

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("hidden");
    if (sidebarOverlay) sidebarOverlay.classList.remove("hidden");
  }
  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("hidden");
    if (sidebarOverlay) sidebarOverlay.classList.add("hidden");
  }

  if (openSidebarBtn) openSidebarBtn.addEventListener("click", openSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

});
