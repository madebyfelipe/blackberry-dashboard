import { Screen } from "@/components/ui/Screen";

export function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <Screen className="items-center justify-center text-center">
      {/* O ponto pulsa devagar: a tela está reservada, não quebrada. */}
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-border">
        <span className="animate-breathe h-2.5 w-2.5 rounded-full bg-fg-3" />
      </span>
      <h1 className="text-[20px] font-semibold text-fg">{title}</h1>
      <p className="max-w-sm text-[13px] text-muted">
        {note ?? "Tela reservada — o desenho dela vem antes da construção."}
      </p>
    </Screen>
  );
}
