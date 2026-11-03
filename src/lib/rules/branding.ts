export const DEFAULT_BRANDING = {
  appName: "Attendance Portal",
  companyName: "Your Company",
  logo: null as string | null,
  primaryColor: "#2563eb",
};

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"] as const;

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a "#rrggbb" color. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const LIGHT_TEXT = "#ffffff";
export const DARK_TEXT = "#111827";

/** Pick white or dark text, whichever has more contrast on the given background. */
export function readableTextColor(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** Up to two initials, e.g. "Your Company" -> "YC". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** URL/file-name friendly slug, e.g. "Your Company Pvt. Ltd." -> "your-company-pvt-ltd". */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "export";
}

export type ParsedDataUrl = { mime: string; bytes: number };

/** Parse a base64 image data URL; returns null if it isn't one. */
export function parseImageDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = /^data:([a-z+/.-]+);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, b64] = match;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return { mime, bytes: (b64.length * 3) / 4 - padding };
}

export type LogoCheck = { ok: true } | { ok: false; error: string };

export function validateLogo(dataUrl: string): LogoCheck {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed || !(LOGO_MIME_TYPES as readonly string[]).includes(parsed.mime)) {
    return { ok: false, error: "Logo must be a PNG, SVG, JPG or WebP image." };
  }
  if (parsed.bytes > LOGO_MAX_BYTES) return { ok: false, error: "Logo must be 300 KB or smaller." };
  return { ok: true };
}
