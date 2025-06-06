import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'your-fallback-key';

export function encryptCredentials(credentials: string): string {
  return CryptoJS.AES.encrypt(credentials, SECRET_KEY).toString();
}

export function decryptCredentials(encryptedCredentials: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedCredentials, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function generateOfflineToken(userId: string, storeId: string): string {
  const token = `${userId}:${storeId}:${Date.now()}`;
  return encryptCredentials(token);
}

export function validateOfflineToken(token: string): { userId: string; storeId: string; timestamp: number } | null {
  try {
    const decrypted = decryptCredentials(token);
    const [userId, storeId, timestamp] = decrypted.split(':');
    return {
      userId,
      storeId,
      timestamp: parseInt(timestamp)
    };
  } catch (error) {
    return null;
  }
} 