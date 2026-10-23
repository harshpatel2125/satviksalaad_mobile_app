import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';

const ID = 'ss-storage';
const KEY_NAME = 'ss_storage_key';
// Readable when the app is woken in the background while the phone is locked.
const KEY_OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

function randomKey(): string {
  return Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

function openStorage(): MMKV {
  // MMKV cannot encrypt on web.
  if (Platform.OS === 'web') return createMMKV({ id: ID });
  try {
    const key = SecureStore.getItem(KEY_NAME, KEY_OPTIONS);
    if (key) return createMMKV({ id: ID, encryptionKey: key, encryptionType: 'AES-256' });

    // Data written before there was a key is still plain text.
    const newKey = randomKey();
    const store = createMMKV({ id: ID });
    SecureStore.setItem(KEY_NAME, newKey, KEY_OPTIONS);
    store.encrypt(newKey, 'AES-256');
    return store;
  } catch {
    // No keychain: a cache keyed for this launch only, never plain text.
    const store = createMMKV({ id: `${ID}-volatile`, encryptionKey: randomKey(), encryptionType: 'AES-256' });
    store.clearAll();
    return store;
  }
}

export const storage = openStorage();
