import { z } from "zod";

import { AnalysisService } from "@/modules/analyzers/analysis-service";
import { getCurrentUser } from "@/modules/auth/queries";
import { GenerationService } from "@/modules/generation/generation-service";
import { ProjectService } from "@/modules/projects/project-service";
import { safeExportFilename } from "@/modules/projects/export-utils";
import { createMockDemoWav } from "@/modules/projects/mock-wav";
import { ShareService } from "@/modules/sharing/share-service";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError } from "@/shared/http/api-response";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    const { id } = await context.params;
    const projectId = z.string().uuid().parse(id);
    const format = new URL(request.url).searchParams.get("format");
    if (format === "audio") {
      const project = await new ProjectService().get(user.id, projectId);
      const realAudio = await new GenerationService().getCurrentAudio(user, projectId);
      if (realAudio) return Response.redirect(realAudio.url, 307);
      const wav = createMockDemoWav();
      return new Response(wav, { headers: { "content-type": "audio/wav", "content-disposition": `attachment; filename="${safeExportFilename(project.title)}-mock-demo.wav"`, "cache-control": "private, no-store", "x-songdraft-execution": "simulated" } });
    }
    const [project, analyses, versions, shares] = await Promise.all([new ProjectService().get(user.id, projectId), new AnalysisService().list(user, projectId), new GenerationService().listVersions(user, projectId), new ShareService().list(user, projectId)]);
    const packageData = { schemaVersion: "songdraft.creative-package.v1", exportedAt: new Date().toISOString(), executionDisclosure: "可能包含 simulated 结果；请以 executionKind 和 hasAudio 字段判断真实能力。", project, analyses, versions, shares };
    return new Response(JSON.stringify(packageData, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${safeExportFilename(project.title)}-songdraft.json"`, "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
