import { STATUS_BY_ID } from "@/lib/tasks/constants";
import type { TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

export function StatusDot({
  status,
  size = 10,
}: {
  status: TaskStatus;
  size?: number;
}) {
  const meta = STATUS_BY_ID[status];
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: meta.dot }}
    />
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const meta = STATUS_BY_ID[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 inset-ring-1 inset-ring-border",
        className,
      )}
    >
      <span
        className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      <span className="whitespace-nowrap text-[12px] text-fg-soft">
        {meta.label}
      </span>
    </span>
  );
}
