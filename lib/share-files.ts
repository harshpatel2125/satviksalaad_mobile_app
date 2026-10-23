import * as FileSystem from 'expo-file-system/legacy';

// Shared files can hold personal data, so they are kept apart from the rest
// of the cache and can be wiped in one go.
const SHARE_DIR = `${FileSystem.cacheDirectory}share/`;

/** A cache path for a file that is about to go to the share sheet. */
export async function shareFileUri(filename: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true });
  return SHARE_DIR + filename;
}

export async function deleteSharedFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function deleteAllSharedFiles(): Promise<void> {
  await FileSystem.deleteAsync(SHARE_DIR, { idempotent: true }).catch(() => {});
}
