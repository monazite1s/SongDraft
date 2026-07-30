/**
 * 音频转存工具：把外部 Provider（MiniMax 等）返回的临时 HTTPS 音频转存到私有 COS。
 *
 * 背景：MiniMax 生成的音频返回的是临时 HTTPS URL（会过期），需要持久化到自有存储；
 * 读取时再用 createDownload 生成短时签名 URL 播放，避免外链失效。
 *
 * 仅在真实 COS 可用时执行转存；调用方负责判断模式（无 DATABASE_URL / 无 COS 凭据时不调用）。
 */
import "server-only";

import { getDeclaredStorageDriver, getMissingCosEnv } from "@/infrastructure/env";

import { getObjectStorage } from "./factory";

/** 当前是否真实使用腾讯云 COS（声明 cos 且凭据齐全，工厂会构建真实 COS 客户端）。 */
export function isRealCosInUse(): boolean {
  return getDeclaredStorageDriver() === "cos" && getMissingCosEnv().length === 0;
}

/**
 * 拉取 sourceUrl 并以 Buffer 形式直传到 objectKey。
 * @returns 落地后的 objectKey（即入参）。
 */
export async function transferAudioToStorage(sourceUrl: string, objectKey: string): Promise<string> {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`transfer: 拉取源音频失败 (${response.status})`);
  // MiniMax/CDN 常返回 application/octet-stream；浏览器 <audio> 依赖 audio/* MIME，强制落为 audio/mpeg。
  const rawType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  const contentType = rawType.startsWith("audio/") ? rawType : "audio/mpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  await getObjectStorage().putObject(objectKey, buffer, contentType);
  return objectKey;
}

/**
 * 解析版本的音频播放地址：
 * - 若 objectKey 是真实 COS key（既非 `external://` 也非 `mock://`）且 COS 可用 → 返回短时签名 GET URL（1h）。
 * - 否则回退到 fallbackUrl（兼容历史 MiniMax 临时 URL / mock 数据 / 未配置 COS）。
 */
export async function resolveAudioUrl(
  objectKey: string | null | undefined,
  fallbackUrl: string | null | undefined,
): Promise<string | null> {
  if (objectKey && !objectKey.startsWith("external://") && !objectKey.startsWith("mock://") && isRealCosInUse()) {
    try {
      return await getObjectStorage().createDownload(objectKey, 3_600);
    } catch (error) {
      console.warn("[storage] 解析签名音频 URL 失败，回退到 fallback：", error);
    }
  }
  return fallbackUrl ?? null;
}
