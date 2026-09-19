import { cn } from "@/lib/cn";

/**
 * Indicador de "estou trabalhando" — anel de 1.5px com um quarto aceso.
 * Some com `prefers-reduced-motion` (a regra global para o laço infinito),
 * então quem chama sempre acompanha com texto ("Salvando…").
 */
export function Spinner({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderWidth: Math.max(1.5, size / 9) }}
      className={cn(
        "inline-block animate-spin-slow rounded-full border-current border-t-transparent opacity-70",
        className,
      )}
    />
  );
}
