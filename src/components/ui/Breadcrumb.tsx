import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export type Crumb = { label: string; href?: string };

/**
 * A trilha completa (`black berry › Social media › Cliente › Lote › Editor`)
 * cabe numa linha no desktop, mas no celular quebra em várias e come a tela
 * antes de qualquer conteúdo — era o pior problema do editor de lote.
 *
 * Abaixo de `md` ela vira uma versão compacta: "‹ nível anterior" (link) +
 * o nível atual (texto). `mobileMode="hidden"` tira a trilha do celular por
 * completo — para telas que já têm a própria seta de voltar no cabeçalho
 * (o editor), onde a versão compacta seria um segundo "voltar" repetido.
 */
export function Breadcrumb({
  items,
  mobileMode = "compact",
}: {
  items: Crumb[];
  mobileMode?: "compact" | "hidden";
}) {
  const last = items[items.length - 1];
  const prev = items.length > 1 ? items[items.length - 2] : undefined;

  return (
    <>
      <nav
        className="hidden min-w-0 items-center gap-2 text-[14px] md:flex"
        aria-label="Trilha"
      >
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <div key={i} className="flex items-center gap-2">
              {c.href && !isLast ? (
                <Link href={c.href} className="text-muted hover:text-fg-soft">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "font-semibold text-fg-soft" : "text-muted"}>
                  {c.label}
                </span>
              )}
              {!isLast && <ChevronRightIcon size={16} className="text-muted" />}
            </div>
          );
        })}
      </nav>

      {mobileMode === "compact" && (
        <nav
          className="flex min-w-0 items-center gap-1 text-[14px] md:hidden"
          aria-label="Trilha"
        >
          {prev?.href && (
            <Link
              href={prev.href}
              className="tap flex shrink-0 items-center gap-0.5 py-1.5 text-muted hover:text-fg-soft"
            >
              <ChevronLeftIcon size={16} className="shrink-0" />
              <span className="max-w-[120px] truncate">{prev.label}</span>
            </Link>
          )}
          <span className="min-w-0 flex-1 truncate font-semibold text-fg-soft">
            {last.label}
          </span>
        </nav>
      )}
    </>
  );
}
