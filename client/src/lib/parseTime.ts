/**
 * Turns what a person types into seconds.
 *   "90" -> 90      "1:30" -> 90      "1:02:03" -> 3723
 * Returns null when it isn't a valid time (letters, "1:75", empty...).
 */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null;
  if (parts.slice(1).some((p) => Number(p) >= 60)) return null; // minutes/seconds after the first part must be < 60
  return parts.map(Number).reduce((total, n) => total * 60 + n, 0);
}