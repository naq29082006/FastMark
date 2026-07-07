const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: 'food', index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    zalo: { type: String, default: '' },
    intro: { type: String, default: '' },
    rating_avg: { type: Number, default: 4.5 },
    review_count: { type: Number, default: 0 },
    product_count: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

restaurantSchema.methods.toClientStore = function toClientStore() {
  return {
    id: this.externalId,
    name: this.name,
    type: this.type,
    latitude: this.latitude,
    longitude: this.longitude,
    address: this.address,
    phone: this.phone,
    zalo: this.zalo || this.phone,
    intro: this.intro,
    rating_avg: this.rating_avg,
    review_count: this.review_count,
    product_count: this.product_count,
  };
};

module.exports = mongoose.model('Restaurant', restaurantSchema);
