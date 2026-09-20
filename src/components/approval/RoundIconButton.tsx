"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Botão redondo de 40px do cabeçalho — o mesmo objeto das Tarefas (busca,
 * filtros, visualização) e do Lote (formato, busca, menu do link).
 *
 * Vivia duplicado como `RoundBtn` no LoteView e `IconBtn` no TasksView; o
 * editor precisava do mesmo botão para os dois cabeçalhos ficarem com a mesma
 * altura, então virou um componente só aqui.
 *
 * Com `href` vira link (a seta de voltar), sem `href` vira botão. Nos dois
 * casos `label` é o `aria-label` e o `title` — como o conteúdo é só um ícone,
 * sem ele o botão não tem nome acessível.
 *
 * `tone="primary"` é o botão claro dos exports novos (o "+" de Clientes e de
 * Lotes, o copiar link do Lote). É variante daqui, e não `className` de fora:
 * `cn` só concatena, então um `bg-primary` vindo de fora briga com o
 * `bg-surface` do padrão e quem ganha é a ordem do CSS — foi assim que o
 * ícone do copiar link ficou escuro sobre fundo escuro, invisível.
 */
export function RoundIconButton({
  children,
  label,
  onClick,
  href,
  active,
  badge,
  expanded,
  tone = "surface",
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  badge?: number;
  /** Informa que o botão abre um menu e se ele está aberto. */
  expanded?: boolean;
  /** `primary` é o botão claro dos exports novos. */
  tone?: "surface" | "primary";
  className?: string;
}) {
  const classes = cn(
    // shrink-0: sem isso o flex achata o botão e ele deixa de ser redondo.
    "tap relative z-10 flex h-control w-control shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
    tone === "primary"
      ? "bg-primary text-on-primary hover:bg-white"
      : active
        ? "bg-border-strong text-fg"
        : "bg-surface text-fg-soft hover:bg-surface-2",
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes}>
        {children}
      </Link>
    );
  }

  /*
   * Só `aria-expanded`, sem `aria-haspopup="menu"`: o que abre não é um menu
   * de comandos, é um grupo de controles (chips, campo de data), e anunciar
   * "menu" prometeria uma navegação por setas que não existe.
   */
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={classes}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-scale-in items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-semibold text-on-primary">
          {badge}
        </span>
      )}
    </button>
  );
}
