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
