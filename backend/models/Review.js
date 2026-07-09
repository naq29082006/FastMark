const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    store_id: { type: String, required: true, index: true },
    user_name: { type: String, default: 'Khách hàng' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

reviewSchema.methods.toClientReview = function toClientReview() {
  return {
    id: this.externalId,
    store_id: this.store_id,
    user_name: this.user_name,
    rating: this.rating,
    comment: this.comment,
    created_at: (this.created_at || this.createdAt).toISOString(),
  };
};

module.exports = mongoose.model('Review', reviewSchema);
