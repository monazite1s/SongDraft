import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/queries";
import { AnalysisService } from "@/modules/analyzers/analysis-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); const { id } = await context.params; return apiSuccess(await new AnalysisService().list(user, z.string().uuid().parse(id))); }
  catch (error) { return apiError(error); }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await getCurrentUser(); if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录"); const { id } = await context.params; return apiSuccess(await new AnalysisService().analyze(user, z.string().uuid().parse(id)), 201); }
  catch (error) { return apiError(error); }
}
