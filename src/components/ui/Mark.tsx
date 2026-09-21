import { cn } from "@/lib/cn";

/*
 * As duas marcas redondas do design v3 — nomes diferentes porque significam
 * coisas diferentes:
 *
 * - `EntityMark` é a coisa (tarefa, cliente): duas letras, contorno
 *   `border-soft`, 26px na linha da lista e 36px no card;
 * - `PersonAvatar` é gente (responsável, autor do comentário): uma letra,
 *   sem contorno, fundo `border`.
 */

/** "Clínica Aurora" → "CA"; "Montê bar" → "MB"; "aurora" → "A". */
export function initialsOf(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

export function EntityMark({
  name,
  size = 26,
  className,
}: {
  name: string;
  size?: 26 | 36;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill border border-border-soft font-semibold",
        size === 36
          ? "h-9 w-9 bg-surface-3 text-[12px] text-fg-4"
          : "h-[26px] w-[26px] bg-surface-2 text-[10px] text-initials",
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

export function PersonAvatar({
  name,
  size = 22,
  className,
}: {
  name: string;
  size?: 22 | 24 | 26;
  className?: string;
}) {
  const ch = (name || "—").trim().charAt(0).toUpperCase() || "—";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill bg-border font-semibold",
        size === 26
          ? "h-[26px] w-[26px] text-[12px] text-fg-soft"
          : size === 24
            ? "h-6 w-6 text-[10px] text-initials-strong"
            : "h-[22px] w-[22px] text-[10px] text-initials-strong",
        className,
      )}
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}

/** Avatar + nome, do jeito que a célula RESPONSÁVEL e o rodapé do card fazem. */
export function PersonChip({
  name,
  size = 22,
  className,
}: {
  name: string;
  size?: 22 | 24;
  className?: string;
}) {
  const empty = !name || name === "—";
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      {empty ? (
        <span className="h-[22px] w-[22px] shrink-0 rounded-pill border border-dashed border-border" />
      ) : (
        <PersonAvatar name={name} size={size} />
      )}
      <span
        className={cn(
          "truncate",
          size === 24 ? "text-[12px]" : "text-[13px]",
          empty ? "text-muted" : "text-fg-3",
        )}
      >
        {empty ? "Sem responsável" : name}
      </span>
    </span>
  );
}
