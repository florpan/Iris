import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://iris:iris@localhost:5432/iris";

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

console.log("🔄 Running database migrations...");

try {
  await migrate(db, {
    migrationsFolder: path.join(import.meta.dir, "../../drizzle"),
  });
  console.log("✅ Migrations complete");
} catch (err) {
  console.error("❌ Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
