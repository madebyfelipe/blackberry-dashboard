import { PIECE_STATUS } from "@/lib/approval/constants";
import type { PieceStatus } from "@/lib/approval/types";
import { cn } from "@/lib/cn";

export function StatusBadge({
  status,
  className,
}: {
  status: PieceStatus;
  className?: string;
}) {
  const meta = PIECE_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-pill px-2.5 py-1 text-[11px] whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: meta.badgeBg, color: meta.badgeFg }}
    >
      {meta.label}
    </span>
  );
}
