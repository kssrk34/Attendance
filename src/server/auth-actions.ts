"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string; fieldErrors?: { email?: string; password?: string }; email?: string };

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "email" | "password";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, email: raw.email };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password, or the account is deactivated.", email: raw.email };
    }
    throw err; // the success redirect is thrown as an error and must propagate
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
