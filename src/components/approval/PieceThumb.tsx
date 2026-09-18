import type { PieceStatus } from "@/lib/approval/types";
import { StatusBadge } from "./StatusBadge";
import { ImageIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Placeholder thumbnail for a content piece. Designed to be swapped for real
 * media later: pass `src` and it renders the image; otherwise it shows the
 * dimensions and a media icon over the black berry surface.
 */
export function PieceThumb({
  size,
  status,
  src,
  showBadge = true,
  className,
  children,
}: {
  size: string;
  status?: PieceStatus;
  src?: string;
  showBadge?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-card border border-border bg-surface",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-faint">
          <ImageIcon size={22} />
          <span className="text-[11px]">{size}</span>
        </div>
      )}
      {showBadge && status && (
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={status} />
        </div>
      )}
      {children}
    </div>
  );
}
