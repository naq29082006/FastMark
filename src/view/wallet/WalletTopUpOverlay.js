import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import { loadReservationResume } from '../../viewmodel/buyer/reservationResumeSession';
import { subscribeTopupDeepLink } from '../../viewmodel/wallet/topupSession';
import { resolveTopupReturnViewModel } from '../../viewmodel/wallet/walletViewModel';
import TopUpScreen from './TopUpScreen';
import TopUpSuccessScreen from './TopUpSuccessScreen';

function resolveTopUpBackLabel(returnTo) {
  if (returnTo === 'reservation') {
    return 'Tiếp tục giữ hàng';
  }
  return 'Về ví FastMark';
}

export default function WalletTopUpOverlay({
  balance = 0,
  returnTo = 'wallet',
  onClose,
  onContinueReservationAfterTopUp,
  onOpenWallet,
}) {
  const dispatch = useDispatch();
  const [topUpResult, setTopUpResult] = useState(null);

  useEffect(() => {
    return subscribeTopupDeepLink(async (parsed) => {
      if (parsed?.cancelled) {
        return;
      }
      try {
        const resolved = await resolveTopupReturnViewModel(parsed);
        if (resolved?.transaction?.status === 1) {
          setTopUpResult({
            amount: resolved.transaction.amount,
            orderCode: resolved.transaction.orderCode,
          });
          dispatch(loadUserProfile());
        }
      } catch {
        // User can sync manually from wallet history.
      }
    });
  }, [dispatch]);

  async function finishReservationReturn() {
    let resume = null;
    try {
      resume = await loadReservationResume();
    } catch {
      resume = null;
    }
    onClose?.();
    if (resume?.productId) {
      onContinueReservationAfterTopUp?.(resume);
    }
  }

  async function handleTopUpBack() {
    if (returnTo === 'reservation') {
      await finishReservationReturn();
      return;
    }
    onClose?.();
    if (returnTo === 'wallet') {
      onOpenWallet?.();
    }
  }

  async function handleTopUpSuccess(result) {
    dispatch(loadUserProfile());
    if (returnTo === 'reservation') {
      await finishReservationReturn();
      return;
    }
    setTopUpResult(result || null);
  }

  if (topUpResult) {
    return (
      <View style={styles.screen}>
        <TopUpSuccessScreen
          amount={topUpResult.amount || 0}
          orderCode={topUpResult.orderCode}
          backLabel={resolveTopUpBackLabel(returnTo)}
          onContinueReservation={(payload) => {
            onClose?.();
            onContinueReservationAfterTopUp?.(payload);
          }}
          onBackHome={async () => {
            onClose?.();
            if (returnTo === 'reservation') {
              let resume = null;
              try {
                resume = await loadReservationResume();
              } catch {
                resume = null;
              }
              if (resume?.productId) {
                onContinueReservationAfterTopUp?.(resume);
              }
              return;
            }
            if (returnTo === 'wallet') {
              onOpenWallet?.();
            }
          }}
          onViewHistory={() => {
            onClose?.();
            onOpenWallet?.('wallet-transactions');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopUpScreen balance={balance} onBack={handleTopUpBack} onSuccess={handleTopUpSuccess} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafb',
  },
});
