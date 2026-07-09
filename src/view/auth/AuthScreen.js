import { useState } from 'react';

import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');

  if (mode === 'register') {
    return (
      <RegisterScreen
        onGoBack={() => setMode('login')}
        onGoLogin={() => setMode('login')}
      />
    );
  }

  return <LoginScreen onGoRegister={() => setMode('register')} />;
}
