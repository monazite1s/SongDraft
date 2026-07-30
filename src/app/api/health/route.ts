/**
 * 存活探活（docs/technical-design.md · 运维）
 * GET /api/health：轻量存活检查。
 * - mock 模式（无 DATABASE_URL）：直接返回 ok。
 * - 真实模式：尝试连接 DB（一条轻查询）；失败返回 503 + 原因。
 * 保持轻量、不抛未捕获异常，避免拖垮探活调用方。
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const time = new Date().toISOString();

  // mock 模式：无数据库依赖，直接存活。
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, time, mode: "mock" });
  }

  // 真实模式：尝试 DB 连接。
  const checks: { db: "ok" | string; storage: "ok" | string } = { db: "ok", storage: "ok" };
  try {
    const { getDatabase } = await import("@/infrastructure/db/client");
    const db = getDatabase();
    // drizzle node-postgres：底层 pg Pool 挂在 session.client。
    const client = (db as unknown as { session?: { client?: { query: (sql: string) => Promise<unknown> } } }).session?.client;
    if (client && typeof client.query === "function") {
      await client.query("SELECT 1");
    } else {
      // 退化：无法定位底层连接池，标记为不可探活。
      checks.db = "database client unavailable";
    }
  } catch (error) {
    checks.db = error instanceof Error ? error.message : "database unreachable";
  }

  // 存储驱动：cos 需要密钥配置，缺失视为非 ok（mock 存储默认 ok）。
  try {
    if (process.env.STORAGE_DRIVER === "cos") {
      const { readTencentCosConfig } = await import("@/infrastructure/storage/tencent-cos-storage");
      readTencentCosConfig();
    }
  } catch (error) {
    checks.storage = error instanceof Error ? error.message : "storage misconfigured";
  }

  const ok = checks.db === "ok" && checks.storage === "ok";

  // 生产环境脱敏：失败只返回通用 { ok: false } + 503，避免泄露 DB/存储内部架构与错误文案。
  if (process.env.NODE_ENV === "production") {
    return ok
      ? NextResponse.json({ ok: true, time })
      : NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({ ok, time, mode: "live", checks }, { status: ok ? 200 : 503 });
}
