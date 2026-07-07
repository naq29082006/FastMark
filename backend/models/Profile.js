const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '' },
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

profileSchema.methods.toClientProfile = function toClientProfile() {
  return {
    id: this.firebaseUid,
    email: this.email || '',
    fullName: this.fullName || '',
    phone: this.phone || '',
    photoUrl: this.photoUrl || '',
    createdAt: this.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: this.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
};

module.exports = mongoose.model('Profile', profileSchema);
