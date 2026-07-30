import { requireCurrentUser } from "@/modules/auth/queries";
import { Sidebar } from "@/components/inspire/sidebar";
import { MobileNav } from "@/components/inspire/mobile-nav";

/**
 * (app) 路由段统一外壳：桌面 Sidebar + 移动端底部导航。
 *
 * 关键：Sidebar 只在此处挂载一次（不再由各页面各自渲染），切路由时 layout 保持不卸载，
 * Sidebar 的 useEffect（/api/profile、/api/works/recent-songs）不会重跑 → Bug1 修复。
 * 桌面（lg+）：lg:flex-row → Sidebar(w-60) | main(flex-1)，MobileNav lg:hidden 不占位。
 * 移动（<lg）：flex-col → Sidebar(hidden) | main(flex-1 满屏) | MobileNav(底部，自然贴底)。
 */
export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUser();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background lg:flex-row">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      <MobileNav />
    </div>
  );
}
