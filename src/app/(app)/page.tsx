/**
 * 首页：灵感记录主流程入口（docs/SPEC.md 记录灵感 → 保存到项目）。
 *
 * IA：`/` = 灵感记录、`/create` = 制作台、`/works` = 歌曲库、`/settings` = 设置。
 * 与 works/settings 页面一致，这里由页面层负责渲染 Sidebar 外壳 + 可滚动内容区，
 * 让灵感记录页保留设计系统外观与全局导航。
 */
import { Sidebar } from "@/components/inspire/sidebar";
import { InspirationRecordPage } from "@/components/inspiration/inspiration-record-page";

export default function HomePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="app-main-scroll flex min-w-0 flex-1 flex-col">
        <InspirationRecordPage />
      </div>
    </div>
  );
}
