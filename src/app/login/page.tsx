import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginBrandHeader } from "@/components/login-brand-header";
import { Card, CardContent } from "@/components/ui/card";
import { getBranding } from "@/server/config";
import { getCurrentUser } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const b = await getBranding();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <LoginBrandHeader appName={b.appName} companyName={b.companyName} logo={b.logo} primaryColor={b.primaryColor} />
        <Card>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
