export function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center rounded-card border border-border bg-surface text-center">
      <h1 className="text-[20px] font-semibold text-fg">{title}</h1>
      <p className="mt-2 max-w-sm text-[13px] text-muted">
        {note ?? "Tela em construção. A fundação e o Login já estão prontos."}
      </p>
    </section>
  );
}
