/** 公开分享页：按 Token + 登录用户白名单授权加载只读 Demo 与评论。 */
import { notFound, redirect } from "next/navigation";

import { isMockAuthEnabled } from "@/infrastructure/auth/config";
import { getCurrentUser } from "@/modules/auth/queries";
import { PublicShareClient } from "@/components/sharing/public-share-client";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";

export default async function SharedDemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  let share;
  try { share = await new ShareService().getPublic(token, user); }
  catch (error) {
    // 未登录跳转登录页，登录后回到当前分享链接（Mock 模式登录无需跳转）。
    if (error instanceof DomainError && error.code === "UNAUTHENTICATED" && !isMockAuthEnabled()) {
      redirect(`/login?redirect=${encodeURIComponent(`/s/${token}`)}`);
    }
    notFound();
  }
  return <PublicShareClient token={token} share={share} />;
}
