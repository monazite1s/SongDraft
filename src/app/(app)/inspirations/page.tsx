/**
 * 灵感库 /inspirations（docs/implementation-todo.md §5）。
 * Server Component：读取 URL 查询参数作为初始筛选，交给客户端组件管理状态与请求。
 */
import { Sidebar } from "@/components/inspire/sidebar";
import { InspirationLibraryClient } from "@/components/inspirations/inspiration-library-client";

export const dynamic = "force-dynamic";

export default async function InspirationLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <InspirationLibraryClient initialParams={params} />
      </div>
    </div>
  );
}
