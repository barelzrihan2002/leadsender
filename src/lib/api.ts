// Helper to access the Electron API with type safety
// Check if electron API is available
if (!window.electron) {
  console.error('Electron API is not available. Make sure the preload script is loaded correctly.');
}

export const api = window.electron || {} as any;

// Event listener helpers
export function onAccountStatusChange(callback: (accountId: string, status: string) => void) {
  if (!api.on) return () => {};
  api.on('account:status', callback);
  return () => api.removeListener?.('account:status', callback);
}

export function onNewMessage(callback: (message: any) => void) {
  if (!api.on) return () => {};
  api.on('message:new', callback);
  return () => api.removeListener?.('message:new', callback);
}

export function onCampaignProgress(callback: (campaignId: string, progress: any) => void) {
  if (!api.on) return () => {};
  api.on('campaign:progress', callback);
  return () => api.removeListener?.('campaign:progress', callback);
}

export function onQRCode(callback: (accountId: string, qrCode: string) => void) {
  if (!api.on) return () => {};
  api.on('account:qr', callback);
  return () => api.removeListener?.('account:qr', callback);
}

export function onPairingCode(callback: (accountId: string, code: string) => void) {
  if (!api.on) return () => {};
  api.on('account:pairing', callback);
  return () => api.removeListener?.('account:pairing', callback);
}
