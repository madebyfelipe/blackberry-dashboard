/*
 * Esqueleto das Tarefas. Existe para a troca de tela não piscar em branco: as
 * mesmas alturas e larguras da lista real, com o brilho de `.skeleton`.
 */
export default function LoadingTarefas() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 py-6 pl-2 pr-6">
      <div className="skeleton h-4 w-40 rounded-pill" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[112, 96, 128, 104].map((w, i) => (
            <div key={i} style={{ width: w }} className="skeleton h-10 rounded-pill" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-10 w-[160px] rounded-field" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px">
        <div className="skeleton h-10 w-full rounded-mark" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex items-center gap-4 border-b border-border px-4 py-3.5"
          >
            <div className="skeleton h-2.5 w-2.5 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="skeleton h-3.5 w-[46%] rounded-pill" />
              <div className="skeleton h-3 w-[24%] rounded-pill" />
            </div>
            <div className="skeleton h-7 w-[130px] rounded-pill" />
            <div className="skeleton h-7 w-7 rounded-full" />
            <div className="skeleton h-3 w-[60px] rounded-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
