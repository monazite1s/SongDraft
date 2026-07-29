import { Sidebar } from "@/components/inspire/sidebar";
import { Skeleton } from "@/components/feedback/skeleton";

/**
 * 路由级加载骨架屏（docs/SPEC.md）。
 *
 * 关键：Sidebar 作为根容器的第一个子节点渲染，与各页面（workspace / works / settings /
 * 首页）的结构一致。Next.js App Router 在路由切换时用本组件作为 Suspense fallback，
 * React 按子节点位置复用 DOM —— 因此 Sidebar 在「页面 → 加载 → 页面」之间不会被卸载，
 * 只有右侧 content 从骨架屏过渡到真实内容，避免整页闪烁。
 */
export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
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
    </div>
  );
}
