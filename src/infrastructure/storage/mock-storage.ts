import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CreateUploadInput, ObjectStorage } from "./contracts";

export class MockObjectStorage implements ObjectStorage {
  private readonly root = path.join(tmpdir(), "songdraft-mock-storage");

  private resolve(objectKey: string) {
    if (objectKey.includes("..") || objectKey.startsWith("/")) throw new Error("Invalid object key");
    const target = path.resolve(this.root, objectKey);
    if (!target.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error("Invalid object key");
    return target;
  }

  async createUpload(input: CreateUploadInput) {
    return {
      url: `/api/uploads/mock?key=${encodeURIComponent(input.objectKey)}`,
      method: "PUT" as const,
      headers: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString(),
    };
  }

  async createDownload(objectKey: string) {
    return `/api/uploads/mock?key=${encodeURIComponent(objectKey)}`;
  }

  async head(objectKey: string) {
    try {
      const target = this.resolve(objectKey);
      const [file, metadata] = await Promise.all([
        stat(target),
        readFile(`${target}.json`, "utf8").then((value) => JSON.parse(value) as { contentType: string }),
      ]);
      return { objectKey, contentType: metadata.contentType, sizeBytes: file.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(objectKey: string) {
    const target = this.resolve(objectKey);
    await Promise.all([rm(target, { force: true }), rm(`${target}.json`, { force: true })]);
  }

  async put(objectKey: string, contentType: string, contents: Uint8Array) {
    const target = this.resolve(objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await Promise.all([
      writeFile(target, contents),
      writeFile(`${target}.json`, JSON.stringify({ contentType }), "utf8"),
    ]);
  }

  /** 契约要求：服务端直传（转存外部音频用）。复用本地文件落地实现。 */
  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.put(objectKey, contentType, new Uint8Array(body));
  }

  async read(objectKey: string) {
    return readFile(this.resolve(objectKey));
  }
}
