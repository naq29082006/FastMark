import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {mode === 'forgot' ? (
        <ForgotPasswordScreen
          onBack={() => setMode('login')}
          onSuccess={() => setMode('login')}
        />
      ) : mode === 'register' ? (
        <RegisterScreen onGoBack={() => setMode('login')} onGoLogin={() => setMode('login')} />
      ) : (
        <LoginScreen onGoRegister={() => setMode('register')} onGoForgot={() => setMode('forgot')} />
      )}
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#e7f0ed',
  },
};
