import { Screen } from "@/components/ui/Screen";

/*
 * Esqueleto das Tarefas. Existe para a troca de tela não piscar em branco: as
 * mesmas alturas e larguras da lista real (linha de 44px, cabeçalho de 40px),
 * com o brilho de `.skeleton`.
 */
export default function LoadingTarefas() {
  return (
    <Screen>
      <div className="skeleton h-4 w-40 rounded-pill" />

      <div className="flex flex-nowrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[96, 112, 128, 120].map((w, i) => (
            <div key={i} style={{ width: w }} className="skeleton h-10 rounded-pill" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-10 w-[116px] rounded-mark" />
          <div className="skeleton h-9 w-9 rounded-mark" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-12 w-full shrink-0 border-b border-rule" />
        <div className="h-10 w-full shrink-0 border-b border-rule" />
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex h-11 shrink-0 items-center gap-4 border-b border-rule-soft px-4"
          >
            <div className="skeleton h-[18px] w-[18px] rounded-check" />
            <div className="skeleton h-[26px] w-[26px] rounded-pill" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="skeleton h-3 w-[42%] rounded-pill" />
              <div className="skeleton h-2.5 w-[18%] rounded-pill" />
            </div>
            <div className="skeleton h-5 w-[86px] rounded-mark" />
            <div className="skeleton h-[22px] w-[110px] rounded-pill" />
            <div className="skeleton h-3 w-[60px] rounded-pill" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
