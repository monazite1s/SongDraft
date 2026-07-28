import { Home, Library, Plus, Settings } from "lucide-react";
import Link from "next/link";

import type { AuthUser } from "@/modules/auth/types";
import { Logo } from "@/components/ui/logo";

const navigation = [
  { href: "/", label: "首页", icon: Home },
  { href: "/create/new", label: "创作", icon: Plus },
  { href: "/works", label: "作品", icon: Library },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 md:flex md:flex-col">
        <div className="px-2"><Logo /></div>
        <nav aria-label="主导航" className="mt-10 space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950">
              <Icon className="size-4" aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">{user.displayName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 md:hidden">
          <Logo /><span className="text-sm text-slate-500">{user.displayName}</span>
        </header>
        {children}
      </div>

      <nav aria-label="移动导航" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] text-slate-600">
            <Icon className="size-4" aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
