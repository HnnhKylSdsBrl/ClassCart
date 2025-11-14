const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  sellerName: { type: String, required: true },
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  condition: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  imagePath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Listing', listingSchema);
