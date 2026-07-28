import { WorkspaceSkeleton } from "@/components/feedback/skeleton";

export default function WorkspacePage() {
  return (
    <main className="p-5 lg:p-8">
      <h1 className="text-2xl font-semibold">创作工作台</h1>
      <p className="mt-2 text-sm text-slate-500">正式素材、Creative Brief 和 Generation Plan 将在这里组合。</p>
      <div className="mt-6"><WorkspaceSkeleton /></div>
    </main>
  );
}
