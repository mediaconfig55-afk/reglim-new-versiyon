import { encryptText, decryptText, savePIN, verifyPIN, hasPINSet, clearPIN } from '../utils/security';

// Mock Expo SecureStore to work in pure node/jest environment
jest.mock('expo-secure-store', () => {
  const store: { [key: string]: string } = {};
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] || null)),
    setItemAsync: jest.fn((key: string, val: string) => {
      store[key] = val;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
});

describe('Security & Encryption Tests', () => {
  test('should successfully encrypt and decrypt a sensitive medical note', async () => {
    const rawNote = 'Bugün çok şiddetli kramplarım oldu ve tansiyonum düştü.';
    
    // Encrypt
    const cipherText = await encryptText(rawNote);
    expect(cipherText).not.toBe(rawNote);
    expect(cipherText.length).toBeGreaterThan(16);

    // Decrypt
    const plainText = await decryptText(cipherText);
    expect(plainText).toBe(rawNote);
  });

  test('should return empty string if input is empty or null', async () => {
    const encrypted = await encryptText('');
    expect(encrypted).toBe('');

    const decrypted = await decryptText('');
    expect(decrypted).toBe('');
  });

  test('should verify PIN operations', async () => {
    const pin = '4321';
    
    // Clear and check setup
    await clearPIN();
    let isSet = await hasPINSet();
    expect(isSet).toBe(false);

    // Save
    await savePIN(pin);
    isSet = await hasPINSet();
    expect(isSet).toBe(true);

    // Verify correct PIN
    let match = await verifyPIN(pin);
    expect(match).toBe(true);

    // Verify incorrect PIN
    let mismatch = await verifyPIN('9999');
    expect(mismatch).toBe(false);
  });
});
