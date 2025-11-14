// public/js/profile.js

(function () {
  // ---------- helpers ----------
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
    else console.debug(`[profile.js] safeSetText: element #${id} not present, skipping`);
  }

  function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
    else console.debug(`[profile.js] safeSetValue: element #${id} not present, skipping`);
  }

  function getDobBounds() {
    const now = new Date();
    const minAllowed = new Date(now);
    minAllowed.setFullYear(minAllowed.getFullYear() - 35); // earliest DOB allowed
    const minYMD = minAllowed.toISOString().slice(0,10);
    const maxYMD = new Date("2014-12-31T23:59:59.999Z").toISOString().slice(0,10);
    return { minYMD, maxYMD };
  }

  // ---------- fetchProfile (safe) ----------
  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile', { credentials: 'same-origin' });
      let data = {};
      try { data = await res.json(); } catch (e) {
        console.error('[profile.js] Failed to parse /api/profile JSON', e);
        if (res.status === 401) {
          console.debug('[profile.js] /api/profile returned 401 (not authenticated)');
          return;
        }
        alert('Failed to load profile (invalid server response)');
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          console.debug('[profile.js] not authenticated (401)');
          return;
        }
        alert(data.error || 'Failed to load profile');
        return;
      }

      // --- set view text safely ---
      safeSetText('v-username', data.username);
      safeSetText('v-name', data.name);
      safeSetText('v-email', data.email);
      safeSetText('v-contact', data.contact);
      safeSetText('v-gender', data.gender);
      safeSetText('v-dob', data.dob);

      // --- preload edit fields if present ---
      safeSetValue('e-username', data.username);
      safeSetValue('e-name', data.name);
      safeSetValue('e-email', data.email);
      safeSetValue('e-contact', data.contact);
      safeSetValue('e-dob', data.dob);

      // --- avatar ---
      const avatarImg = document.getElementById('profile-avatar');
      if (avatarImg) {
        avatarImg.src = data.imageUrl || avatarImg.src || 'images/userPic.jpg';
      }

      // --- dob edit UI ---
      const eDob = document.getElementById('e-dob');
      if (eDob) {
        const { minYMD, maxYMD } = getDobBounds();
        eDob.setAttribute('min', minYMD);
        eDob.setAttribute('max', maxYMD);

        const dobEditCount = data.dobEditCount ?? 0;
        const existingNote = document.getElementById('dob-note');
        if (existingNote) existingNote.remove();

        if (dobEditCount >= 1) {
          eDob.disabled = true;
          const note = document.createElement('p');
          note.id = 'dob-note';
          note.style.fontSize = '0.95em';
          note.textContent = 'Birthdate cannot be changed again.';
          eDob.parentNode.appendChild(note);
        } else {
          eDob.disabled = false;
        }
      }

      // --- gender radios ---
      if (data.gender) {
        const radio = document.querySelector(`input[name="gender"][value="${data.gender}"]`);
        if (radio) radio.checked = true;
      } else {
        document.querySelectorAll('input[name="gender"]').forEach(r => r.checked = false);
      }

      // --- sidebar username ---
      const sideUser = document.getElementById('profile-username');
      if (sideUser) sideUser.textContent = data.username || '';

    } catch (err) {
      console.error('[profile.js] Network error while loading profile', err);
      // only alert if on profile page (v-username exists)
      if (document.getElementById('v-username')) {
        alert('Network error while loading profile');
      } else {
        console.debug('[profile.js] network error but not on profile page, skipping alert');
      }
    }
  }

  // ---------- image upload & helpers (safe) ----------
  async function sendProfilePicture(dataUrl) {
    try {
      const res = await fetch('/api/profile/picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ imageBase64: dataUrl })
      });

      let json = {};
      try { json = await res.json(); } catch(_) {}

      if (!res.ok) {
        const picError = document.getElementById('pic-error');
        if (picError) picError.textContent = json.error || "Upload failed";
        return false;
      }

      if (json.user && json.user.imageUrl) {
        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.src = json.user.imageUrl;
      }
      return true;
    } catch (err) {
      console.error('[profile.js] Upload error', err);
      const picError = document.getElementById('pic-error');
      if (picError) picError.textContent = "Network error.";
      return false;
    }
  }

  // ---------- run on DOM ready ----------
  document.addEventListener('DOMContentLoaded', () => {
    // Elements (may be null on pages that don't have them)
    const view = document.getElementById('profile-view');
    const editForm = document.getElementById('profile-edit');
    const editBtn = document.getElementById('edit-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (view) hide(view);
        if (editForm) show(editForm);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        fetchProfile();
        if (editForm) hide(editForm);
        if (view) show(view);
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const eDob = document.getElementById('e-dob');
        let dobValue = eDob ? eDob.value : undefined;
        const { minYMD, maxYMD } = getDobBounds();

        if (eDob && !eDob.disabled && dobValue) {
          if (dobValue < minYMD || dobValue > maxYMD) {
            alert(`Birthdate must be between ${minYMD} and ${maxYMD}.`);
            return;
          }
        } else {
          dobValue = undefined;
        }

        const payload = {
          name: document.getElementById('e-name')?.value || '',
          contact: document.getElementById('e-contact')?.value || '',
          gender: document.querySelector('input[name="gender"]:checked')?.value || '',
        };
        if (typeof dobValue === 'string') payload.dob = dobValue;

        try {
          const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });

          let json = {};
          try { json = await res.json(); } catch (parseErr) { json = {}; }

          if (!res.ok) {
            alert(json.error || res.statusText || 'Failed to save changes');
            return;
          }

          alert('Profile updated!');
          if (editForm) hide(editForm);
          if (view) show(view);
          fetchProfile();
        } catch (err) {
          console.error('[profile.js] Network error while saving profile', err);
          alert('Network error while saving profile');
        }
      });
    }

    // image upload
    const changeBtn = document.getElementById('change-pic-btn');
    const fileInput = document.getElementById('profile-pic-input');
    const avatarImg = document.getElementById('profile-avatar');
    const picError = document.getElementById('pic-error');

    function clearPicError() { if (picError) picError.textContent = ''; }
    function showPicError(msg) { if (picError) picError.textContent = msg; }

    if (changeBtn && fileInput && avatarImg) {
      changeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        clearPicError();
        fileInput.click();
      });

      fileInput.addEventListener('change', async (ev) => {
        clearPicError();
        const file = ev.target.files?.[0];
        if (!file) return;

        const maxBytes = 2 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.type)) {
          showPicError("Invalid file type. Use JPG, PNG, or WEBP.");
          fileInput.value = '';
          return;
        }
        if (file.size > maxBytes) {
          showPicError("File too large. Max 2MB.");
          fileInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result;
          avatarImg.src = dataUrl;
          avatarImg.parentElement.classList.add('uploading');
          const ok = await sendProfilePicture(dataUrl);
          avatarImg.parentElement.classList.remove('uploading');
          if (!ok) {
            showPicError("Failed to change profile picture.");
            fetch('/api/profile', { credentials: 'same-origin' })
              .then(r => r.json())
              .then(d => {
                if (d.imageUrl) avatarImg.src = d.imageUrl;
                else avatarImg.src = "images/userPic.jpg";
              })
              .catch(() => { avatarImg.src = "images/userPic.jpg"; });
          } else {
            clearPicError();
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // sidebar highlighting - mark active
    (function markActiveSidebarLink() {
      try {
        const anchors = document.querySelectorAll('.sidebar a');
        if (!anchors || anchors.length === 0) return;

        const currentFile = (location.pathname.split('/').pop() || '').toLowerCase();

        anchors.forEach(a => {
          let href = a.getAttribute('href') || '';
          if (href.startsWith('#') || href.startsWith('javascript:')) return;

          try {
            const url = new URL(href, location.origin);
            const target = (url.pathname.split('/').pop() || '').toLowerCase();

            if (target === currentFile || (target === '' && (currentFile === '' || currentFile === 'index.html'))) {
              a.classList.add('active-link');
            } else {
              a.classList.remove('active-link');
            }
          } catch (err) {
            const target = href.split('/').pop().toLowerCase();
            if (target === currentFile) a.classList.add('active-link');
          }
        });
      } catch (e) {
        console.error('[profile.js] markActiveSidebarLink error', e);
      }
    })();

    // finally, safe initial profile load
    fetchProfile();
  });
})();
