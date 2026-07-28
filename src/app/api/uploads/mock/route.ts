import { getObjectStorage } from "@/infrastructure/storage/factory";
import { MockObjectStorage } from "@/infrastructure/storage/mock-storage";
import { isOwnedObjectKey } from "@/infrastructure/storage/object-key";
import { getCurrentUser } from "@/modules/auth/queries";
import { DomainError } from "@/shared/errors/domain-error";
import { apiError } from "@/shared/http/api-response";

const maxMockBytes = 100 * 1024 * 1024;

async function getAuthorizedMockStorage(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.STORAGE_DRIVER === "cos") {
    throw new DomainError("NOT_FOUND", 404, "资源不存在");
  }
  const user = await getCurrentUser();
  if (!user) throw new DomainError("UNAUTHENTICATED", 401, "需要登录");
  const objectKey = new URL(request.url).searchParams.get("key");
  if (!objectKey || !isOwnedObjectKey(objectKey, user.id)) {
    throw new DomainError("FORBIDDEN", 403, "无权访问该资源");
  }
  const storage = getObjectStorage();
  if (!(storage instanceof MockObjectStorage)) throw new DomainError("NOT_FOUND", 404, "资源不存在");
  return { storage, objectKey };
}

export async function PUT(request: Request) {
  try {
    const { storage, objectKey } = await getAuthorizedMockStorage(request);
    const contentType = request.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > maxMockBytes) {
      throw new DomainError("UPLOAD_INVALID", 422, "文件大小无效");
    }
    const contents = new Uint8Array(await request.arrayBuffer());
    if (contents.byteLength !== contentLength) throw new DomainError("UPLOAD_INVALID", 422, "文件大小不一致");
    await storage.put(objectKey, contentType, contents);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { storage, objectKey } = await getAuthorizedMockStorage(request);
    const object = await storage.head(objectKey);
    if (!object) throw new DomainError("NOT_FOUND", 404, "资源不存在");
    return new Response(await storage.read(objectKey), {
      headers: { "content-type": object.contentType, "cache-control": "private, max-age=60" },
    });
  } catch (error) {
    return apiError(error);
  }
}
