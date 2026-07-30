import { Skeleton } from "@/components/feedback/skeleton";

/**
 * 路由级加载骨架屏（docs/SPEC.md）。
 *
 * 外壳（Sidebar + 内容 flex）由 (app)/layout.tsx 统一渲染，layout 在路由切换时保持挂载，
 * Sidebar 不被卸载；本组件只作为 layout `<main>` 的内容 fallback，渲染右侧骨架。
 */
export default function Loading() {
  return (
    <div
      className="app-main-scroll flex min-w-0 flex-1 flex-col p-5 lg:p-8"
      aria-busy="true"
      aria-label="内容加载中"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-8 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[520px]" />
      </div>
    </div>
  );
}
