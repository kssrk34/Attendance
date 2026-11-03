import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A labelled form field with an optional hint and field-level error. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Props to wire an input to its Field's error message. */
export function errorProps(id: string, error?: string) {
  return { id, "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined };
}
