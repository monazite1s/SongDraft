/**
 * 跨路由保活的会话草稿：Next.js 切页会卸载 client 组件，useState 随之丢失。
 * 同 tab 软导航靠模块级 memory（JS 上下文仍在）；sessionStorage 作硬刷新备份。
 * 读取走 useState 惰性初始化，避免 effect 内 setState 触发级联渲染。
 */

const memoryStore = new Map<string, unknown>();

export const DRAFT_KEYS = {
  inspiration: "songdraft:inspiration-draft",
  workspace: (projectId: string) => `songdraft:workspace-draft:${projectId || "new"}`,
} as const;

export function loadClientDraft<T>(key: string): T | null {
  if (memoryStore.has(key)) return memoryStore.get(key) as T;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memoryStore.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveClientDraft(key: string, value: unknown): void {
  memoryStore.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode：忽略即可，不影响主流程 */
  }
}

export function clearClientDraft(key: string): void {
  memoryStore.delete(key);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 测试用：清空内存与 sessionStorage。 */
export function resetClientDraftStore(): void {
  memoryStore.clear();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
