import { cn } from "@/lib/cn";

/**
 * A chave liga-desliga dos Fluxos: `md` é a do cabeçalho do fluxo e do
 * "Ativar ao criar" (34×20), `sm` a das ações automáticas. Só desenha — quem
 * usa põe `role="switch"` no botão em volta.
 */
export function Switch({ on, size = "sm" }: { on: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center rounded-pill px-0.5 transition-colors",
        size === "md" ? "h-5 w-[34px]" : "h-3.5 w-[26px]",
        on ? "justify-end bg-primary" : "justify-start bg-border",
      )}
    >
      <span
        className={cn(
          "rounded-full transition-colors",
          size === "md" ? "h-4 w-4" : "h-2.5 w-2.5",
          on ? "bg-flow-panel" : "bg-muted",
        )}
      />
    </span>
  );
}
