export interface RazorpayFailure {
  /** The customer closed the checkout; nothing to report. */
  cancelled: boolean;
  /** Safe to show the customer. */
  message: string;
  /** For analytics. */
  reason: string;
}

const FALLBACK = "The payment didn't go through, and you haven't been charged. Please try again.";

/**
 * Reads a rejection from RazorpayCheckout.open(). The Android SDK packs its error
 * into `description` as JSON, and reports a checkout closed mid-payment as a
 * customer-side failure with no description.
 */
export function readRazorpayError(err: unknown): RazorpayFailure {
  const { code, description = '' } = (err ?? {}) as { code?: number; description?: string };
  let text = description;
  let reason = '';
  let source = '';
  try {
    const parsed = JSON.parse(description) as { error?: { description?: string; reason?: string; source?: string } };
    if (parsed?.error) {
      text = parsed.error.description && parsed.error.description !== 'undefined' ? parsed.error.description : '';
      reason = parsed.error.reason ?? '';
      source = parsed.error.source ?? '';
    }
  } catch {
    // A plain-text description.
  }
  const cancelled = code === 2 || /cancel|dismiss/i.test(`${text} ${reason}`) || (source === 'customer' && !text);
  return { cancelled, message: text || FALLBACK, reason: reason || text || 'unknown' };
}
