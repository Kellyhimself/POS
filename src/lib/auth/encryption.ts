import { encrypt, decrypt } from './crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'your-fallback-key';

export function encryptCredentials(credentials: string): string {
  return CryptoJS.AES.encrypt(credentials, SECRET_KEY).toString();
}

export function decryptCredentials(encryptedCredentials: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedCredentials, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export interface UserMetadata {
  email?: string;
  first_name?: string;
  name?: string;
  store_name?: string;
  [key: string]: unknown;
}

interface OfflineTokenData {
  userId: string;
  storeId: string;
  userMetadata?: UserMetadata;
}

export function generateOfflineToken(userId: string, storeId: string, userMetadata?: UserMetadata): string {
  const tokenData: OfflineTokenData = {
    userId,
    storeId,
    userMetadata
  };
  
  return encrypt(JSON.stringify(tokenData));
}

export function validateOfflineToken(token: string): OfflineTokenData | null {
  try {
    const decrypted = decrypt(token);
    const data = JSON.parse(decrypted) as OfflineTokenData;
    
    if (!data.userId || !data.storeId) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error validating offline token:', error);
    return null;
  }
} 