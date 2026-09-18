"use client";

import { useState } from "react";
import { STATUSES } from "@/lib/tasks/constants";
import type { TaskStatus } from "@/lib/tasks/types";
import { StatusPill, StatusDot } from "@/components/ui/StatusPill";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** A status pill that opens a dropdown to change the status. */
export function StatusMenu({
  status,
  onSelect,
  align = "left",
}: {
  status: TaskStatus;
  onSelect: (s: TaskStatus) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-pill transition-transform hover:scale-[1.02] active:scale-95"
      >
        <StatusPill status={status} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className={cn(
              "absolute z-50 mt-2 w-[184px] animate-pop-in overflow-hidden rounded-[18px] border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]",
              align === "right" ? "right-0" : "left-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (s.id !== status) onSelect(s.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] text-fg-soft hover:bg-border"
              >
                <StatusDot status={s.id} size={9} />
                <span className="flex-1">{s.label}</span>
                {s.id === status && (
                  <CheckIcon size={14} className="text-muted" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
