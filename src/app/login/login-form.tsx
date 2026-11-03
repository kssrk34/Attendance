"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginState, loginAction } from "@/server/auth-actions";

const DEMO_PASSWORD = "Demo@1234";
const DEMO_ACCOUNTS = [
  { label: "Log in as Employee", email: "employee@example.com" },
  { label: "Log in as Manager", email: "manager@example.com" },
  { label: "Log in as HR Admin", email: "admin@example.com" },
];

function SubmitButton({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
  const lastError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.error && state.error !== lastError.current) toast.error(state.error);
    lastError.current = state.error;
  }, [state]);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            aria-invalid={!!state.fieldErrors?.email}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className="h-10"
          />
          {state.fieldErrors?.email && (
            <p id="email-error" className="text-sm text-destructive">
              {state.fieldErrors.email}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            className="h-10"
          />
          {state.fieldErrors?.password && (
            <p id="password-error" className="text-sm text-destructive">
              {state.fieldErrors.password}
            </p>
          )}
        </div>
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton>Log in</SubmitButton>
      </form>

      <div className="rounded-lg border border-dashed bg-muted/50 p-4">
        <p className="text-sm font-medium">Demo accounts</p>
        <p className="mb-3 text-xs text-muted-foreground">One click to explore each role.</p>
        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((a) => (
            <form key={a.email} action={formAction}>
              <input type="hidden" name="email" value={a.email} />
              <input type="hidden" name="password" value={DEMO_PASSWORD} />
              <SubmitButton variant="outline">{a.label}</SubmitButton>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
