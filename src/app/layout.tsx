import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { CSSProperties } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getBranding } from "@/server/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  return {
    title: { template: `%s · ${b.appName}`, default: b.appName },
    description: `${b.appName} for ${b.companyName}`,
    applicationName: b.appName,
    icons: { icon: `/brand-icon?v=${b.version}` },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const b = await getBranding();
  // The brand color drives the theme accent (buttons, active nav, links, focus rings).
  const theme = {
    "--primary": b.primaryColor,
    "--primary-foreground": b.primaryForeground,
    "--ring": b.primaryColor,
    "--sidebar-primary": b.primaryColor,
    "--sidebar-primary-foreground": b.primaryForeground,
  } as CSSProperties;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} style={theme}>
      <body className="min-h-full bg-muted/40">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
