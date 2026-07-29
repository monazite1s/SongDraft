import "server-only";

import COS from "cos-nodejs-sdk-v5";

import type { CreateUploadInput, ObjectStorage, StoredObject } from "./contracts";

interface TencentCosConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export function readTencentCosConfig(): TencentCosConfig {
  const config = {
    secretId: process.env.TENCENT_COS_SECRET_ID,
    secretKey: process.env.TENCENT_COS_SECRET_KEY,
    bucket: process.env.TENCENT_COS_BUCKET,
    region: process.env.TENCENT_COS_REGION,
  };
  if (!config.secretId || !config.secretKey || !config.bucket || !config.region) {
    throw new Error("Tencent COS is not configured");
  }
  return config as TencentCosConfig;
}

export class TencentCosStorage implements ObjectStorage {
  private readonly cos: COS;

  constructor(private readonly config: TencentCosConfig = readTencentCosConfig()) {
    this.cos = new COS({ SecretId: config.secretId, SecretKey: config.secretKey });
  }

  async createUpload(input: CreateUploadInput) {
    const url = this.cos.getObjectUrl({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: input.objectKey,
      Method: "PUT",
      Sign: true,
      Expires: input.expiresInSeconds,
      Protocol: "https:",
    });
    return {
      url,
      method: "PUT" as const,
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString(),
    };
  }

  async createDownload(objectKey: string, expiresInSeconds: number) {
    return this.cos.getObjectUrl({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: objectKey,
      Method: "GET",
      Sign: true,
      Expires: expiresInSeconds,
      Protocol: "https:",
    });
  }

  async head(objectKey: string): Promise<StoredObject | null> {
    try {
      const result = await this.cos.headObject({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: objectKey,
      });
      const headers = result.headers as Record<string, string | undefined>;
      return {
        objectKey,
        contentType: headers["content-type"] ?? "application/octet-stream",
        sizeBytes: Number(headers["content-length"] ?? 0),
        etag: result.ETag,
      };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) return null;
      throw error;
    }
  }

  async delete(objectKey: string) {
    await this.cos.deleteObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: objectKey,
    });
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.cos.putObject({
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    });
  }
}
