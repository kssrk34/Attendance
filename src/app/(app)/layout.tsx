import { LogOut } from "lucide-react";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NavLinks } from "@/components/app-shell/nav";
import { BrandMark } from "@/components/brand-mark";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { countPendingApprovals } from "@/server/approvals";
import { logoutAction } from "@/server/auth-actions";
import { getBranding } from "@/server/config";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [branding, pending] = await Promise.all([getBranding(), countPendingApprovals(user)]);

  const brand = (
    <div className="flex min-w-0 items-center gap-3" data-testid="sidebar-brand">
      <BrandMark companyName={branding.companyName} logo={branding.logo} primaryColor={branding.primaryColor} size={36} />
      <div className="min-w-0 text-left">
        <p className="truncate text-sm leading-tight font-semibold" data-testid="brand-app-name">
          {branding.appName}
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground" data-testid="brand-company-name">
          {branding.companyName}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center border-b px-4">{brand}</div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks role={user.role} pendingApprovals={pending} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
          <MobileNav role={user.role} pendingApprovals={pending} brand={brand} />
          <div className="min-w-0 lg:hidden">
            <BrandMark companyName={branding.companyName} logo={branding.logo} primaryColor={branding.primaryColor} size={30} />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium" data-testid="current-user-name">
                {user.name}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="lg" aria-label="Log out">
                <LogOut />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
