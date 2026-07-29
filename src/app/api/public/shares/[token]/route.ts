import { z } from "zod";

import { ShareService } from "@/modules/sharing/share-service";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try { const { token } = await context.params; return apiSuccess(await new ShareService().getPublic(z.string().min(20).max(128).parse(token))); }
  catch (error) { return apiError(error); }
}
