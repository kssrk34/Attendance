import type { Metadata } from "next";
import { BrandingForm } from "@/components/admin/branding-form";
import { PageHeader } from "@/components/page-header";
import { DEFAULT_BRANDING } from "@/lib/rules";
import { getBranding } from "@/server/config";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingPage() {
  await requireRole("ADMIN");
  const b = await getBranding();
  return (
    <>
      <PageHeader title="Branding" description="Make the app your own: name, logo and color. Changes apply instantly for everyone." />
      <BrandingForm
        initial={{ appName: b.appName, companyName: b.companyName, primaryColor: b.primaryColor, logo: b.logo }}
        defaults={{ ...DEFAULT_BRANDING }}
      />
    </>
  );
}
