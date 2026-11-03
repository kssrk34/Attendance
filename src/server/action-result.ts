import "server-only";
import { z } from "zod";
import { PermissionError } from "./session";

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** A user-facing error with an optional field it belongs to. */
export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parse input with a Zod schema, throwing a UserError with field errors on failure. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new UserError("Please fix the highlighted fields.", zodFieldErrors(result.error));
  return result.data;
}

/** Run an action body and convert known errors into a friendly result. */
export async function runAction<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
