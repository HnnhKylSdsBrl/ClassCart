document.getElementById("showReg").addEventListener("click", function(e){
    e.preventDefault();
    document.getElementById("login-sect").classList.add("hidden");
    document.getElementById("reg-sect").classList.remove("hidden");
    document.getElementById("reg-form").classList.remove("hidden");
});

document.getElementById("showLogin").addEventListener("click", function(e){
    e.preventDefault();
    document.getElementById("reg-sect").classList.add("hidden");
    document.getElementById("reg-form").classList.add("hidden");
    document.getElementById("login-sect").classList.remove("hidden");
});

function goToDashboard(event){
    event.preventDefault();
    window.location.href = "index.html";
}

document.getElementById("reg-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    username: document.getElementById("reg-username").value.trim(),
    password: document.getElementById("reg-password").value.trim(),
    email: document.getElementById("reg-email").value.trim(),
    studentid: document.getElementById("reg-studentid").value.trim(),
    contact: document.getElementById("reg-contact").value.trim(),
  };

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      alert("✅ Registration successful!");
      document.getElementById("reg-form").reset();
      document.getElementById("reg-sect").classList.add("hidden");
      document.getElementById("login-sect").classList.remove("hidden");
    } else {
      alert("⚠️ " + (result.error || "Registration failed"));
    }
  } catch (err) {
    console.error(err);
    alert("❌ Server error — check connection.");
  }
});

// handle login form submit
document.querySelector(".login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    username: document.getElementById("login-username").value.trim(),
    password: document.getElementById("login-password").value.trim(),
  };

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      alert("✅ Login successful! Welcome " + result.user.username);
      window.location.href = "dashboard.html"; // redirect after success
    } else {
      alert("⚠️ " + (result.error || "Invalid credentials"));
    }
  } catch (err) {
    console.error(err);
    alert("❌ Server error — check connection.");
  }
});