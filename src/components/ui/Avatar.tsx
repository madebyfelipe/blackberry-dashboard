import { cn } from "@/lib/cn";

export function Avatar({
  initial,
  size = 26,
  className,
}: {
  initial: string;
  size?: number;
  className?: string;
}) {
  const ch = (initial || "—").trim().charAt(0).toUpperCase() || "—";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill bg-[#404040] font-semibold text-fg-soft",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}
