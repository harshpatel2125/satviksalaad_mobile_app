// GST added on top of a price, the same way the website and invoices work it out.

/** GST on a pre-tax amount, rounded up to the paisa so the invoice's own back-calculation agrees. */
export function addGst(taxablePaise: number, gstRateBps: number): { taxPaise: number; totalPaise: number } {
  if (gstRateBps <= 0 || taxablePaise <= 0) return { taxPaise: 0, totalPaise: Math.max(0, taxablePaise) };
  const taxPaise = Math.ceil((taxablePaise * gstRateBps) / 10000);
  return { taxPaise, totalPaise: taxablePaise + taxPaise };
}

/** 500 → "5%". */
export function formatGstRate(gstRateBps: number): string {
  const pct = gstRateBps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

/** "+ 5% GST" when GST is added at checkout, otherwise null. */
export function gstNote(gstRateBps: number): string | null {
  return gstRateBps > 0 ? `+ ${formatGstRate(gstRateBps)} GST` : null;
}

/** "₹1,449" or "₹1,883.70". */
export function rupeesFromPaise(paise: number): string {
  const whole = Math.floor(paise / 100).toLocaleString('en-IN');
  const fraction = Math.round(paise) % 100;
  return fraction === 0 ? `₹${whole}` : `₹${whole}.${String(fraction).padStart(2, '0')}`;
}
