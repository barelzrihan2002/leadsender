import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../src/types';

console.log('🚀 Preload script is executing!');
console.log('contextBridge available:', typeof contextBridge);
console.log('ipcRenderer available:', typeof ipcRenderer);

// Increase max listeners to prevent warnings (multiple pages can listen to same events)
ipcRenderer.setMaxListeners(50);

const electronAPI: ElectronAPI = {
  license: {
    check: () => ipcRenderer.invoke('license:check'),
    activate: (licenseKey) => ipcRenderer.invoke('license:activate', licenseKey),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    getUser: () => ipcRenderer.invoke('license:getUser'),
  },

  accounts: {
    getAll: () => ipcRenderer.invoke('accounts:getAll'),
    getById: (id) => ipcRenderer.invoke('accounts:getById', id),
    create: (data) => ipcRenderer.invoke('accounts:create', data),
    update: (id, data) => ipcRenderer.invoke('accounts:update', id, data),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id),
    connect: (id, proxy, pairingMethod) => ipcRenderer.invoke('accounts:connect', id, proxy, pairingMethod),
    disconnect: (id) => ipcRenderer.invoke('accounts:disconnect', id),
    getQRCode: (id) => ipcRenderer.invoke('accounts:getQRCode', id),
    updateWhatsAppName: (id, name) => ipcRenderer.invoke('accounts:updateWhatsAppName', id, name),
    updateWhatsAppImage: (id, imagePath) => ipcRenderer.invoke('accounts:updateWhatsAppImage', id, imagePath),
    refreshProfilePicture: (id) => ipcRenderer.invoke('accounts:refreshProfilePicture', id),
  },

  campaigns: {
    getAll: () => ipcRenderer.invoke('campaigns:getAll'),
    getById: (id) => ipcRenderer.invoke('campaigns:getById', id),
    create: (data) => ipcRenderer.invoke('campaigns:create', data),
    update: (id, data) => ipcRenderer.invoke('campaigns:update', id, data),
    delete: (id) => ipcRenderer.invoke('campaigns:delete', id),
    start: (id) => ipcRenderer.invoke('campaigns:start', id),
    pause: (id) => ipcRenderer.invoke('campaigns:pause', id),
    stop: (id) => ipcRenderer.invoke('campaigns:stop', id),
    reset: (id) => ipcRenderer.invoke('campaigns:reset', id),
    getStats: (id) => ipcRenderer.invoke('campaigns:getStats', id),
    addContacts: (id, contacts) => ipcRenderer.invoke('campaigns:addContacts', id, contacts),
    getContacts: (id) => ipcRenderer.invoke('campaigns:getContacts', id),
    addAccounts: (campaignId, accountIds) => ipcRenderer.invoke('campaigns:addAccounts', campaignId, accountIds),
    getAccounts: (campaignId) => ipcRenderer.invoke('campaigns:getAccounts', campaignId),
    saveMedia: (fileName, buffer) => ipcRenderer.invoke('campaigns:save-media', fileName, buffer),
  },

  contacts: {
    getAll: () => ipcRenderer.invoke('contacts:getAll'),
    getById: (id) => ipcRenderer.invoke('contacts:getById', id),
    create: (data) => ipcRenderer.invoke('contacts:create', data),
    update: (id, data) => ipcRenderer.invoke('contacts:update', id, data),
    delete: (id) => ipcRenderer.invoke('contacts:delete', id),
    selectFile: () => ipcRenderer.invoke('contacts:selectFile'),
    checkDuplicates: (filePath, country) => ipcRenderer.invoke('contacts:checkDuplicates', filePath, country),
    previewFile: (filePath, country) => ipcRenderer.invoke('contacts:previewFile', filePath, country),
    importFromFile: (filePath, country?, duplicateAction?) => ipcRenderer.invoke('contacts:importFromFile', filePath, country, duplicateAction),
    addTag: (contactId, tagId) => ipcRenderer.invoke('contacts:addTag', contactId, tagId),
    removeTag: (contactId, tagId) => ipcRenderer.invoke('contacts:removeTag', contactId, tagId),
  },

  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    create: (data) => ipcRenderer.invoke('tags:create', data),
    update: (id, data) => ipcRenderer.invoke('tags:update', id, data),
    delete: (id) => ipcRenderer.invoke('tags:delete', id),
  },

  messages: {
    getByChat: (chatId, accountId) => ipcRenderer.invoke('messages:getByChat', chatId, accountId),
    getChats: (accountId) => ipcRenderer.invoke('messages:getChats', accountId),
    send: (accountId, to, message) => ipcRenderer.invoke('messages:send', accountId, to, message),
    sendMedia: (accountId, to, filePath, caption) => ipcRenderer.invoke('messages:sendMedia', accountId, to, filePath, caption),
    saveTempFile: (fileName, buffer) => ipcRenderer.invoke('messages:saveTempFile', fileName, buffer),
    deleteTempFile: (filePath) => ipcRenderer.invoke('messages:deleteTempFile', filePath),
    markAsHandled: (chatId, accountId) => ipcRenderer.invoke('messages:markAsHandled', chatId, accountId),
  },

  warmup: {
    start: (accountIds, minDelay, maxDelay) => ipcRenderer.invoke('warmup:start', accountIds, minDelay, maxDelay),
    stop: (sessionId) => ipcRenderer.invoke('warmup:stop', sessionId),
    getActive: () => ipcRenderer.invoke('warmup:getActive'),
  },

  stats: {
    getDashboard: () => ipcRenderer.invoke('stats:getDashboard'),
    getRecentActivities: (limit) => ipcRenderer.invoke('stats:getRecentActivities', limit),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('updater:install-update'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
  },

  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

console.log('About to expose API to main world...');

try {
  contextBridge.exposeInMainWorld('electron', electronAPI);
  console.log('✅ Electron API exposed successfully via contextBridge');
} catch (error) {
  console.error('❌ Failed to expose Electron API:', error);
  // Fallback: expose directly (less secure but works)
  (window as any).electron = electronAPI;
  console.log('⚠️ Exposed via window as fallback');
}
