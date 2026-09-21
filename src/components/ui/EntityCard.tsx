import { cn } from "@/lib/cn";
import { EntityMark } from "./Mark";
import { FieldLabel } from "./Screen";

/*
 * O card do design v3 — o mesmo objeto no Quadro de tarefas e na Grade de
 * clientes, e por isso um componente só.
 *
 * Forma do export: fundo `surface-2`, contorno `border`, raio 14, 16px de
 * respiro e 14px entre blocos, separados por réguas `divider`. O conteúdo do
 * meio muda (PRAZO na tarefa; SERVIÇOS + FATURAMENTO no cliente) e entra como
 * `children`, usando `CardField` e `CardRow`.
 */

export function EntityCard({
  name,
  sub,
  badge,
  footer,
  index = 0,
  onClick,
  className,
  children,
  ...rest
}: {
  name: string;
  sub?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  index?: number;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "children">) {
  return (
    <div
      onClick={onClick}
      style={{ ["--d" as string]: index }}
      className={cn(
        "stagger-item group flex h-fit w-full flex-col gap-3.5 rounded-tile border border-border bg-surface-2 p-4",
        "transition-[transform,border-color] duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityMark name={name} size={36} />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="truncate text-[13px] font-semibold text-fg">
              {name}
            </span>
            {sub && (
              <span className="truncate text-[12px] text-muted">{sub}</span>
            )}
          </div>
        </div>
        {badge}
      </div>

      {children && (
        <>
          <CardDivider />
          {children}
        </>
      )}

      {footer && (
        <>
          <CardDivider />
          <div className="flex w-full items-center justify-between gap-2">
            {footer}
          </div>
        </>
      )}
    </div>
  );
}

export function CardDivider() {
  return <span className="h-px w-full shrink-0 bg-divider" aria-hidden="true" />;
}

/** Rótulo em cima, valor embaixo — o bloco SERVIÇOS do card de cliente. */
export function CardField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <FieldLabel>{label}</FieldLabel>
      <span className="text-[12px] text-fg-3">{children}</span>
    </div>
  );
}

/** Rótulo à esquerda, valor à direita — PRAZO e FATURAMENTO. */
export function CardRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <FieldLabel>{label}</FieldLabel>
      <span className="truncate text-[12px] font-medium text-value">
        {children}
      </span>
    </div>
  );
}
