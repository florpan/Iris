import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://iris:iris@localhost:5432/iris";

// Use a single connection for migrations, pool for queries
const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // suppress notices
});

export const db = drizzle(sql, { schema });
export { sql };
