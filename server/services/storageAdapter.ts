import path from "node:path";
import { mkdir, writeFile, readFile, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { validateImage } from "./images";
import { SignJWT, jwtVerify } from "jose";
export function normalizeKey(key: string) {
  if (
    !key ||
    key.length > 800 ||
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.split("/").some(p => !p || p === "." || p === "..") ||
    path.isAbsolute(key)
  )
    throw new Error("Unsafe storage key.");
  return key;
}
export function uploadDirectory() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}
function filePath(key: string) {
  return path.join(uploadDirectory(), normalizeKey(key));
}
async function safeDirectory(key: string) {
  const base = uploadDirectory(),
    target = path.dirname(filePath(key));
  await mkdir(base, { recursive: true });
  await mkdir(target, { recursive: true });
  const relative = path.relative(await realpath(base), await realpath(target));
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Upload directory escapes the storage root.");
}
function newKey(key: string) {
  normalizeKey(key);
  const extension = path.posix.extname(key);
  return `${key.slice(0, key.length - extension.length)}_${randomUUID()}${extension}`;
}
function s3() {
  if (!process.env.S3_BUCKET || !process.env.S3_REGION)
    throw new Error("S3_BUCKET and S3_REGION are required.");
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    // Avoid signing the SDK's default empty-body CRC32 on browser PUTs.
    // The installed SDK also supports the standard AWS environment override.
    requestChecksumCalculation:
      process.env.AWS_REQUEST_CHECKSUM_CALCULATION === "WHEN_SUPPORTED"
        ? "WHEN_SUPPORTED"
        : "WHEN_REQUIRED",
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}
function driver() {
  const value = process.env.STORAGE_DRIVER || "local";
  if (value !== "local" && value !== "s3")
    throw new Error("STORAGE_DRIVER must be local or s3.");
  return value;
}
function evidenceUrl(key: string) {
  // This stable application URL checks permissions before serving/redirecting.
  // Never persist an expiring signature or bypass access checks with a CDN URL.
  return `/uploads/${key}`;
}
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
) {
  const bytes =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  validateImage(bytes, contentType);
  const key = newKey(relKey);
  if (driver() === "local") {
    await safeDirectory(key);
    await writeFile(filePath(key), bytes, { flag: "wx" });
  } else
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );
  return { key, url: evidenceUrl(key) };
}
function ticketSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error("JWT_SECRET is required for prepared uploads.");
  return new TextEncoder().encode(value);
}
export async function storageCreateUploadReceipt(key: string) {
  return new SignJWT({ key: normalizeKey(key) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("civicfix-storage")
    .setAudience("original-evidence")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(ticketSecret());
}
export async function storageVerifyUploadReceipt(key: string, token: string) {
  const { payload } = await jwtVerify(token, ticketSecret(), {
    algorithms: ["HS256"],
    issuer: "civicfix-storage",
    audience: "original-evidence",
  });
  if (payload.key !== normalizeKey(key))
    throw new Error("Upload receipt does not match this evidence.");
}
export async function storagePutPrepared(
  ticket: string,
  userId: number,
  bytes: Buffer,
  contentType: string
) {
  const { payload } = await jwtVerify(ticket, ticketSecret(), {
    algorithms: ["HS256"],
    issuer: "civicfix-storage",
    audience: "resolution-upload",
  });
  if (
    typeof payload.key !== "string" ||
    !payload.key.startsWith(`civicfix/resolutions/${userId}/`) ||
    payload.contentType !== contentType ||
    payload.contentLength !== bytes.length
  )
    throw new Error("Prepared upload does not match authorized evidence.");
  validateImage(bytes, contentType);
  const key = normalizeKey(payload.key);
  if (driver() !== "local")
    throw new Error("Prepared server upload requires local storage.");
  await safeDirectory(key);
  await writeFile(filePath(key), bytes, { flag: "wx" });
  return { key, url: evidenceUrl(key) };
}
export async function storageCreatePresignedPut(
  relKey: string,
  contentType = "image/jpeg",
  contentLength?: number
) {
  const key = newKey(relKey);
  if (
    !contentLength ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType)
  )
    throw new Error("A supported image type and size are required.");
  if (driver() === "local") {
    const ticket = await new SignJWT({ key, contentType, contentLength })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("civicfix-storage")
      .setAudience("resolution-upload")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(ticketSecret());
    return {
      key,
      url: evidenceUrl(key),
      uploadUrl: `/api/authority/resolution-upload?ticket=${encodeURIComponent(ticket)}`,
      method: "POST" as const,
    };
  }
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    {
      expiresIn: 300,
      signableHeaders: new Set(["content-type", "content-length"]),
    }
  );
  return { key, url: evidenceUrl(key), uploadUrl, method: "PUT" as const };
}
export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: evidenceUrl(key) };
}
export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  if (driver() === "local") return evidenceUrl(key);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    { expiresIn: 300 }
  );
}
export async function storageRead(relKey: string) {
  const key = normalizeKey(relKey);
  if (driver() === "local") {
    const resolved = await realpath(filePath(key)),
      base = await realpath(uploadDirectory());
    const relative = path.relative(base, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Unsafe storage path.");
    return readFile(resolved);
  }
  const object = await s3().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
  );
  if (!object.Body || (object.ContentLength ?? 0) > 5 * 1024 * 1024)
    throw new Error("Invalid stored image.");
  return Buffer.from(await object.Body.transformToByteArray());
}
export async function storageValidate(relKey: string) {
  const bytes = await storageRead(relKey),
    ext = path.posix.extname(relKey);
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  validateImage(bytes, mime);
  return { bytes, mime };
}
export async function storageImageDataUrl(url: string) {
  if (url.startsWith("/uploads/")) {
    const { bytes, mime } = await storageValidate(
      url.slice("/uploads/".length)
    );
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
  if (!url.startsWith("data:image/") && !/^https?:\/\//.test(url))
    throw new Error("Invalid evidence URL.");
  return url;
}
