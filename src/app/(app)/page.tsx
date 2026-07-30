/**
 * 首页：灵感记录主流程入口（docs/SPEC.md 记录灵感 → 保存到项目）。
 *
 * IA：`/` = 灵感记录、`/create` = 制作台、`/works` = 歌曲库、`/settings` = 设置。
 * 外壳（Sidebar + 内容 flex）由 (app)/layout.tsx 统一渲染，本页只返回内容区。
 */
import { InspirationRecordPage } from "@/components/inspiration/inspiration-record-page";

export default function HomePage() {
  return (
    <div className="app-main-scroll flex min-h-0 min-w-0 flex-1 flex-col">
      <InspirationRecordPage />
    </div>
  );
}
