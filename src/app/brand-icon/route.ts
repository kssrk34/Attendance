import { initialsOf, parseImageDataUrl } from "@/lib/rules";
import { getBranding } from "@/server/config";

/** Favicon: the uploaded logo if there is one, otherwise the generic initials mark. */
export async function GET() {
  const b = await getBranding();
  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    // Uploaded SVGs must never run scripts if opened directly.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  };

  if (b.logo) {
    const parsed = parseImageDataUrl(b.logo);
    if (parsed) {
      const bytes = Buffer.from(b.logo.slice(b.logo.indexOf(",") + 1), "base64");
      return new Response(bytes, { headers: { ...headers, "Content-Type": parsed.mime } });
    }
  }

  const initials = initialsOf(b.companyName)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${b.primaryColor}"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${b.primaryForeground}">${initials}</text></svg>`;
  return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
