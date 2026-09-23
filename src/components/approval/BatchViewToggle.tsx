import Link from "next/link";
import { cn } from "@/lib/cn";
import { CalendarIcon, LayoutGridIcon } from "@/components/icons";

/*
 * Alterna o lote entre as duas formas de montar: o Planejamento (calendário)
 * e os Criativos (o editor de sempre). Cada uma tem a sua URL, então o
 * "voltar" do navegador e o link copiado caem na vista certa.
 */
export function BatchViewToggle({
  clientSlug,
  batchId,
  active,
}: {
  clientSlug: string;
  batchId: string;
  active: "planejamento" | "criativos";
}) {
  const base = `/social/${clientSlug}/${batchId}`;
  const item = (id: typeof active, href: string, label: string, Icon: typeof CalendarIcon) => (
    <Link
      href={href}
      aria-current={active === id ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-pill px-3 text-[12px] font-semibold transition-colors",
        active === id ? "bg-primary text-on-primary" : "text-muted hover:text-fg-soft",
      )}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
  return (
    <nav aria-label="Vista do lote" className="flex shrink-0 items-center gap-0.5 rounded-pill border border-border bg-surface p-1">
      {item("planejamento", `${base}/planejamento`, "Planejamento", CalendarIcon)}
      {item("criativos", `${base}/editor`, "Criativos", LayoutGridIcon)}
    </nav>
  );
}
