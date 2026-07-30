import { getArtistCatalog } from "@/modules/artists/artist-catalog";
import { getCurrentUser } from "@/modules/auth/queries";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError, apiSuccess } from "@/shared/http/api-response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
    return apiSuccess(await getArtistCatalog().list());
  } catch (error) {
    return apiError(error);
  }
}
