import { cn } from "@/lib/utils";
import { initialsOf, readableTextColor } from "@/lib/rules/branding";

type Props = {
  companyName: string;
  logo: string | null;
  primaryColor: string;
  size?: number;
  className?: string;
};

/** The company logo, or a rounded square in the primary color with the company's initials. */
export function BrandMark({ companyName, logo, primaryColor, size = 36, className }: Props) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize
      <img
        src={logo}
        alt={`${companyName} logo`}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-lg object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${companyName} logo`}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-bold select-none", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: primaryColor,
        color: readableTextColor(primaryColor),
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initialsOf(companyName)}
    </span>
  );
}
