// Helper to access the Electron API with type safety
// Check if electron API is available
if (!window.electron) {
    console.error('Electron API is not available. Make sure the preload script is loaded correctly.');
}
export const api = window.electron || {};
// Event listener helpers
export function onAccountStatusChange(callback) {
    if (!api.on)
        return () => { };
    api.on('account:status', callback);
    return () => api.removeListener?.('account:status', callback);
}
export function onNewMessage(callback) {
    if (!api.on)
        return () => { };
    api.on('message:new', callback);
    return () => api.removeListener?.('message:new', callback);
}
export function onCampaignProgress(callback) {
    if (!api.on)
        return () => { };
    api.on('campaign:progress', callback);
    return () => api.removeListener?.('campaign:progress', callback);
}
export function onQRCode(callback) {
    if (!api.on)
        return () => { };
    api.on('account:qr', callback);
    return () => api.removeListener?.('account:qr', callback);
}
export function onPairingCode(callback) {
    if (!api.on)
        return () => { };
    api.on('account:pairing', callback);
    return () => api.removeListener?.('account:pairing', callback);
}
