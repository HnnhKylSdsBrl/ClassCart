// public/js/change-password.js

(function () {
  // Toggle an input's visibility and the icon inside the button
  function togglePasswordInput(button) {
    try {
      const targetId = button.dataset.toggle;
      if (!targetId) {
        console.debug('[change-password.js] togglePasswordInput: no data-toggle on button', button);
        return;
      }
      const input = document.getElementById(targetId);
      if (!input) {
        console.debug('[change-password.js] togglePasswordInput: no input with id', targetId);
        return;
      }

      // find <i> inside button (Font Awesome)
      const icon = button.querySelector('i');
      const faPresent = !!icon && (icon.classList.contains('fa') || icon.classList.contains('fa-solid') || icon.classList.contains('fa-regular') );

      if (input.type === 'password') {
        input.type = 'text';
        if (faPresent) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          // fallback: change button text
          button.dataset.prev = button.textContent;
          button.textContent = 'Hide';
        }
      } else {
        input.type = 'password';
        if (faPresent) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        } else {
          button.textContent = button.dataset.prev || 'Show';
        }
      }
    } catch (err) {
      console.error('[change-password.js] togglePasswordInput error', err);
    }
  }

  // Hook up buttons reliably
  function attachEyeToggles() {
    const buttons = document.querySelectorAll('.eye-toggle');
    if (!buttons || buttons.length === 0) {
      console.debug('[change-password.js] attachEyeToggles: no .eye-toggle buttons found');
      return;
    }

    buttons.forEach(btn => {
      // remove any old listeners by cloning (defensive)
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        togglePasswordInput(newBtn);
      });
    });
  }

  // Password strength meter (simple)
  function attachStrengthMeter() {
    const newPass = document.getElementById('newPass');
    const strengthText = document.getElementById('pw-strength');
    if (!newPass || !strengthText) return;

    newPass.addEventListener('input', () => {
      const pw = newPass.value || '';
      if (pw.length === 0) {
        strengthText.textContent = '';
        return;
      }

      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[a-z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[\W_]/.test(pw)) score++;

      if (score <= 2) {
        strengthText.textContent = 'Weak password';
        strengthText.style.color = '#ffcc00';
      } else if (score === 3) {
        strengthText.textContent = 'Medium strength';
        strengthText.style.color = '#dbe9ff';
      } else {
        strengthText.textContent = 'Strong password';
        strengthText.style.color = '#b6ffb6';
      }
    });
  }

  // Submit handler (keeps your existing behavior)
  function attachFormHandler() {
    const form = document.getElementById('change-pass-form');
    if (!form) {
      console.debug('[change-password.js] attachFormHandler: no form found');
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('currentPass')?.value.trim() || '';
      const newP = document.getElementById('newPass')?.value.trim() || '';
      const confirmP = document.getElementById('confirmPass')?.value.trim() || '';

      if (!current || !newP || !confirmP) {
        alert('Please fill in all fields.');
        return;
      }
      if (newP !== confirmP) {
        alert('New passwords do not match.');
        return;
      }
      if (newP.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
      }

      try {
        const res = await fetch('/api/change-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ currentPassword: current, newPassword: newP })
        });

        let json = {};
        try { json = await res.json(); } catch (_) {}

        if (!res.ok) {
          alert(json.error || 'Failed to change password.');
          return;
        }

        alert('Password updated successfully!');
        window.location.href = 'profile.html';
      } catch (err) {
        console.error('[change-password.js] network error', err);
        alert('Network error while changing password.');
      }
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    attachEyeToggles();
    attachStrengthMeter();
    attachFormHandler();

    // If Font Awesome icons are present but were initialized in the DOM after script load,
    // ensure initial icons are set to fa-eye (in case someone used plain <i> without classes)
    document.querySelectorAll('.eye-toggle').forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon && !icon.classList.contains('fa-eye') && !icon.classList.contains('fa-eye-slash')) {
        icon.classList.add('fa-solid', 'fa-eye');
      }
    });
  });

  // Failsafe: if DOMContentLoaded already fired, run immediately
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(() => {
      try { attachEyeToggles(); attachStrengthMeter(); attachFormHandler(); } catch(e) { /* ignore */ }
    }, 0);
  }
})();
