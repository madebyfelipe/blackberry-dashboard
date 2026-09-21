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

/** "12 set 2026 · 09:30" — campo DATA DE PUBLICAÇÃO do editor de lote. */
export function formatPublishDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()} · ${time}`;
}

/** "12 DE SETEMBRO" — rodapé do preview do Instagram. */
export function formatPostDate(iso: string): string {
  const full = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} DE ${full[d.getMonth()].toUpperCase()}`;
}

/**
 * "agora", "5h atrás", "2d atrás" — carimbo do registro de atividade e dos
 * comentários na tela de descrição da tarefa. É a forma que o export usa,
 * distinta do "há 2 min" da pílula de rascunho do editor de lote logo abaixo.
 */
export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return formatShortDate(iso);
}

/** "agora", "há 2 min", "há 3 h", "há 4 d" — pílula de rascunho do editor. */
export function formatAgo(iso?: string): string {
  if (!iso) return "não salvo";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "não salvo";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** "clinica.aurora" — @ aproximado do cliente para o preview do post. */
export function handleFromClient(client: string): string {
  return client
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(".");
}

/** ISO → valor de <input type="datetime-local"> no fuso local. */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
