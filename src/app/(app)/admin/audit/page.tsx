import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FilterForm, FilterSubmit } from "@/components/form/filter-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { firstParam } from "@/lib/month-param";
import { AUDIT_ACTIONS } from "@/server/audit";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

const humanize = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

function describe(details: Prisma.JsonValue): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const actionParam = firstParam(sp.action);
  const action = (AUDIT_ACTIONS as readonly string[]).includes(actionParam ?? "") ? actionParam : undefined;
  const actor = firstParam(sp.user) || undefined;
  const page = Math.max(1, Number.parseInt(firstParam(sp.page) ?? "1", 10) || 1);

  const where: Prisma.AuditLogWhereInput = { ...(action ? { action } : {}), ...(actor ? { actorId: actor } : {}) };
  const [total, logs, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (p: number) => {
    const q = new URLSearchParams({ ...(action ? { action } : {}), ...(actor ? { user: actor } : {}), page: String(p) });
    return `/admin/audit?${q}`;
  };

  return (
    <>
      <PageHeader title="Audit log" description={`${total} event${total === 1 ? "" : "s"}`} />
      <Card>
        <CardContent className="space-y-4">
          <FilterForm action="/admin/audit" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-action">Action</Label>
              <NativeSelect id="a-action" name="action" defaultValue={action ?? ""} className="w-56">
                <option value="">All actions</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {humanize(a)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-user">User</Label>
              <NativeSelect id="a-user" name="user" defaultValue={actor ?? ""} className="w-56">
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <FilterSubmit>Filter</FilterSubmit>
            {(action || actor) && (
              <Button asChild variant="ghost" size="lg">
                <Link href="/admin/audit">Clear</Link>
              </Button>
            )}
          </FilterForm>

          {logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No events found" description="Try different filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{l.actor.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{l.action}</span>
                    </TableCell>
                    <TableCell className="max-w-md text-xs whitespace-normal text-muted-foreground">
                      <span className="line-clamp-3 break-words">{describe(l.details) || `${l.entityType} ${l.entityId}`}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <p className="text-sm text-muted-foreground">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button asChild={page > 1} variant="outline" disabled={page <= 1}>
                  {page > 1 ? (
                    <Link href={hrefFor(page - 1)}>
                      <ChevronLeft /> Previous
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeft /> Previous
                    </span>
                  )}
                </Button>
                <Button asChild={page < pages} variant="outline" disabled={page >= pages}>
                  {page < pages ? (
                    <Link href={hrefFor(page + 1)}>
                      Next <ChevronRight />
                    </Link>
                  ) : (
                    <span>
                      Next <ChevronRight />
                    </span>
                  )}
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </>
  );
}
