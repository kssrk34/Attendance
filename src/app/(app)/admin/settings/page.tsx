import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getSettings } from "@/server/config";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Work hours and rules used to calculate attendance." />
      <Card>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>
    </>
  );
}
