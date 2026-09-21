import { cn } from "@/lib/cn";

/*
 * O selo do design system v3: retângulo de raio 6 com 4px/9px de respiro e
 * rótulo de 11–11.5px medium.
 *
 * Duas formas:
 * - neutra (`bg-badge-neutral`), com o texto carregando o significado — é o
 *   status da tarefa, onde a escala inteira é de cinzas;
 * - colorida, com o par fundo/texto vindo pronto de uma régua (`bg`/`fg` são
 *   sempre `var(--token)` de `globals.css`, nunca hex — ver
 *   `tests/design-tokens.test.ts`).
 */

export function Badge({
  label,
  bg,
  fg,
  size = "sm",
  className,
}: {
  label: string;
  /** `var(--token)`; ausente, o selo usa o fundo neutro. */
  bg?: string;
  /** `var(--token)`; ausente, o selo usa `fg-soft`. */
  fg?: string;
  /** 11px no card, 11.5px na linha da lista — o export desenha os dois. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-mark px-[9px] py-1 font-medium whitespace-nowrap",
        size === "md" ? "text-[11.5px]" : "text-[11px]",
        !bg && "bg-badge-neutral",
        !fg && "text-fg-soft",
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

/** Etiqueta livre da tarefa: mesmo selo, fundo `border`. */
export function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-mark bg-border px-[9px] py-1 text-[11px] font-medium text-fg-soft">
      {label}
    </span>
  );
}
