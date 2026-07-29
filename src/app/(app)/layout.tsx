import { requireCurrentUser } from "@/modules/auth/queries";

export default async function PrivateAppLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUser();
  return children;
}
