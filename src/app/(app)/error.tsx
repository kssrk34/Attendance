"use client";

import { ErrorView } from "@/components/error-view";

// Errors inside the app keep the sidebar and top bar, so people can still move to another page.
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} />;
}
