import Link from "next/link";
import { listBatches } from "@/lib/approval/repository";
import { batchProgress, progressCaption } from "@/lib/approval/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const batches = await listBatches();

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto py-6 pl-2 pr-6">
      <Breadcrumb items={[{ label: "black berry", href: "/tarefas" }, { label: "Social media" }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold text-fg">Lotes de aprovação</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {batches.map((b, i) => {
          const p = batchProgress(b);
          return (
            <Link
              key={b.id}
              href={`/social/${b.id}`}
              style={{ ["--d" as string]: i }}
              className="stagger-item group flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-mark bg-dim text-[14px] font-bold text-fg transition-transform duration-200 group-hover:scale-105">
                    {b.client.charAt(0)}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-fg-soft">
                      {b.client}
                    </div>
                    <div className="text-[12px] text-muted">{b.label}</div>
                  </div>
                </div>
                <ChevronRightIcon
                  size={18}
                  className="text-muted transition-transform duration-200 group-hover:translate-x-1"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-[0.3px] text-muted">
                    PROGRESSO DO LOTE
                  </span>
                  <span className="text-[13px] font-semibold text-fg-soft">
                    {p.decided} / {p.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-pill bg-border">
                  {/*
                   * A barra cresce da esquerda ao abrir a tela: `scaleX` em vez
                   * de `width` para a animação ficar no compositor.
                   */}
                  <div
                    className="h-2 origin-left rounded-pill bg-primary transition-transform duration-500"
                    style={{
                      width: `${p.pct}%`,
                      animation: "grow-x 0.6s var(--ease-out-soft) both",
                      animationDelay: `${Math.min(i, 8) * 60 + 120}ms`,
                    }}
                  />
                </div>
                <span className="text-[12px] text-muted">{progressCaption(b)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
