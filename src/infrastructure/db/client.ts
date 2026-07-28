import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDatabase() {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  database = drizzle(new Pool({ connectionString, max: 5 }), { schema });
  return database;
}
