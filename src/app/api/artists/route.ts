import { getArtistCatalog } from "@/modules/artists/artist-catalog";
import { apiSuccess } from "@/shared/http/api-response";

export async function GET() {
  return apiSuccess(await getArtistCatalog().list());
}
