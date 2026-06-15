import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_ALIAS = 'reglim_takvim_db_key';

// Platform-aware secure store helpers
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(`sec_${key}`);
      }
    } catch (e) {
      console.error('Failed to get item from web secure storage:', e);
    }
    return null;
  }
  return await SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`sec_${key}`, value);
      }
    } catch (e) {
      console.error('Failed to set item in web secure storage:', e);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`sec_${key}`);
      }
    } catch (e) {
      console.error('Failed to delete item from web secure storage:', e);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Retrieves the local data encryption key or generates a new one if it doesn't exist.
 * The key is stored securely in Expo SecureStore.
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    let key = await secureGet(ENCRYPTION_KEY_ALIAS);
    if (!key) {
      // Generate a strong random 256-bit key
      key = CryptoJS.lib.WordArray.random(32).toString();
      await secureSet(ENCRYPTION_KEY_ALIAS, key);
    }
    return key;
  } catch (error) {
    console.error('Failed to get/create encryption key:', error);
    // Fallback key (not ideal, but prevents app crashes if SecureStore fails)
    return 'fallback_reglim_takvim_secure_key_123!';
  }
}

/**
 * Encrypts a string using AES-256.
 */
export async function encryptText(text: string): Promise<string> {
  if (!text) return '';
  const key = await getOrCreateEncryptionKey();
  return CryptoJS.AES.encrypt(text, key).toString();
}

/**
 * Decrypts a string using AES-256.
 */
export async function decryptText(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  try {
    const key = await getOrCreateEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      console.warn('Decryption resulted in empty string, returning raw input.');
      return encryptedText; // Return original if key mismatch or not encrypted
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Fallback to raw text
  }
}

/**
 * Checks if the device has biometric hardware and enrolled biometrics.
 */
export async function hasBiometrics(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (error) {
    console.error('Error checking biometrics hardware:', error);
    return false;
  }
}

/**
 * Authenticates the user using device biometrics (Fingerprint/FaceID).
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Giriş yapmak için parmak izinizi kullanın'
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const isAvailable = await hasBiometrics();
  if (!isAvailable) return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'PIN Kullan',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
}

/**
 * Saves the user's PIN code.
 */
export async function savePIN(pin: string): Promise<void> {
  await secureSet('user_pin', pin);
}

/**
 * Verifies if the entered PIN matches the stored PIN.
 */
export async function verifyPIN(pin: string): Promise<boolean> {
  const storedPin = await secureGet('user_pin');
  return storedPin === pin;
}

/**
 * Checks if a PIN has been configured.
 */
export async function hasPINSet(): Promise<boolean> {
  const storedPin = await secureGet('user_pin');
  return storedPin !== null;
}

/**
 * Removes the PIN configuration.
 */
export async function clearPIN(): Promise<void> {
  await secureDelete('user_pin');
}

