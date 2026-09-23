import { Screen } from "@/components/ui/Screen";

/** Esqueleto do Social media — o painel v3 com a grade de cards de 14px. */
export default function LoadingSocial() {
  return (
    <Screen gap="md">
      <div className="skeleton h-4 w-56 rounded-pill" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-10 w-[220px] rounded-pill" />
        <div className="skeleton h-10 w-[130px] rounded-mark" />
      </div>
      <div className="h-12 border-b border-rule" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex flex-col gap-3.5 rounded-tile border border-border bg-surface-2 p-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-3.5 w-[140px] rounded-pill" />
                <div className="skeleton h-2.5 w-[80px] rounded-pill" />
              </div>
            </div>
            <div className="h-px w-full bg-divider" />
            <div className="skeleton h-3 w-full rounded-pill" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
