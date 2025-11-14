document.addEventListener("DOMContentLoaded", () => {
  function escapeHTML(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const nav = document.querySelector(".navLinks") || document.body;

  let loginBtn = document.querySelector(".loginbtn");
  if (!loginBtn) {
    loginBtn = document.createElement("div");
    loginBtn.className = "loginbtn";
    nav.appendChild(loginBtn);
  }

  let userDropdown = document.querySelector(".user-dropdown");
  if (!userDropdown) {
    userDropdown = document.createElement("div");
    userDropdown.className = "user-dropdown logged-out";
    userDropdown.innerHTML = `
      <div class="user-summary" style="display:flex;align-items:center;gap:8px;">
        <img class="userPic" src="images/userPic.jpg" style="width:40px;height:40px;border-radius:50%;display:inline-block;opacity:.35;">
      </div>
      <div class="user-dropdown-content hidden" style="display:none;">
        <a href="profile.html">My Account</a>
        <a href="#">Settings</a>
        <a href="#" id="logoutLink">Logout</a>
      </div>`;
    nav.appendChild(userDropdown);
  }

  const userPic = document.querySelector(".userPic");
  const userDropdownContent = document.querySelector(".user-dropdown-content");

  function makeSigninAnchor() {
    const a = document.createElement("a");
    a.href = "login-register.html";
    a.id = "signinLink";
    a.textContent = "Sign in / Log in";
    a.setAttribute("role", "link");
    a.setAttribute("tabindex", "0");
    a.style.pointerEvents = "auto";
    a.style.zIndex = "999999";
    a.style.position = "relative";
    a.style.display = "inline-block";
    a.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "login-register.html"; });
    return a;
  }

  function resetLoggedOutUI() {
    loginBtn.innerHTML = "";
    const a = makeSigninAnchor();
    loginBtn.appendChild(a);
    loginBtn.style.position = "relative";
    loginBtn.style.zIndex = "999999";

    if (userPic) {
      userPic.style.opacity = "1";
      userPic.style.pointerEvents = "none";
      userPic.style.cursor = "default";
      userPic.style.display = "inline-block";
      userPic.style.visibility = "visible";
      userPic.src = userPic.src || "images/userPic.jpg";
    }

    userDropdown.classList.add("logged-out");
    userDropdown.classList.remove("open");

    if (userDropdownContent) {
      userDropdownContent.classList.add("hidden");
      userDropdownContent.style.display = "none";
      userDropdownContent.style.removeProperty("left");
      userDropdownContent.style.removeProperty("top");
    }

    attachLogoutHandler();
  }

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
      loginBtn.style.pointerEvents = "default";
      loginBtn.style.position = "relative";
      loginBtn.style.zIndex = "1";

      if (userPic) {
        userPic.style.opacity = "1";
        userPic.style.pointerEvents = "auto";
        userPic.style.cursor = "pointer";
        userPic.style.display = "inline-block";
        userPic.style.visibility = "visible";
        userPic.src = profile.avatar || userPic.src || "images/userPic.jpg";
      }

      userDropdown.classList.remove("logged-out");
      userDropdown.classList.remove("open");

      if (userDropdownContent) {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }

      attachLogoutHandler();
    } catch {
      resetLoggedOutUI();
    }
  }

  function attachLogoutHandler() {
    let logout = document.getElementById("logoutLink");
    if (!logout) return;

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
          setTimeout(() => updateAuthUI(), 150);
        } else {
          alert("Logout failed.");
        }
      } catch {
        alert("Error logging out.");
      }
    });
  }

  document.addEventListener("click", (ev) => {
    if (!userDropdown || !userDropdownContent || !userPic) return;

    if (userDropdown.classList.contains("logged-out")) return;

    if (userPic.contains(ev.target)) {
      const open = userDropdown.classList.toggle("open");

      if (open) {
        const rect = userPic.getBoundingClientRect();
        userDropdownContent.style.position = "fixed";
        userDropdownContent.style.left = `${rect.left}px`;
        userDropdownContent.style.top = `${rect.bottom + 6}px`;
        userDropdownContent.style.zIndex = "2147483647";
        userDropdownContent.style.display = "block";
        userDropdownContent.classList.remove("hidden");
      } else {
        userDropdownContent.classList.add("hidden");
        userDropdownContent.style.display = "none";
      }

      ev.stopPropagation();
      return;
    }

    if (!userDropdown.contains(ev.target)) {
      userDropdown.classList.remove("open");
      userDropdownContent.classList.add("hidden");
      userDropdownContent.style.display = "none";
    }
  });

  resetLoggedOutUI();
  updateAuthUI();
});
