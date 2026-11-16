function Placeholder({ className }: { className: string }) {
  return <div className={`rounded bg-slate-200 ${className}`} />;
}

export function TimeSlotsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading time slots">
      <span className="sr-only">Loading time slots…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="min-h-11 flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
            <Placeholder className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingSkeleton() {
  return (
    <div role="status" aria-label="Loading booking schedule" className="space-y-4">
      <span className="sr-only">Loading booking schedule…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse space-y-3 px-1">
        <Placeholder className="h-5 w-28" />
        <Placeholder className="h-8 w-3/4 max-w-lg" />
        <Placeholder className="h-4 w-2/3 max-w-sm" />
      </div>
      <div aria-hidden="true" className="motion-safe:animate-pulse rounded-xl border border-slate-200 bg-white px-6 py-5 space-y-4">
        <div className="space-y-2">
          <Placeholder className="h-6 w-40" />
          <div className="h-11 rounded-md border border-slate-200 bg-slate-50" />
        </div>
        <div className="space-y-2">
          <Placeholder className="h-6 w-36" />
          <Placeholder className="h-4 w-32" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-11 rounded-md border border-slate-200 bg-slate-50" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Placeholder className="h-6 w-40" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Placeholder className="h-11 w-3/4" />
            <Placeholder className="h-11 w-3/4" />
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 pt-3">
          <Placeholder className="h-11 w-full sm:w-44" />
        </div>
      </div>
    </div>
  );
}
