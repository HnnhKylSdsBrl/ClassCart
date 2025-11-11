// js/profile.js

// utility to hide/show elements
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

async function fetchProfile() {
  try {
    const res = await fetch('/api/profile', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) {
      // if unauthenticated, redirect to login
      if (res.status === 401) {
        window.location.href = 'login-register.html';
        return;
      }
      alert(data.error || 'Failed to load profile');
      return;
    }

    // fill view
    document.getElementById('v-username').textContent = data.username || '';
    document.getElementById('v-name').textContent = data.name || '';
    document.getElementById('v-email').textContent = data.email || '';
    document.getElementById('v-contact').textContent = data.contact || '';
    document.getElementById('v-gender').textContent = data.gender || '';
    document.getElementById('v-dob').textContent = data.dob || '';

    // preload edit fields
    document.getElementById('e-username').value = data.username || '';
    document.getElementById('e-name').value = data.name || '';
    document.getElementById('e-email').value = data.email || '';
    document.getElementById('e-contact').value = data.contact || '';
    document.getElementById('e-dob').value = data.dob || '';

    // set radio if gender present
    if (data.gender) {
      const radio = document.querySelector(`input[name="gender"][value="${data.gender}"]`);
      if (radio) radio.checked = true;
    } else {
      // uncheck all
      document.querySelectorAll('input[name="gender"]').forEach(r => r.checked = false);
    }

    // update profile-username display in sidebar header
    const profileUsername = document.getElementById('profile-username');
    if (profileUsername) profileUsername.textContent = data.username || '';
  } catch (err) {
    console.error(err);
    alert('Network error while loading profile');
  }
}

// wire up edit/cancel/save
document.addEventListener('DOMContentLoaded', () => {
  const view = document.getElementById('profile-view');
  const editForm = document.getElementById('profile-edit');
  const editBtn = document.getElementById('edit-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      hide(view);
      show(editForm);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // revert changes by reloading profile data
      fetchProfile();
      hide(editForm);
      show(view);
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        username: document.getElementById('e-username').value,
        name: document.getElementById('e-name').value,
        contact: document.getElementById('e-contact').value,
        gender: document.querySelector('input[name="gender"]:checked')?.value || '',
        dob: document.getElementById('e-dob').value || ''
      };

      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (res.ok) {
          alert('Profile updated!');
          hide(editForm);
          show(view);
          fetchProfile(); // refresh displayed values
        } else {
          alert(json.error || 'Failed to save changes');
        }
      } catch (err) {
        console.error(err);
        alert('Network error while saving profile');
      }
    });
  }

  // initial load
  fetchProfile();
});
