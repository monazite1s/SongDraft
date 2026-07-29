/** 公开分享页：按 Token 加载只读 Demo 与评论。 */
import { notFound } from "next/navigation";

import { PublicShareClient } from "@/components/sharing/public-share-client";
import { ShareService } from "@/modules/sharing/share-service";

export default async function SharedDemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let share;
  try { share = await new ShareService().getPublic(token); }
  catch { notFound(); }
  return <PublicShareClient token={token} share={share} />;
}
