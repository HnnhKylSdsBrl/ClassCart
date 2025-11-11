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

//full name: required, 8-25 chars, letters and spaces only
function clientValidateFullName(name) {
  if (!name) return "Full name required";
  const s = name.trim();
  if (s.length < 8 || s.length > 25) return "Full name must be 8–25 characters";
  if (!/^[A-Za-z ]+$/.test(s)) return "Full name must contain only letters and spaces";
  return null;
}

// school email: required, must end with @mcm.edu.ph
function clientValidateSchoolEmail(email) {
  if (!email) return "Email required";
  if (!/@mcm\.edu\.ph$/i.test(email)) return "School email must end with @mcm.edu.ph";
  return null;
}

// student ID: required, exactly 10 digits, starts with 202
function clientValidateStudentId(id) {
  if (!id) return "Student ID required";
  const s = String(id).trim();
  if (!/^\d{10}$/.test(s)) return "Student ID must be exactly 10 digits";
  if (!/^202\d{7}$/.test(s)) return "Invalid Student ID";
  return null;
}


function clientValidateUsername(username, email) {
  if (!username) return "Username required";
  const prefix = email.split("@")[0];
  if (username !== prefix)
    return "Username must match your school email prefix";
  if (!/^[A-Za-z]+$/.test(username))
    return "Username must contain letters only";
  return null;
}

function clientValidatePassword(pw) {
  if (!pw) return "Password required";

  // no special characters allowed
  if (!pw) return "Password required";
  if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,15}$/.test(pw))
    return "Password must be 8–15 chars, include letters, numbers, and a special character";
  return null;
}

function clientValidateContact(contact) {
  if (!contact) return "Mobile number required";

  // must be digits only
  if (!/^\d+$/.test(contact))
    return "Mobile number must contain numbers only.";

  // must start with 09 and be exactly 11 digits
  if (/^09\d{9}$/.test(contact)) return null;

  // must start with +639 and be exactly 13 characters total
  if (/^\+639\d{9}$/.test(contact)) return null;

  // if +639 but too short/long
  if (/^\+639/.test(contact))
    return "Mobile number must have 11 digits.";

  // if 09 but too short/long
  if (/^09/.test(contact))
    return "Mobile number must have 11 digits.";

  // if wrong prefix
  return "Invalid mobile number prefix.";
}

// dob
function clientValidateDOB(dob) {
  if (!dob) return null; // optional field

  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime()))
    return "Invalid date format";

  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  const isUnder17 =
    age < 17 ||
    (age === 17 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)));

  if (isUnder17)
    return "You must be at least 17 years old to register";

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
      contact: document.getElementById('reg-contact').value.trim(),
      confirm: document.getElementById('reg-confirmpass').value
    };

    // client-side checks
    let err =
      clientValidateFullName(payload.name) ||
      clientValidateSchoolEmail(payload.email) ||
      clientValidateStudentId(payload.studentid) ||
      clientValidateUsername(payload.username, payload.email) ||
      clientValidatePassword(payload.password);
      clientValidateContact(payload.contact);


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
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      console.log('login response', res.status, json);
      if (res.ok) {
        // success
        alert('✅ Login successful. Redirecting...');
        window.location.href = 'index.html';
      } else {
        alert(json.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Server error — unable to login.');
    }
  });
}
// --- Password eye toggle (Font Awesome, with emoji fallback) ---
document.addEventListener("DOMContentLoaded", () => {
  const eyes = document.querySelectorAll(".toggle-eye");
  if (!eyes || eyes.length === 0) {
    console.warn("[toggle] no .toggle-eye elements found");
    return;
  }

  // If Font Awesome didn't load, we will show emoji fallback.
  const faLoaded = !!document.querySelector('.fa-solid, .fa-regular, .fa-eye, .fa-eye-slash');

  eyes.forEach((eye) => {
    // ensure data-target exists; auto-assign if missing
    if (!eye.dataset.target) {
      const wrapper = eye.closest('.password-wrapper');
      const input = wrapper && wrapper.querySelector('input[type="password"], input[type="text"]');
      if (input && input.id) eye.dataset.target = input.id;
    }

    // initial icon: use FA classes if available, otherwise emoji
    if (faLoaded) {
      // prefer the "eye" style initially
      eye.classList.add('fa-regular', 'fa-eye');
      // remove any text content fallback
      eye.textContent = '';
    } else {
      eye.classList.add('fallback');
      eye.textContent = '👁️';
    }

    eye.setAttribute('role', 'button');
    eye.setAttribute('aria-label', 'Show or hide password');

    eye.addEventListener('click', () => {
      const targetId = eye.dataset.target;
      if (!targetId) return console.warn('[toggle] missing data-target on eye');
      const input = document.getElementById(targetId);
      if (!input) return console.warn('[toggle] no input for target', targetId);

      const wasPwd = input.type === 'password';
      input.type = wasPwd ? 'text' : 'password';
      input.focus();

      // swap icon: Font Awesome
      if (faLoaded) {
        eye.classList.toggle('fa-eye');
        eye.classList.toggle('fa-eye-slash');
      } else {
        // emoji fallback
        eye.textContent = wasPwd ? '🙈' : '👁️';
      }
    });
  });

  console.log(`[toggle] initialized ${eyes.length} toggle-eye element(s). FA loaded: ${faLoaded}`);
});

document.querySelectorAll(".password-wrapper input").forEach((input) => {
  const eye = input.parentElement.querySelector(".toggle-eye");
  if (!eye) return;

  // initial state — hide icon
  eye.style.display = input.value ? "block" : "none";

  // show/hide on input
  input.addEventListener("input", () => {
    eye.style.display = input.value ? "block" : "none";
  });
});



