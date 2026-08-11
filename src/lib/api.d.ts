export declare const api: any;
export declare function onAccountStatusChange(callback: (accountId: string, status: string) => void): () => void;
export declare function onNewMessage(callback: (message: any) => void): () => void;
export declare function onCampaignProgress(callback: (campaignId: string, progress: any) => void): () => void;
export declare function onQRCode(callback: (accountId: string, qrCode: string) => void): () => void;
export declare function onPairingCode(callback: (accountId: string, code: string) => void): () => void;
