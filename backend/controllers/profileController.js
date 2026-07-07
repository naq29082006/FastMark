const Profile = require('../models/Profile');

function profileFromToken(decoded) {
  return {
    firebaseUid: decoded.uid,
    email: decoded.email || '',
    fullName: decoded.name || '',
    photoUrl: decoded.picture || '',
  };
}

async function getProfile(req, res) {
  const { uid, email, name, picture } = req.firebaseUser;

  let profile = await Profile.findOne({ firebaseUid: uid });

  if (!profile) {
    profile = await Profile.create({
      firebaseUid: uid,
      email: email || '',
      fullName: name || '',
      photoUrl: picture || '',
    });
  }

  return res.json({ profile: profile.toClientProfile() });
}

async function updateProfile(req, res) {
  const { uid, email, name, picture } = req.firebaseUser;
  const incoming = req.body?.profile || req.body || {};

  const updates = {
    email: email || incoming.email || '',
    fullName: typeof incoming.fullName === 'string' ? incoming.fullName.trim() : name || '',
    phone: typeof incoming.phone === 'string' ? incoming.phone.trim() : '',
    photoUrl:
      typeof incoming.photoUrl === 'string'
        ? incoming.photoUrl.trim()
        : picture || '',
  };

  const profile = await Profile.findOneAndUpdate(
    { firebaseUid: uid },
    { $set: updates },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return res.json({ profile: profile.toClientProfile() });
}

module.exports = { getProfile, updateProfile, profileFromToken };
