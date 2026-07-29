import { getCurrentUser } from "@/modules/auth/queries";
import { getInspirationEnricher } from "@/modules/ai/inspiration-enricher";
import { inspirationSnapshotSchema } from "@/modules/inspirations/inspiration-schema";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

const enrichBodySchema = inspirationSnapshotSchema;

/** 灵感 AI 补全：基于用户已填字段补全空缺的结构化字段（moods/speedFeel/soundHints/referenceWorks/title）。 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const body = (await request.json()) as { snapshot?: unknown };
    const snapshot = enrichBodySchema.parse(body.snapshot ?? body);
    const result = await getInspirationEnricher().enrich(snapshot);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
