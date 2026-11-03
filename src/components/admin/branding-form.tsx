"use client";

import { CalendarCheck2, LayoutDashboard, Loader2, RotateCcw, Umbrella, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Field, errorProps } from "@/components/form/field";
import { LoginBrandHeader } from "@/components/login-brand-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HEX_COLOR_RE, LOGO_MAX_BYTES, LOGO_MIME_TYPES, readableTextColor } from "@/lib/rules/branding";
import { resetBrandingAction, saveBrandingAction } from "@/server/admin-actions";

type Values = { appName: string; companyName: string; primaryColor: string; logo: string | null };

function SidebarPreview({ v }: { v: Values }) {
  const items = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "My attendance", icon: CalendarCheck2 },
    { label: "Leave", icon: Umbrella },
  ];
  return (
    <div className="w-full max-w-60 rounded-lg border bg-background">
      <div className="flex items-center gap-3 border-b p-3">
        <BrandMark companyName={v.companyName || " "} logo={v.logo} primaryColor={v.primaryColor} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{v.appName || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{v.companyName || "—"}</p>
        </div>
      </div>
      <div className="space-y-0.5 p-2">
        {items.map((i) => (
          <div
            key={i.label}
            className={
              i.active ? "flex items-center gap-2 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground" : "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground/80"
            }
          >
            <i.icon className="size-4" aria-hidden /> {i.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginPreview({ v }: { v: Values }) {
  return (
    <div className="w-full max-w-64 space-y-3 rounded-lg border bg-muted/40 p-4">
      <LoginBrandHeader appName={v.appName || "—"} companyName={v.companyName || "—"} logo={v.logo} primaryColor={v.primaryColor} />
      <div className="space-y-2 rounded-lg border bg-background p-3">
        <div className="h-8 rounded-md border bg-background" />
        <div className="h-8 rounded-md border bg-background" />
        <div className="flex h-8 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">Log in</div>
      </div>
    </div>
  );
}

export function BrandingForm({ initial, defaults }: { initial: Values; defaults: Values }) {
  const [v, setV] = useState<Values>(initial);
  const [hexText, setHexText] = useState(initial.primaryColor);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewStyle = {
    "--primary": v.primaryColor,
    "--primary-foreground": readableTextColor(v.primaryColor),
  } as React.CSSProperties;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setErrors((e) => ({ ...e, logo: "Logo must be a PNG, SVG, JPG or WebP image." }));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setErrors((e) => ({ ...e, logo: "Logo must be 300 KB or smaller." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setV((s) => ({ ...s, logo: String(reader.result) }));
      setErrors((e) => ({ ...e, logo: "" }));
    };
    reader.onerror = () => setErrors((e) => ({ ...e, logo: "Couldn't read that file." }));
    reader.readAsDataURL(file);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!HEX_COLOR_RE.test(hexText)) {
      setErrors((x) => ({ ...x, primaryColor: "Use a hex color like #2563eb" }));
      return;
    }
    startTransition(async () => {
      const res = await saveBrandingAction(v);
      if (res.ok) {
        toast.success(res.message);
        setErrors({});
      } else {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  };

  const reset = () =>
    startTransition(async () => {
      const res = await resetBrandingAction();
      if (res.ok) {
        toast.success(res.message);
        setV(defaults);
        setHexText(defaults.primaryColor);
        setErrors({});
        setResetOpen(false);
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Brand details</CardTitle>
          <CardDescription>Shown on the login page, sidebar, browser tab and export file names.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4" noValidate id="branding-form">
            <Field id="appName" label="App name" error={errors.appName}>
              <Input {...errorProps("appName", errors.appName)} name="appName" value={v.appName} onChange={(e) => setV({ ...v, appName: e.target.value })} maxLength={40} />
            </Field>
            <Field id="companyName" label="Company name" error={errors.companyName}>
              <Input {...errorProps("companyName", errors.companyName)} name="companyName" value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} maxLength={60} />
            </Field>
            <Field id="primaryColor" label="Primary color" error={errors.primaryColor} hint="Button text switches between white and dark automatically.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick primary color"
                  value={v.primaryColor}
                  onChange={(e) => {
                    setV({ ...v, primaryColor: e.target.value });
                    setHexText(e.target.value);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-lg border bg-background p-1"
                />
                <Input
                  {...errorProps("primaryColor", errors.primaryColor)}
                  name="primaryColor"
                  value={hexText}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    setHexText(t);
                    if (HEX_COLOR_RE.test(t)) {
                      setV({ ...v, primaryColor: t.toLowerCase() });
                      setErrors((x) => ({ ...x, primaryColor: "" }));
                    }
                  }}
                  className="w-32 font-mono"
                  maxLength={7}
                />
              </div>
            </Field>
            <Field id="logo" label="Logo" error={errors.logo} hint="PNG, SVG, JPG or WebP, up to 300 KB. Square images look best.">
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark companyName={v.companyName || " "} logo={v.logo} primaryColor={v.primaryColor} size={48} />
                <input
                  ref={fileRef}
                  id="logo"
                  type="file"
                  accept={LOGO_MIME_TYPES.join(",")}
                  className="sr-only"
                  data-testid="logo-input"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload /> {v.logo ? "Replace logo" : "Upload logo"}
                </Button>
                {v.logo && (
                  <Button type="button" variant="ghost" onClick={() => setV({ ...v, logo: null })}>
                    <X /> Remove
                  </Button>
                )}
              </div>
            </Field>
          </form>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="submit" form="branding-form" size="lg" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save branding
            </Button>
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="lg">
                  <RotateCcw /> Reset to defaults
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset branding?</DialogTitle>
                  <DialogDescription>
                    This restores the generic name “{defaults.appName}”, “{defaults.companyName}”, the default color and removes the logo.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={reset} disabled={pending}>
                    {pending && <Loader2 className="animate-spin" />}
                    Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
          <CardDescription>Nothing changes for others until you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={previewStyle} className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center" aria-label="Branding preview">
            <div className="w-full space-y-2 sm:w-auto">
              <p className="text-xs font-medium text-muted-foreground">Sidebar</p>
              <SidebarPreview v={v} />
            </div>
            <div className="w-full space-y-2 sm:w-auto">
              <p className="text-xs font-medium text-muted-foreground">Login page</p>
              <LoginPreview v={v} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
