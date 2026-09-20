import { cn } from "@/lib/cn";

/**
 * Inicial em disco. O fundo é `border-strong`: o export desenha o avatar em
 * #404040 e o mesmo cinza aparece como #414141 no resto do sistema — 1/255 de
 * diferença, invisível, e um token só em vez de dois.
 */
export function Avatar({
  initial,
  size = 26,
  className,
}: {
  initial: string;
  size?: number;
  className?: string;
}) {
  const ch = (initial || "—").trim().charAt(0).toUpperCase() || "—";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill bg-border-strong font-semibold text-fg-soft",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}
