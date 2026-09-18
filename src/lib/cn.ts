/**
 * Minimal className joiner — keeps the app dependency-free.
 * Falsy values are dropped; later values simply append (no conflict resolution).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
