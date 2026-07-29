import { z } from "zod";

import { AnalysisService } from "@/modules/analyzers/analysis-service";
import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { ProjectService } from "@/modules/projects/project-service";
import { safeExportFilename } from "@/modules/projects/export-utils";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError } from "@/shared/http/api-response";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    const projectId = z.string().uuid().parse(id);
    const [project, analyses, versions, shares] = await Promise.all([new ProjectService().get(user.id, projectId), new AnalysisService().list(user, projectId), new GenerationService().listVersions(user, projectId), new ShareService().list(user, projectId)]);
    const packageData = { schemaVersion: "songdraft.creative-package.v1", exportedAt: new Date().toISOString(), executionDisclosure: "可能包含 simulated 结果；请以 executionKind 和 hasAudio 字段判断真实能力。", project, analyses, versions, shares };
    return new Response(JSON.stringify(packageData, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${safeExportFilename(project.title)}-songdraft.json"`, "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
