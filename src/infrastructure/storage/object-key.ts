import { DomainError } from "@/shared/errors/domain-error";

const allowedExtensions = new Set(["mp3", "m4a", "wav", "webm", "jpg", "jpeg", "png", "webp", "mp4", "mov"]);

export function getSafeExtension(filename: string) {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension || !allowedExtensions.has(extension)) {
    throw new DomainError("UPLOAD_INVALID", 422, "不支持的文件扩展名");
  }
  return extension;
}

export function createObjectKey(input: {
  environment: string;
  userId: string;
  projectId: string;
  kind: "audio" | "image" | "video";
  filename: string;
  objectId?: string;
}) {
  const extension = getSafeExtension(input.filename);
  const environment = input.environment.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "dev";
  const objectId = input.objectId ?? crypto.randomUUID();
  return `${environment}/users/${input.userId}/projects/${input.projectId}/${input.kind}/${objectId}.${extension}`;
}

export function isOwnedObjectKey(objectKey: string, userId: string) {
  return objectKey.includes(`/users/${userId}/`) && !objectKey.includes("..");
}
