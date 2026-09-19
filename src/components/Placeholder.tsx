export function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <section className="flex h-full animate-rise-in flex-col items-center justify-center rounded-card border border-border bg-surface text-center">
      {/* O ponto pulsa devagar: a tela está reservada, não quebrada. */}
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-border">
        <span className="animate-breathe h-2.5 w-2.5 rounded-full bg-fg-3" />
      </span>
      <h1 className="text-[20px] font-semibold text-fg">{title}</h1>
      <p className="mt-2 max-w-sm text-[13px] text-muted">
        {note ?? "Tela reservada — o desenho dela vem antes da construção."}
      </p>
    </section>
  );
}
