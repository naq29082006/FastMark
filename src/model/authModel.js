export function serializeAuthUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    emailVerified: Boolean(user.emailVerified),
  };
}
