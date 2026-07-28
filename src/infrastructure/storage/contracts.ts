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
}
