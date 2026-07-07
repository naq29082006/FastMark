function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function makeProfileFromAuthUser(authUser, updates = {}) {
  const patch = updates || {};
  const timestamp = nowIso();

  return {
    id: authUser.uid,
    email: authUser.email || '',
    fullName: cleanText(patch.fullName) || authUser.displayName || '',
    phone: cleanText(patch.phone),
    photoUrl: cleanText(patch.photoUrl) || authUser.photoURL || '',
    createdAt: patch.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export function mergeProfile(authUser, baseProfile, updates = {}) {
  const patch = updates || {};
  const fallback = makeProfileFromAuthUser(authUser, baseProfile || {});

  return {
    ...fallback,
    ...baseProfile,
    email: authUser.email || baseProfile?.email || '',
    fullName:
      patch.fullName !== undefined
        ? cleanText(patch.fullName)
        : baseProfile?.fullName || fallback.fullName,
    phone:
      patch.phone !== undefined
        ? cleanText(patch.phone)
        : baseProfile?.phone || fallback.phone,
    photoUrl:
      patch.photoUrl !== undefined
        ? cleanText(patch.photoUrl)
        : baseProfile?.photoUrl || fallback.photoUrl,
    updatedAt: nowIso(),
  };
}
