let openWalletTopUpHandler = null;

export function registerWalletTopUpHandler(handler) {
  openWalletTopUpHandler = typeof handler === 'function' ? handler : null;
}

export function unregisterWalletTopUpHandler() {
  openWalletTopUpHandler = null;
}

export function requestWalletTopUp(context = null) {
  openWalletTopUpHandler?.(context);
}
