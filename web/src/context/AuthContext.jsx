import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';

import { loginAccount } from '../api/authApi';
import { apiRequest } from '../api/client';
import { auth, configError } from '../firebase';

const AuthContext = createContext(null);

function toLoginError(error) {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === 'auth/invalid-credential' || message.includes('INVALID_PASSWORD')) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (code === 'auth/user-not-found') {
    return 'Không tìm thấy tài khoản với email này.';
  }

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được backend. Hãy chạy backend và kiểm tra VITE_API_URL trong .env ở thư mục gốc dự án.';
  }

  return message || 'Đăng nhập thất bại.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRole(firebaseUser) {
    const token = await firebaseUser.getIdToken();
    const payload = await apiRequest('/api/auth/me', { token });
    const nextRole = Number(payload.data?.user?.role ?? 1);
    setRole(nextRole);
    return nextRole;
  }

  useEffect(() => {
    if (configError || !auth) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setError('');
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        setUser(firebaseUser);
        await loadRole(firebaseUser);
      } catch (loadError) {
        setError(loadError.message || 'Không tải được thông tin tài khoản.');
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      error,
      isAdmin: role === 3,
      async login(email, password) {
        if (!auth) {
          throw new Error(configError || 'Firebase chưa được cấu hình.');
        }

        setError('');

        try {
          const loginData = await loginAccount({
            login: email.trim(),
            password,
          });

          if (!loginData?.tokens?.customToken) {
            throw new Error('Backend không trả về custom token đăng nhập.');
          }

          const credential = await signInWithCustomToken(
            auth,
            loginData.tokens.customToken
          );
          const nextRole = await loadRole(credential.user);

          if (nextRole !== 3) {
            await signOut(auth);
            throw new Error('Tài khoản này không có quyền admin (Role = 3).');
          }
        } catch (loginError) {
          throw new Error(toLoginError(loginError));
        }
      },
      async logout() {
        await signOut(auth);
      },
      async getIdToken() {
        if (!auth.currentUser) {
          return null;
        }
        return auth.currentUser.getIdToken();
      },
    }),
    [user, role, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
