import { AudioLines } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 font-semibold text-slate-950">
      <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
        <AudioLines className="size-5" aria-hidden="true" />
      </span>
      {!compact && <span>SongDraft</span>}
    </div>
  );
}
