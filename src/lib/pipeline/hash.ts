import { createHash } from "crypto";
import { gzipSync, gunzipSync } from "zlib";

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function gzip(content: string): Buffer {
  return gzipSync(Buffer.from(content, "utf8"));
}

export function gunzip(buffer: Buffer): string {
  return gunzipSync(buffer).toString("utf8");
}
