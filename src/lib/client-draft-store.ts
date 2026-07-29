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

/**
 * 「上次活跃项目」持久化（任务6）：与草稿（sessionStorage）正交的独立维度。
 * 跨页面切换/刷新后，工作台 /create 入口据此自动回到上次活跃项目。
 * 用 localStorage（非 sessionStorage），需跨 tab/长期保留。
 */
const LAST_PROJECT_KEY = "songdraft:last-project";

export interface LastProject {
  id: string;
  title: string;
}

export function loadLastProject(): LastProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastProject>;
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    return { id: parsed.id, title: typeof parsed.title === "string" ? parsed.title : "" };
  } catch {
    return null;
  }
}

export function saveLastProject(id: string, title: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ id, title }));
  } catch {
    /* quota / private mode：忽略即可 */
  }
}

/** 清除失效的「上次活跃项目」（项目已删除 / mock 重启丢失后避免反复跳进 404）。 */
export function clearLastProject(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}

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
    window.localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}
