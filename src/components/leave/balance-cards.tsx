import { EmptyState } from "@/components/empty-state";
import type { BalanceRow } from "@/server/leave";

export function BalanceCards({ balances }: { balances: BalanceRow[] }) {
  if (balances.length === 0) return <EmptyState title="No leave types yet" description="HR hasn't set up any leave types." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => {
        const pct = b.allocated > 0 ? Math.min(100, Math.round(((b.used + b.pending) / b.allocated) * 100)) : 0;
        return (
          <div key={b.leaveTypeId} className="rounded-lg border bg-background p-4" data-testid={`balance-${b.code}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium">{b.name}</p>
              <span className="text-xs text-muted-foreground">{b.code}</span>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              <span data-testid={`balance-${b.code}-available`}>{Math.max(0, b.available)}</span>
              <span className="text-sm font-normal text-muted-foreground"> / {b.allocated} available</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {b.used} used{b.pending > 0 ? ` · ${b.pending} pending` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
