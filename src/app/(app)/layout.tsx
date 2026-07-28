import { AppShell } from "@/components/app-shell/app-shell";
import { requireCurrentUser } from "@/modules/auth/queries";

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
