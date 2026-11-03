import { Umbrella } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LeaveStatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRange } from "@/lib/format";
import { canCancel } from "@/lib/rules/leave";
import { todayKey } from "@/lib/rules/time";
import type { RequestRow } from "@/server/leave";
import { CancelLeaveButton } from "./cancel-leave-button";

/** A user's leave requests. Shows Cancel only when `allowCancel` (i.e. it's the viewer's own list). */
export function RequestList({ requests, allowCancel }: { requests: RequestRow[]; allowCancel: boolean }) {
  if (requests.length === 0) {
    return <EmptyState icon={Umbrella} title="No leave requests yet" description={allowCancel ? "Requests you submit will show up here." : undefined} />;
  }
  const today = todayKey();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dates</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Days</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Details</TableHead>
          {allowCancel && <TableHead className="sr-only">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => (
          <TableRow key={r.id} data-testid="leave-request-row">
            <TableCell className="font-medium whitespace-nowrap">{formatRange(r.start, r.end)}</TableCell>
            <TableCell>{r.leaveTypeCode}</TableCell>
            <TableCell className="text-right tabular-nums">{r.days}</TableCell>
            <TableCell>
              <LeaveStatusBadge status={r.status} />
            </TableCell>
            <TableCell className="max-w-xs text-sm whitespace-normal">
              <p className="line-clamp-2">{r.reason}</p>
              {r.decidedByName && (
                <p className="text-xs text-muted-foreground">
                  {r.status === "APPROVED" ? "Approved" : "Rejected"} by {r.decidedByName}
                  {r.decisionNote ? `: “${r.decisionNote}”` : ""}
                </p>
              )}
            </TableCell>
            {allowCancel && (
              <TableCell className="text-right">
                {canCancel({ status: r.status, start: r.start }, today) && <CancelLeaveButton id={r.id} approved={r.status === "APPROVED"} />}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
