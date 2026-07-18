import { normalizeCategoryId } from '../core/utils/categoryId';

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
    // Không fallback ảnh Google từ Firebase Auth — avatar lấy từ backend/hệ thống.
    photoUrl: cleanText(patch.photoUrl),
    shopName: cleanText(patch.shopName),
    shopUsername: cleanText(patch.shopUsername),
    categoryId: cleanText(patch.categoryId),
    categoryName: cleanText(patch.categoryName),
    shopDescription: cleanText(patch.shopDescription),
    shopPhone: cleanText(patch.shopPhone),
    verifyAccount: Boolean(patch.verifyAccount),
    authProvider: cleanText(patch.authProvider),
    role: normalizeRole(patch.role ?? ROLE_BUYER),
    sellerPhoneVerified: Boolean(patch.sellerPhoneVerified),
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
    sellerPhoneVerified:
      patch.sellerPhoneVerified !== undefined
        ? Boolean(patch.sellerPhoneVerified)
        : Boolean(baseProfile?.sellerPhoneVerified ?? fallback.sellerPhoneVerified),
    totalProducts:
      patch.totalProducts !== undefined
        ? Number(patch.totalProducts) || 0
        : Number(baseProfile?.totalProducts) || 0,
    likesCount:
      patch.likesCount !== undefined
        ? Number(patch.likesCount) || 0
        : Number(baseProfile?.likesCount) || 0,
    followersCount:
      patch.followersCount !== undefined
        ? Number(patch.followersCount) || 0
        : Number(baseProfile?.followersCount) || 0,
    followingCount:
      patch.followingCount !== undefined
        ? Number(patch.followingCount) || 0
        : Number(baseProfile?.followingCount) || 0,
    soldCount:
      patch.soldCount !== undefined
        ? Number(patch.soldCount) || 0
        : Number(baseProfile?.soldCount) || 0,
    totalReviews:
      patch.totalReviews !== undefined
        ? Number(patch.totalReviews) || 0
        : Number(baseProfile?.totalReviews) || 0,
    averageRating:
      patch.averageRating !== undefined
        ? Number(patch.averageRating) || 0
        : Number(baseProfile?.averageRating) || 0,
    responseRate:
      patch.responseRate !== undefined
        ? Number(patch.responseRate) || 0
        : Number(baseProfile?.responseRate) || 0,
    mongoUserId:
      patch.mongoUserId !== undefined
        ? cleanText(patch.mongoUserId)
        : baseProfile?.mongoUserId || '',
    shopPhone:
      patch.shopPhone !== undefined
        ? cleanText(patch.shopPhone)
        : baseProfile?.shopPhone || '',
    shopAddress:
      patch.shopAddress !== undefined
        ? cleanText(patch.shopAddress)
        : baseProfile?.shopAddress || '',
    shopSystemAddress:
      patch.shopSystemAddress !== undefined
        ? cleanText(patch.shopSystemAddress)
        : baseProfile?.shopSystemAddress || '',
    shopName:
      patch.shopName !== undefined
        ? cleanText(patch.shopName)
        : baseProfile?.shopName || '',
    shopUsername:
      patch.shopUsername !== undefined
        ? cleanText(patch.shopUsername)
        : baseProfile?.shopUsername || '',
    categoryId:
      patch.categoryId !== undefined
        ? cleanText(patch.categoryId)
        : baseProfile?.categoryId || '',
    categoryName:
      patch.categoryName !== undefined
        ? cleanText(patch.categoryName)
        : baseProfile?.categoryName || '',
    shopDescription:
      patch.shopDescription !== undefined
        ? cleanText(patch.shopDescription)
        : baseProfile?.shopDescription || '',
    shopAvatar:
      patch.shopAvatar !== undefined
        ? cleanText(patch.shopAvatar)
        : baseProfile?.shopAvatar || '',
    openTime:
      patch.openTime !== undefined
        ? cleanText(patch.openTime)
        : baseProfile?.openTime || '',
    closeTime:
      patch.closeTime !== undefined
        ? cleanText(patch.closeTime)
        : baseProfile?.closeTime || '',
    isOpen:
      patch.isOpen !== undefined
        ? Number(patch.isOpen) === 1 ? 1 : 0
        : baseProfile?.isOpen ?? 1,
    walletBalance:
      patch.walletBalance !== undefined
        ? Math.max(0, Number(patch.walletBalance) || 0)
        : Math.max(0, Number(baseProfile?.walletBalance) || 0),
    updatedAt: nowIso(),
  };
}

export function mapShopSettingsToProfilePatch(shop) {
  if (!shop) {
    return {};
  }

  return {
    shopName: cleanText(shop.shopName),
    shopUsername: cleanText(shop.shopUsername),
    categoryId: cleanText(shop.categoryId),
    categoryName: cleanText(shop.categoryName),
    shopDescription: cleanText(shop.description || shop.shopDescription),
    shopAvatar: cleanText(shop.avatar || shop.shopAvatar),
    shopAddress: cleanText(shop.address),
    shopSystemAddress: cleanText(shop.systemAddress),
    shopPhone: cleanText(shop.shopPhone),
    openTime: cleanText(shop.openTime),
    closeTime: cleanText(shop.closeTime),
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
  };
}

export function mapSellerVerificationToProfilePatch(verification) {
  if (!verification) {
    return {};
  }

  return {
    shopName: cleanText(verification.shopName),
    shopUsername: cleanText(verification.shopUsername),
    categoryId: normalizeCategoryId(verification.categoryId),
    categoryName: cleanText(verification.categoryName),
    shopDescription: cleanText(verification.shopDescription),
    shopAddress: cleanText(verification.address),
    shopSystemAddress: cleanText(verification.DiaChiHeThong),
  };
}

export function mapBackendUserToProfile(backendUser, authUser) {
  return mergeProfile(authUser, null, {
    mongoUserId: backendUser?.id ? String(backendUser.id) : '',
    fullName: backendUser?.fullName,
    phone: backendUser?.phone,
    photoUrl: backendUser?.avatar || '',
    userName: backendUser?.userName,
    verifyAccount: Boolean(backendUser?.verifyAccount),
    authProvider: backendUser?.authProvider || '',
    role: backendUser?.role,
    sellerPhoneVerified: Boolean(backendUser?.sellerPhoneVerified),
    totalProducts: backendUser?.totalProducts ?? 0,
    likesCount: backendUser?.likesCount ?? 0,
    followersCount: backendUser?.followersCount ?? 0,
    followingCount: backendUser?.followingCount ?? 0,
    soldCount: backendUser?.soldCount ?? 0,
    totalReviews: backendUser?.totalReviews ?? 0,
    averageRating: backendUser?.averageRating ?? 0,
    responseRate: backendUser?.responseRate ?? 0,
    shopPhone: backendUser?.shopPhone || '',
    shopName: backendUser?.shopName || '',
    shopUsername: backendUser?.shopUsername || '',
    categoryId: backendUser?.categoryId || '',
    categoryName: backendUser?.categoryName || '',
    shopAddress: backendUser?.shopAddress || '',
    shopSystemAddress: backendUser?.shopSystemAddress || '',
    shopDescription:
      backendUser?.shopDescription !== undefined
        ? cleanText(backendUser.shopDescription)
        : backendUser?.description !== undefined
          ? cleanText(backendUser.description)
          : undefined,
    shopAvatar:
      backendUser?.shopAvatar !== undefined ? cleanText(backendUser.shopAvatar) : undefined,
    openTime: backendUser?.openTime || '',
    closeTime: backendUser?.closeTime || '',
    isOpen: backendUser?.isOpen ?? 1,
    walletBalance: backendUser?.walletBalance ?? 0,
  });
}
