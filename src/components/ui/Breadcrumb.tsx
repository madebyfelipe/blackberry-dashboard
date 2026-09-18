import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-[14px]" aria-label="Trilha">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-2">
            {c.href && !last ? (
              <Link href={c.href} className="text-muted hover:text-fg-soft">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "font-semibold text-fg-soft" : "text-muted"}>
                {c.label}
              </span>
            )}
            {!last && <ChevronRightIcon size={16} className="text-muted" />}
          </div>
        );
      })}
    </nav>
  );
}
