/**
 * 歌曲库 /works（docs/implementation-todo.md）。
 * Server Component：读取 URL 查询参数作为初始筛选，交给客户端组件管理状态与请求。
 * 外壳（Sidebar + 内容 flex）由 (app)/layout.tsx 统一渲染，本页只返回内容区。
 */
import { WorksLibraryClient } from "@/components/works/works-library-client";

export const dynamic = "force-dynamic";

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="app-main-scroll flex min-h-0 min-w-0 flex-1 flex-col">
      <WorksLibraryClient initialParams={params} />
    </div>
  );
}
