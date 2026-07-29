/**
 * 存储驱动环境校验（生产安全 fail-fast）
 *
 * 背景：`STORAGE_DRIVER` 默认 mock，声明 `cos` 但缺凭据时会静默降级到 mock 存储，
 * 生产误用风险高。本模块在启动期/工厂调用期提供显式校验。
 *
 * 与 auth/config 的约定一致（参考 src/infrastructure/auth/config.ts）：
 * - 测试环境或本地零配置（无 DATABASE_URL）→ 宽松，允许 mock。
 * - 声明 `STORAGE_DRIVER=cos` 但缺少任一必需 COS env → **throw**，列出缺失项。
 * - 生产未声明 driver → warn（不炸），避免误阻断；cos 声明缺凭据才必须 throw。
 */
import "server-only";

/** COS 驱动所需的最小凭据集合（与 readTencentCosConfig 对齐）。 */
const REQUIRED_COS_ENV = [
  "TENCENT_COS_SECRET_ID",
  "TENCENT_COS_SECRET_KEY",
  "TENCENT_COS_REGION",
  "TENCENT_COS_BUCKET",
] as const;

export type StorageDriver = "cos" | "mock";

/** 读取并归一化 STORAGE_DRIVER 声明。未声明返回 null（默认 mock 由调用方处理）。 */
export function getDeclaredStorageDriver(): StorageDriver | null {
  const raw = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (!raw) return null;
  return raw === "cos" ? "cos" : "mock";
}

/** 是否处于本地零配置开发环境（无数据库依赖，mock 即合法）。 */
function isLocalZeroConfig(): boolean {
  return !process.env.DATABASE_URL;
}

/** 是否处于宽松模式：测试或本地零配置。宽松模式下允许 mock，不强制校验。 */
export function isStorageValidationLenient(): boolean {
  return process.env.NODE_ENV === "test" || isLocalZeroConfig();
}

/** 返回缺失的必需 COS env 列表（值为空字符串视为缺失）。 */
export function getMissingCosEnv(): readonly string[] {
  return REQUIRED_COS_ENV.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });
}

export interface StorageEnvIssue {
  /** 严重级别：error 必须阻断启动，warn 仅提示。 */
  level: "error" | "warn";
  message: string;
}

/**
 * 收集所有存储 env 问题（不抛出），供 /api/health 复用。
 * - 声明 cos 缺凭据 → error（列出缺失项）
 * - 生产未声明 driver → warn
 * - 其它（mock/宽松）→ 无问题
 */
export function getStorageEnvIssues(): StorageEnvIssue[] {
  const issues: StorageEnvIssue[] = [];
  const driver = getDeclaredStorageDriver();

  if (driver === "cos") {
    const missing = getMissingCosEnv();
    if (missing.length > 0) {
      issues.push({
        level: "error",
        message: `STORAGE_DRIVER=cos 但缺少必需凭据：${missing.join(", ")}`,
      });
    }
    return issues;
  }

  // 未显式声明 driver（默认 mock）
  if (driver === null && process.env.NODE_ENV === "production") {
    issues.push({
      level: "warn",
      message: "生产环境未配置 STORAGE_DRIVER=cos，将使用本地 mock 存储",
    });
  }

  return issues;
}

/**
 * 启动期 fail-fast 校验。仅当声明 cos 且缺凭据时介入。
 *
 * 规则：
 * - 宽松模式（test / 本地零配置）即便声明 cos 缺凭据，也仅 warn 不抛 ——
 *   本地开发者可能复制了 .env.example 但未填值，不应阻断 dev server；
 *   返回 false 让工厂回退到 mock 存储。
 * - 非宽松模式（生产 / 有 DATABASE_URL 的预发）声明 cos 缺凭据 → throw。
 *
 * @returns 当声明 cos 且凭据齐全时返回 true（可安全构建 COS 客户端）；
 *          宽松模式下缺凭据返回 false（工厂应回退 mock）；非 cos 声明返回 true（无 COS 约束）。
 */
export function assertStorageConfig(): boolean {
  const driver = getDeclaredStorageDriver();
  if (driver !== "cos") return true;

  const missing = getMissingCosEnv();
  if (missing.length === 0) return true;

  const detail = `缺少必需 COS 凭据：${missing.join(", ")}`;

  if (isStorageValidationLenient()) {
    // 宽松模式：仅打印警告，不阻断本地开发 / 测试，回退 mock。
    console.warn(`[storage] STORAGE_DRIVER=cos 但 ${detail}；本次将回退到 mock 存储。请补齐 .env 后重启。`);
    return false;
  }

  throw new Error(
    `[storage] 配置校验失败：STORAGE_DRIVER=cos 但 ${detail}。` +
      `请补齐环境变量或改用 STORAGE_DRIVER=mock 进行本地开发。`,
  );
}
