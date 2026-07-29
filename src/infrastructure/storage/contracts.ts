export interface CreateUploadInput {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  expiresInSeconds: number;
}

export interface SignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StoredObject {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag?: string;
}

export interface ObjectStorage {
  createUpload(input: CreateUploadInput): Promise<SignedUpload>;
  createDownload(objectKey: string, expiresInSeconds: number): Promise<string>;
  head(objectKey: string): Promise<StoredObject | null>;
  delete(objectKey: string): Promise<void>;
  /**
   * 服务端直传：把一段 Buffer 写入指定 objectKey。
   * 用于把 MiniMax 等外部 Provider 返回的临时音频转存到私有 COS，使 URL 可控、可续期。
   */
  putObject(objectKey: string, body: Buffer, contentType: string): Promise<void>;
}
