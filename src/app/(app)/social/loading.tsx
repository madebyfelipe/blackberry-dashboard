/** Esqueleto dos clientes — três cards por linha, como a grade real. */
export default function LoadingSocial() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-56 rounded-pill" />
        <div className="skeleton h-10 w-[180px] rounded-pill" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{ ["--d" as string]: i }}
            className="stagger-item flex flex-col gap-3.5 rounded-card border border-border p-5"
          >
            <div className="flex items-start gap-3">
              <div className="skeleton h-10 w-10 rounded-thumb" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-3.5 w-[140px] rounded-pill" />
              </div>
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex items-end justify-between">
              <div className="flex gap-3">
                {Array.from({ length: 3 }).map((_, s) => (
                  <div key={s} className="flex flex-col gap-1">
                    <div className="skeleton h-4 w-6 rounded-pill" />
                    <div className="skeleton h-2.5 w-12 rounded-pill" />
                  </div>
                ))}
              </div>
              <div className="skeleton h-3 w-[70px] rounded-pill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
