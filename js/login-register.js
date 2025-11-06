// js/login-register.js
// UI toggles (preserve existing behaviour)
(function () {
  function $id(id) { return document.getElementById(id); }

  window.showRegistration = function () {
    const loginSect = $id('login-sect');
    const regSect = $id('reg-sect');
    const regForm = $id('reg-form');
    if (!regSect || !loginSect) return;
    loginSect.classList.add('hidden');
    regSect.classList.remove('hidden');
    if (regForm) regForm.classList.remove('hidden');
    try { history.replaceState(null, '', '#register'); } catch(e) { location.hash = 'register'; }
    const first = regSect.querySelector('input:not([type=hidden])');
    if (first) first.focus();
  };

  window.showLogin = function () {
    const loginSect = $id('login-sect');
    const regSect = $id('reg-sect');
    const regForm = $id('reg-form');
    if (!regSect || !loginSect) return;
    regSect.classList.add('hidden');
    if (regForm) regForm.classList.add('hidden');
    loginSect.classList.remove('hidden');
    try { history.replaceState(null, '', location.pathname + location.search); } catch(e) { location.hash = ''; }
    const loginUser = loginSect.querySelector('input[type="text"], input:not([type="hidden"])');
    if (loginUser) loginUser.focus();
  };

  document.addEventListener('DOMContentLoaded', () => {
    const showRegBtn = $id('showReg') || document.querySelector('a#showReg');
    const showLoginBtn = $id('showLogin') || document.querySelector('a#showLogin');

    if (showRegBtn) showRegBtn.addEventListener('click', (e) => { e.preventDefault(); window.showRegistration(); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); window.showLogin(); });

    // open registration if hash present
    if (location.hash && location.hash.toLowerCase().includes('register')) {
      setTimeout(() => { window.showRegistration(); }, 50);
    }
  });
})();

// --- Client-side validation helpers (same rules as server for UX)
function clientValidateFullName(name) {
  if (!name) return "Full name required";
  const s = name.trim();
  if (s.length < 8 || s.length > 25) return "Full name must be 8–25 characters";
  if (!/^[A-Za-z ]+$/.test(s)) return "Full name must contain only letters and spaces";
  return null;
}
function clientValidateSchoolEmail(email) {
  if (!email) return "Email required";
  if (!/@mcm\.edu\.ph$/i.test(email)) return "School email must end with @mcm.edu.ph";
  return null;
}
function clientValidateStudentId(id) {
  if (!id) return "Student ID required";
  const s = String(id).trim();
  if (!/^\d{10}$/.test(s)) return "Student ID must be exactly 10 digits";
  if (!/^202\d{7}$/.test(s)) return "Student ID must start with 202";
  return null;
}
function clientValidateUsername(username) {
  if (!username) return "Username required";
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(username)) return "Username must be 3–20 chars (letters, numbers, . _ -)";
  return null;
}
function clientValidatePassword(pw) {
  if (!pw) return "Password required";
  if (!/^(?=.*\d)(?=.*[A-Za-z])[A-Za-z\d]{8,15}$/.test(pw)) return "Password must be 8–15 chars and include letters and numbers";
  return null;
}

// --- Registration handler (client-side + POST)
const regForm = document.getElementById('reg-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      studentid: document.getElementById('reg-studentid').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      password: document.getElementById('reg-password').value,
      confirm: document.getElementById('reg-confirmpass').value
    };

    // client-side checks
    let err =
      clientValidateFullName(payload.name) ||
      clientValidateSchoolEmail(payload.email) ||
      clientValidateStudentId(payload.studentid) ||
      clientValidateUsername(payload.username) ||
      clientValidatePassword(payload.password);

    if (err) { alert(err); return; }
    if (payload.password !== payload.confirm) { alert("Passwords do not match."); return; }

    // POST to server
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok) {
        alert('✅ Registered successfully. Please login.');
        regForm.reset();
        document.getElementById('reg-sect').classList.add('hidden');
        document.getElementById('login-sect').classList.remove('hidden');
      } else {
        alert(json.error || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      alert('Server error — unable to register.');
    }
  });
}

// --- Login handler (client-side + POST) ---
const loginForm = document.querySelector('.login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: document.getElementById('login-username').value.trim(),
      password: document.getElementById('login-password').value
    };
    if (!payload.username || !payload.password) { alert('Enter username and password'); return; }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok) {
        // success
        localStorage.setItem('username', json.user.username);
        alert('✅ Login successful. Redirecting...');
        window.location.href = 'dashboard.html';
      } else {
        alert(json.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Server error — unable to login.');
    }
  });
}
