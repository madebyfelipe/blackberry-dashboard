const MONTHS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Set 17" — as in the List View / Board (Mmm DD). */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${cap(MONTHS_PT[d.getMonth()])} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "02 set" — as in the approval piece cards (DD mmm). */
export function formatPieceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_PT[d.getMonth()]}`;
}
