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

interface OfflineCredentials {
  email: string;
  password?: string; // Optional, only stored if user was online during signup/login
  hashedPassword?: string; // Optional, will be computed during validation if not present
}

interface OfflineTokenData {
  userId: string;
  storeId: string;
  userMetadata?: UserMetadata;
  credentials?: OfflineCredentials; // Optional credentials for offline auth
}

export function generateOfflineToken(
  userId: string, 
  storeId: string, 
  userMetadata?: UserMetadata,
  credentials?: OfflineCredentials
): string {
  const tokenData: OfflineTokenData = {
    userId,
    storeId,
    userMetadata,
    credentials
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

export async function validateOfflineCredentials(
  storedCredentials: OfflineCredentials,
  email: string,
  password: string
): Promise<boolean> {
  if (!storedCredentials) return false;
  
  // If we have the actual password stored (from online login)
  if (storedCredentials.password) {
    return storedCredentials.email === email && storedCredentials.password === password;
  }
  
  // If we have a stored hashed password, validate against it
  if (storedCredentials.hashedPassword) {
    return storedCredentials.email === email && 
           storedCredentials.hashedPassword === await hashPassword(password);
  }
  
  // If no stored password or hash, compute hash and store it for future use
  const computedHash = await hashPassword(password);
  storedCredentials.hashedPassword = computedHash;
  return storedCredentials.email === email;
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode.apply(null, hashArray));
} 