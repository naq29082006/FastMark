export const ROLE_BUYER = 1;
export const ROLE_SELLER = 2;

export function normalizeRole(role) {
  const value = Number(role);
  return Number.isFinite(value) ? value : ROLE_BUYER;
}

export function isSellerRole(role) {
  return normalizeRole(role) === ROLE_SELLER;
}

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
    userName: cleanText(patch.userName),
    phone: cleanText(patch.phone),
    photoUrl: cleanText(patch.photoUrl) || authUser.photoURL || '',
    verifyAccount: Boolean(patch.verifyAccount),
    authProvider: cleanText(patch.authProvider),
    role: normalizeRole(patch.role ?? ROLE_BUYER),
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
    userName:
      patch.userName !== undefined
        ? cleanText(patch.userName)
        : baseProfile?.userName || fallback.userName,
    verifyAccount:
      patch.verifyAccount !== undefined
        ? Boolean(patch.verifyAccount)
        : Boolean(baseProfile?.verifyAccount),
    authProvider:
      patch.authProvider !== undefined
        ? cleanText(patch.authProvider)
        : baseProfile?.authProvider || fallback.authProvider || '',
    role:
      patch.role !== undefined
        ? normalizeRole(patch.role)
        : normalizeRole(baseProfile?.role ?? fallback.role),
    updatedAt: nowIso(),
  };
}

export function mapBackendUserToProfile(backendUser, authUser) {
  return mergeProfile(authUser, null, {
    fullName: backendUser?.fullName,
    phone: backendUser?.phone,
    photoUrl: backendUser?.avatar,
    userName: backendUser?.userName,
    verifyAccount: Boolean(backendUser?.verifyAccount),
    authProvider: backendUser?.authProvider || '',
    role: backendUser?.role,
  });
}
