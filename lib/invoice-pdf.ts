/**
 * Download an invoice PDF and offer the native share sheet: fetch the PDF from
 * the API with the session's bearer token, save it to the cache directory, then
 * open the share sheet so the user can save or forward it. The file is removed
 * once the sheet closes.
 */

// expo-file-system v19 uses a new File/Paths API. The legacy export keeps the
// classic cacheDirectory / writeAsStringAsync helpers we want here.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getAccessToken } from "./auth-session";
import { BASE_URL } from "./base-url";
import { deleteSharedFile, shareFileUri } from "./share-files";

export type DownloadResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function downloadAndShareInvoice(invoiceId: string, invoiceNumber: string): Promise<DownloadResult> {
  let localUri: string | null = null;
  try {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: "Not signed in" };

    const res = await fetch(`${BASE_URL}/api/v1/invoices/${invoiceId}/pdf`, {
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `Download failed (${res.status}): ${text.slice(0, 120)}` };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    localUri = await shareFileUri(`${invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`);

    await FileSystem.writeAsStringAsync(localUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (sharingAvailable) {
      await Sharing.shareAsync(localUri, {
        mimeType: "application/pdf",
        dialogTitle: `${invoiceNumber} · Satvik Salaad invoice`,
        UTI: "com.adobe.pdf",
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    if (localUri) void deleteSharedFile(localUri);
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  // Chunked encode to avoid blowing the call stack on big buffers
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  const g = globalThis as { btoa?: (s: string) => string };
  return typeof g.btoa === "function" ? g.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}
