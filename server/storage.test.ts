import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  normalizeKey,
  storagePut,
  storageRead,
  storageImageDataUrl,
  storageCreatePresignedPut,
  storagePutPrepared,
  storageGetSignedUrl,
  storageGet,
  storageCreateUploadReceipt,
  storageVerifyUploadReceipt,
} from "./storage";
import { decodeImage, validateImage } from "./services/images";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=",
  "base64"
);
let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});
describe("image storage safety", () => {
  it.each([
    "../secret",
    "/etc/passwd",
    "C:/secret",
    "a/../../secret",
    "a\\secret",
    "a//b",
    "a/%2e%2e/b",
    "a/./b",
  ])("rejects unsafe key %s", key => {
    expect(() => normalizeKey(key)).toThrow(/Unsafe/);
  });
  it("validates MIME, contents, decoded size and strict base64", () => {
    expect(() => validateImage(png, "image/png")).not.toThrow();
    expect(() => validateImage(png, "image/jpeg")).toThrow(/contents/);
    expect(() => validateImage(png, "image/svg+xml")).toThrow();
    expect(() =>
      validateImage(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")
    ).toThrow(/5 MB/);
    expect(() => decodeImage("data:image/png;base64,!!!")).toThrow();
    expect(() => decodeImage("data:image/png;base64,aGVsbG8=")).toThrow(
      /contents/
    );
  });
  it("stores collision-resistant files and supplies local evidence to vision", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "civicfix-storage-"));
    vi.stubEnv("UPLOAD_DIR", directory);
    vi.stubEnv("STORAGE_DRIVER", "local");
    const first = await storagePut(
      "civicfix/originals/photo.png",
      png,
      "image/png"
    );
    const second = await storagePut(
      "civicfix/originals/photo.png",
      png,
      "image/png"
    );
    expect(first.key).not.toBe(second.key);
    expect(first.url).toMatch(/^\/uploads\//);
    expect(await storageRead(first.key)).toEqual(png);
    expect(await storageImageDataUrl(first.url)).toBe(
      `data:image/png;base64,${png.toString("base64")}`
    );
    await expect(storagePut("../escape.png", png, "image/png")).rejects.toThrow(
      /Unsafe/
    );
  });
  it("preserves prepared upload keys and rejects ticket misuse/replay", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "civicfix-storage-"));
    vi.stubEnv("UPLOAD_DIR", directory);
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
    const prepared = await storageCreatePresignedPut(
      "civicfix/resolutions/7/photo.png",
      "image/png",
      png.length
    );
    const ticket = new URL(
      prepared.uploadUrl,
      "http://localhost"
    ).searchParams.get("ticket")!;
    await expect(
      storagePutPrepared(ticket, 8, png, "image/png")
    ).rejects.toThrow(/authorized/);
    await expect(
      storagePutPrepared(ticket, 7, png, "image/jpeg")
    ).rejects.toThrow(/authorized/);
    expect(await storagePutPrepared(ticket, 7, png, "image/png")).toEqual({
      key: prepared.key,
      url: prepared.url,
    });
    await expect(
      storagePutPrepared(ticket, 7, png, "image/png")
    ).rejects.toThrow();
  });
});

describe("private S3 signing", () => {
  function configured() {
    vi.stubEnv("STORAGE_DRIVER", "s3");
    vi.stubEnv("S3_BUCKET", "civicfix-evidence");
    vi.stubEnv("S3_REGION", "ap-northeast-1");
    vi.stubEnv(
      "S3_ENDPOINT",
      "https://audit-project.storage.supabase.co/storage/v1/s3"
    );
    vi.stubEnv("S3_ACCESS_KEY_ID", "dummy-test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "dummy-test-secret");
    vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
  }

  it.each([undefined, "WHEN_REQUIRED"])(
    "signs browser PUTs without a false checksum (%s)",
    async setting => {
      configured();
      vi.stubEnv("AWS_REQUEST_CHECKSUM_CALCULATION", setting);
      const upload = await storageCreatePresignedPut(
        "civicfix/originals/photo.png",
        "image/png",
        png.length
      );
      const url = new URL(upload.uploadUrl);
      expect(upload.method).toBe("PUT");
      expect(upload.url).toBe(`/uploads/${upload.key}`);
      expect(url.hostname).toBe("audit-project.storage.supabase.co");
      expect(url.pathname).toBe(
        `/storage/v1/s3/civicfix-evidence/${upload.key}`
      );
      expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
      expect(url.searchParams.get("X-Amz-Credential")).toContain(
        "/ap-northeast-1/s3/aws4_request"
      );
      expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
        "content-length;content-type;host"
      );
      expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
      expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
    }
  );

  it("uses short-lived signed GETs while keeping permanent URLs behind authorization", async () => {
    configured();
    vi.stubEnv("S3_PUBLIC_URL", "https://old-public.example");
    const key = "civicfix/originals/photo.png";
    expect((await storageGet(key)).url).toBe(`/uploads/${key}`);
    const url = new URL(await storageGetSignedUrl(key));
    expect(url.pathname).toBe(`/storage/v1/s3/civicfix-evidence/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Credential")).toContain(
      "/ap-northeast-1/s3/aws4_request"
    );
  });

  it("binds draft receipts to a key and rejects tampering and expiry", async () => {
    configured();
    const key = "civicfix/originals/photo.png";
    const token = await storageCreateUploadReceipt(key);
    await expect(
      storageVerifyUploadReceipt(key, token)
    ).resolves.toBeUndefined();
    await expect(
      storageVerifyUploadReceipt("civicfix/originals/another.png", token)
    ).rejects.toThrow();
    await expect(
      storageVerifyUploadReceipt(key, `${token}corrupt`)
    ).rejects.toThrow();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 3_601_000));
    await expect(storageVerifyUploadReceipt(key, token)).rejects.toThrow();
  });
});
