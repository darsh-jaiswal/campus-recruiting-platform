/**
 * Neon + Drizzle client.
 *
 * MUST use the POOLED connection string (the `-pooler` host). On serverless,
 * the direct string exhausts Postgres connections under any real burst —
 * registration launch is exactly that burst. Fluid Compute reuses instances,
 * which keeps the pooled connection count low between invocations.
 *
 * The client is created LAZILY, on first query rather than on import. A build
 * imports every module to collect page data, so connecting eagerly would make
 * `next build` fail on any machine without a database — CI, a fresh clone, a
 * preview deploy configured later. Failing on first use instead means the
 * build succeeds and the error, when it comes, names the fix.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function connect(): Database {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` to fetch it, " +
        "or copy .env.example to .env.local and fill it in.",
    );
  }

  if (!connectionString.includes("-pooler")) {
    // Loud, because this only bites under load in production.
    console.warn(
      "[db] DATABASE_URL does not look like a pooled Neon connection string " +
        "(expected a '-pooler' host). Serverless will exhaust connections under load.",
    );
  }

  instance = drizzle(neon(connectionString), { schema });
  return instance;
}

/**
 * Behaves exactly like a Drizzle database, but defers connecting until the
 * first property access. Callers write `db.select(...)` as normal.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const real = connect() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, property, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
