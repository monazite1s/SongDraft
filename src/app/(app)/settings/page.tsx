import { ProfileSettings } from "@/components/profile/profile-settings";
import { requireCurrentUser } from "@/modules/auth/queries";
import { ProfileService } from "@/modules/profile/profile-service";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const profile = await new ProfileService().get(user);
  return <main className="mx-auto max-w-6xl p-5 lg:p-10"><p className="text-sm font-medium text-indigo-600">SongDraft 设置</p><h1 className="mt-2 text-3xl font-semibold">设置</h1><p className="mt-2 text-slate-500">管理应用展示资料与后续 Provider 配置。</p><ProfileSettings profile={profile} /></main>;
}
