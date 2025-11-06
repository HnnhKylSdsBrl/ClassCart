

// USER PROFILE DROPDOWN MENU------------------------------------------------------------------------
function toggleMenu() {
    const menu = document.getElementById('dropdownMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }

  window.onclick = function(event) {
    if (!event.target.matches('.userPic')) {
      const dropdown = document.getElementById('dropdownMenu');
      if (dropdown && dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
      }
    }
  }

// SIDE BAR-----------------------------------------------------------------------------------------
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('closeSidebar');

 
  function openSidebar() {
    sidebar.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }

  function closeSidebar() {
    sidebar.classList.add('hidden');
    overlay.classList.add('hidden');
  }

  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);


function filterItems(category) {
  const items = document.querySelectorAll('.item-card');
  items.forEach(item => {
    const itemCategory = item.getAttribute('data-category');
    if (category === 'all' || itemCategory === category) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}







