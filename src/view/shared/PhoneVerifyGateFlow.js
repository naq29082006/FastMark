import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import SellerPhoneSetupScreen from '../seller/SellerPhoneSetupScreen';

export default function PhoneVerifyGateFlow({ visible, onCancel, onVerified }) {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setResetKey((value) => value + 1);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <SellerPhoneSetupScreen
          key={resetKey}
          mode="transaction"
          onBack={onCancel}
          onVerified={onVerified}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
