const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    store_id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    image_emoji: { type: String, default: '📦' },
  },
  { timestamps: true, versionKey: false }
);

productSchema.methods.toClientProduct = function toClientProduct() {
  return {
    id: this.externalId,
    store_id: this.store_id,
    name: this.name,
    price: this.price,
    description: this.description,
    image_emoji: this.image_emoji,
  };
};

module.exports = mongoose.model('Product', productSchema);
