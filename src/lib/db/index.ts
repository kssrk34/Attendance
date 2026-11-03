import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * App queries use the pooled Neon connection (DATABASE_URL, host has "-pooler").
 * Migrations use the direct connection instead (see prisma.config.ts).
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Fail with an error page instead of hanging forever if a connection can't be opened
  // (the default is to wait indefinitely). Generous enough for a database waking from sleep.
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15_000 });
  // On Vercel (Fluid compute) this keeps the function alive long enough to close idle
  // connections before it's suspended; elsewhere it does nothing.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Shared Prisma client (reused across hot reloads in development). */
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type { Prisma } from "@/generated/prisma/client";
