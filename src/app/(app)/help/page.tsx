/**
 * 帮助与文档页（/help）。
 * Server Component：(app) layout 已对路由做 requireCurrentUser 鉴权，
 * 这里再取一次当前用户用于头部展示，并套用与其它 (app) 页一致的 Sidebar 外壳。
 */
import { LifeBuoy } from "lucide-react";

import { Sidebar } from "@/components/inspire/sidebar";
import { HelpDocsClient } from "@/components/help/help-docs-client";
import { requireCurrentUser } from "@/modules/auth/queries";

export default async function HelpPage() {
  const user = await requireCurrentUser();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <LifeBuoy className="size-4 text-brand" />
          <span className="text-sm font-medium text-foreground">
            {user.displayName} · 帮助中心
          </span>
        </div>
        <HelpDocsClient />
      </div>
    </div>
  );
}
