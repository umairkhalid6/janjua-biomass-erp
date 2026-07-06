// Phone-number helpers for WhatsApp deep links.
// Numbers are stored free-form; wa.me requires E.164 digits with no "+".

/**
 * Normalize a (mostly Pakistani) phone number to wa.me digit form: country
 * code + national number, digits only, no "+" or separators.
 *
 * Handles the common local formats:
 *   0300-1234567 / 0300 1234567 / 03001234567  → 923001234567
 *   3001234567 (leading 0 dropped)             → 923001234567
 *   +92 300 1234567 / 923001234567             → 923001234567
 *
 * Returns null when the input can't be resolved to a plausible number, so
 * callers can fall back to a numberless share link.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);

  // Local mobile with leading 0 → replace 0 with the 92 country code.
  if (d.startsWith("0")) d = "92" + d.slice(1);
  // 10-digit mobile with the leading 0 dropped (3XXXXXXXXX).
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;

  // Canonical PK mobile: 92 followed by a 10-digit number starting 3.
  if (/^923\d{9}$/.test(d)) return d;

  // Otherwise accept any plausible international number (11–15 digits).
  if (/^\d{11,15}$/.test(d)) return d;

  return null;
}
