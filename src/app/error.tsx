"use client";

import { ErrorView } from "@/components/error-view";

export default function ErrorPage(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main>
      <ErrorView {...props} />
    </main>
  );
}
