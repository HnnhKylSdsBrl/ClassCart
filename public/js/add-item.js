document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("listingForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sellerName = document.getElementById("sellerName").value.trim();
    const itemName = document.getElementById("itemName").value.trim();
    const price = document.getElementById("price").value.trim();
    const category = document.getElementById("category").value.trim();
    const condition = document.getElementById("condition").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const imageFile = document.getElementById("imageUpload").files[0];

    if (!imageFile) {
      alert("Please upload an image.");
      return;
    }

    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const listingData = {
      username: "Guest",
      title: itemName,
      price: parseFloat(price),
      category,
      description,
      imageUrl: base64Image,
      sellerName,
      condition,
      location,
      createdAt: new Date(),
    };

    try {
      const response = await fetch("/api/add-listing-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingData),
      });

      const result = await response.json();

      if (response.ok) {
        alert("✅ Item added successfully!");
        localStorage.setItem("reloadListings", "true");
        window.location.href = "index.html";
      } else {
        alert("❌ Error: " + (result.error || "Failed to add item"));
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("❌ Something went wrong while adding item.");
    }
  });
});
