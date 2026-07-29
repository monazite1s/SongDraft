import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { ProfileService } from "@/modules/profile/profile-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

const updateSchema = z.object({ displayName: z.string().trim().min(1).max(40) });

export async function GET() {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); return apiSuccess(await new ProfileService().get(user)); }
  catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); return apiSuccess(await new ProfileService().update(user, updateSchema.parse(await request.json()))); }
  catch (error) { return apiError(error); }
}
