import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./_core/app";

afterEach(() => vi.unstubAllEnvs());

describe("Vercel production configuration", () => {
  function requiredEnvironment() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://user:password@localhost:3306/civicfix");
    vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
  }

  it("rejects ephemeral local evidence storage", () => {
    requiredEnvironment();
    vi.stubEnv("STORAGE_DRIVER", "local");
    expect(() => createApp(true)).toThrow(/STORAGE_DRIVER=s3/);
  });

  it.each([undefined, ""])(
    "starts with private S3 storage and no public URL (%s)",
    publicUrl => {
      requiredEnvironment();
      vi.stubEnv("STORAGE_DRIVER", "s3");
      vi.stubEnv("S3_BUCKET", "civicfix-test");
      vi.stubEnv("S3_REGION", "ap-northeast-1");
      vi.stubEnv("S3_PUBLIC_URL", publicUrl);
      expect(typeof createApp(true)).toBe("function");
    }
  );

  it("exports a usable Express handler with valid S3 configuration", () => {
    requiredEnvironment();
    vi.stubEnv("STORAGE_DRIVER", "s3");
    vi.stubEnv("S3_BUCKET", "civicfix-test");
    vi.stubEnv("S3_REGION", "ap-northeast-1");
    vi.stubEnv("S3_PUBLIC_URL", "https://assets.example.org");
    expect(typeof createApp(true)).toBe("function");
  });
});
