document.addEventListener("DOMContentLoaded", async () => {
  const container =
    document.querySelector(".items-container") ||
    document.querySelector("#itemsContainer");

  if (!container) return;

  try {
    const response = await fetch("/api/listings");
    const listings = await response.json();

    container.innerHTML = "";
    listings.forEach((item) => {
      const card = document.createElement("div");
      card.classList.add("item-card");
     let cat = item.category.toLowerCase().replace(/\s+/g, "-");

// Map real category names to the filter button names
const categoryMap = {
  "arts-and-crafts": "art-craft",
  "clothing-and-uniforms": "clothing",
  "bags-and-storage": "bags"
};

// If category is in the map, replace it
if (categoryMap[cat]) {
  cat = categoryMap[cat];
}

card.setAttribute("data-category", cat);

      card.innerHTML = `
        <div class="card shadow-md p-3 m-2 rounded-xl" style="width:200px;">
          <img src="${item.imageUrl}" alt="${item.title}" class="w-full rounded-lg mb-2" style="height:150px; object-fit:cover;" />
          <p><strong>${item.title}</strong></p>
          <p>₱${item.price}</p>
          <p>${item.category}</p>
          <p>${item.condition}</p>
          <p>${item.location}</p>
          <p><i>Seller:</i> ${item.sellerName}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load listings:", err);
  }

  if (localStorage.getItem("reloadListings") === "true") {
    localStorage.removeItem("reloadListings");
    location.reload();
  }
});
