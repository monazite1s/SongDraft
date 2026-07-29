// 程序化数据库迁移：node --env-file=.env.local scripts/migrate.mjs
// 用 node --env-file 加载 .env.local，避免在命令行/进程参数里暴露数据库密码。
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL 未设置。用法：node --env-file=.env.local scripts/migrate.mjs");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ 全部迁移已应用（drizzle/0000–0005）");
} catch (err) {
  console.error("❌ 迁移失败：", err?.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
