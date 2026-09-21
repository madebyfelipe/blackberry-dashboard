import { cn } from "@/lib/cn";

/*
 * O painel de conteúdo do design system v3.
 *
 * Toda tela redesenhada (Tarefas · Lista, Tarefas · Quadro, Descrição da
 * tarefa, Clientes · Lista, Clientes · Grade) é o mesmo retângulo: fundo
 * `surface`, contorno de 1px em branco a 8% (`panel-ring`), raio de 28px e
 * 28px de respiro interno. O shell (`app/(app)/layout.tsx`) já dá o fundo
 * preto e os 16px de folga em volta — aqui dentro não se mexe nisso.
 *
 * `gap` é a única variação entre os exports: 20px nas Tarefas, 18px nos
 * Clientes. Fica como prop em vez de virar duas cópias do painel.
 */
export function Screen({
  gap = "lg",
  className,
  children,
}: {
  gap?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-screen border border-panel-ring bg-surface",
        // No celular o respiro de 28px come quase um quarto de 390px.
        "p-4 md:p-7",
        gap === "lg" ? "gap-4 md:gap-5" : "gap-3.5 md:gap-[18px]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * A linha entre a trilha e o corpo: abas à esquerda, ações à direita. Uma
 * linha só, sempre — as abas rolam na horizontal e os botões ficam parados,
 * senão o menu que abre ancorado à direita do botão sai da área visível.
 */
export function ScreenHeader({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center justify-between gap-3">
      {children}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/**
 * Ação principal do cabeçalho ("Nova tarefa", "Novo cliente"): retângulo de
 * raio 6, fundo `border` e o mesmo contorno translúcido do painel.
 */
export function ScreenAction({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "tap flex shrink-0 items-center justify-center rounded-mark border border-panel-ring bg-border px-5 py-2.5",
        "text-[13px] font-medium text-fg transition-colors hover:bg-border-strong",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        className,
      )}
      {...props}
    />
  );
}

/**
 * O quadrado claro de 36px ao lado da ação principal — no export é o "⋯" da
 * tela inteira, o único botão invertido do cabeçalho.
 */
export function ScreenIconAction({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "tap flex h-9 w-9 shrink-0 items-center justify-center rounded-mark bg-primary text-on-primary transition-colors hover:bg-white",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Rótulo de seção/coluna: 11px, semibold, caixa alta com 0.6px de espaço
 * entre letras. Serve o cabeçalho da tabela e os campos dos cards.
 */
export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.6px] text-label",
        className,
      )}
    >
      {children}
    </span>
  );
}
