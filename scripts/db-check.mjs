import pg from "pg";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("✅ 已建表（" + r.rows.length + "）：\n  " + r.rows.map((x) => x.table_name).join("\n  "));
} catch (e) {
  console.error("❌ 查询失败：", e.message); process.exitCode = 1;
} finally { await pool.end(); }
