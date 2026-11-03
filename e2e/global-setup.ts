import { execSync } from "node:child_process";

/** Reset the demo data before the suite runs. */
export default function globalSetup() {
  execSync("npx prisma db seed", { stdio: "inherit" });
}
