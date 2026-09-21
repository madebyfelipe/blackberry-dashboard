import { cn } from "@/lib/cn";

/**
 * Três barrinhas — as acesas indicam a urgência. Mora fora do `TaskModal`
 * porque a lista, a tela de descrição e o próprio modal desenham a mesma
 * escala (a régua em si vive em `lib/tasks/priority.ts`).
 */
export function PriorityBars({ bars }: { bars: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[3, 6, 9].map((h, i) => (
        <span
          key={h}
          style={{ height: h }}
          className={cn(
            "w-[2.5px] rounded-pill transition-colors",
            i < bars ? "bg-fg-soft" : "bg-border-strong",
          )}
        />
      ))}
    </span>
  );
}
