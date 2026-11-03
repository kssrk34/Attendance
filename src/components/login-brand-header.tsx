import { BrandMark } from "./brand-mark";

/** Brand header used on the login page (and in the branding preview). */
export function LoginBrandHeader({
  appName,
  companyName,
  logo,
  primaryColor,
}: {
  appName: string;
  companyName: string;
  logo: string | null;
  primaryColor: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <BrandMark companyName={companyName} logo={logo} primaryColor={primaryColor} size={56} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="login-app-name">
          {appName}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="login-company-name">
          {companyName}
        </p>
      </div>
    </div>
  );
}
