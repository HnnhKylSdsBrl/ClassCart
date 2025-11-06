// USER PROFILE DROPDOWN MENU------------------------------------------------------------------------
      function toggleMenu() {
        const menu = document.getElementById("dropdownMenu");
        menu.style.display = menu.style.display === "block" ? "none" : "block";
      }

      window.onclick = function (event) {
        if (!event.target.matches(".userPic")) {
          const dropdown = document.getElementById("dropdownMenu");
          if (dropdown && dropdown.style.display === "block") {
            dropdown.style.display = "none";
          }
        }
      };

      // SIDE BAR-----------------------------------------------------------------------------------------
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("sidebarOverlay");
      const closeBtn = document.getElementById("closeSidebar");

      function openSidebar() {
        sidebar.classList.remove("hidden");
        overlay.classList.remove("hidden");
      }

      function closeSidebar() {
        sidebar.classList.add("hidden");
        overlay.classList.add("hidden");
      }

      closeBtn.addEventListener("click", closeSidebar);
      overlay.addEventListener("click", closeSidebar);

      function filterItems(category) {
        const items = document.querySelectorAll(".item-card");
        items.forEach((item) => {
          const itemCategory = item.getAttribute("data-category");
          if (category === "all" || itemCategory === category) {
            item.classList.remove("hidden");
          } else {
            item.classList.add("hidden");
          }
        });
      }



 let timer;
      let popupShown = false; // Tracks whether the popup is currently visible
      let recentlyClosed = false; // Prevents instant re-showing after close

      function isAtBottom() {
        const scrollY = window.scrollY || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const fullHeight = document.body.offsetHeight;
        return scrollY + viewportHeight >= fullHeight - 10;
      }

      window.addEventListener("scroll", () => {
        if (isAtBottom()) {
          if (!popupShown && !timer && !recentlyClosed) {
            timer = setTimeout(() => {
              document
                .getElementById("signin-popup")
                .classList.remove("popup-hidden");
              document.body.classList.add("blurred");
              popupShown = true;
              timer = null;
            }, 500);
          }
        } else {
          clearTimeout(timer);
          timer = null;
        }
      });

      document.querySelector(".popup-close").addEventListener("click", () => {
        document.getElementById("signin-popup").classList.add("popup-hidden");
        document.body.classList.remove("blurred");
        popupShown = false;
        recentlyClosed = true;

        // Let it reappear again after a short cooldown (e.g. 5 seconds)
        setTimeout(() => {
          recentlyClosed = false;
        }, 4000);
      });

      // Category filter logic
      window.addEventListener("DOMContentLoaded", () => {
        const dropdown = document.querySelector(".category-dropdown");
        const products = document.querySelectorAll(".product-card");

        if (dropdown) {
          dropdown.addEventListener("change", (e) => {
            const selectedCategory = e.target.value;

            products.forEach((product) => {
              if (
                !selectedCategory ||
                selectedCategory === "all" ||
                product.dataset.category === selectedCategory
              ) {
                product.style.display = "";
              } else {
                product.style.display = "none";
              }
            });
          });
        }
      });
