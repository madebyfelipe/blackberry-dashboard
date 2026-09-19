/** Esqueleto dos lotes de aprovação — dois cards por linha, como a grade real. */
export default function LoadingSocial() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      <div className="skeleton h-4 w-48 rounded-pill" />
      <div className="skeleton h-6 w-[220px] rounded-pill" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-mark" />
              <div className="flex flex-col gap-2">
                <div className="skeleton h-3.5 w-[140px] rounded-pill" />
                <div className="skeleton h-3 w-[100px] rounded-pill" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton h-3 w-[120px] rounded-pill" />
              <div className="skeleton h-2 w-full rounded-pill" />
              <div className="skeleton h-3 w-[70%] rounded-pill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
