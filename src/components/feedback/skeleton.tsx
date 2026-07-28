export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export function WorkspaceSkeleton() {
  return (
    <main aria-label="页面加载中" className="p-5 lg:p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 xl:grid-cols-[360px_240px_1fr]">
        <Skeleton className="h-[560px]" /><Skeleton className="h-[560px]" /><Skeleton className="h-[560px]" />
      </div>
    </main>
  );
}
