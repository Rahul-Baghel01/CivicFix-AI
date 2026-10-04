import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { validateServerConfig } from "./_core/env";
import { sameOrigin } from "./_core/security";
afterEach(() => vi.unstubAllEnvs());
function validConfig() {
  vi.stubEnv("DATABASE_URL", "mysql://user:password@localhost:3306/civicfix");
  vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
  vi.stubEnv("STORAGE_DRIVER", "local");
  vi.stubEnv("AI_API_KEY", "");
}
describe("configuration and browser mutation protection", () => {
  it("rejects missing database configuration and example secrets", () => {
    validConfig();
    vi.stubEnv("DATABASE_URL", "");
    expect(() => validateServerConfig()).toThrow(/DATABASE_URL/);
    validConfig();
    vi.stubEnv("JWT_SECRET", "change-me-to-a-long-random-secret");
    expect(() => validateServerConfig()).toThrow(/JWT_SECRET/);
  });
  it("requires complete AI and S3 configuration only when enabled", () => {
    validConfig();
    expect(() => validateServerConfig()).not.toThrow();
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_BASE_URL", "");
    expect(() => validateServerConfig()).toThrow(/AI_BASE_URL/);
    validConfig();
    vi.stubEnv("STORAGE_DRIVER", "s3");
    vi.stubEnv("S3_BUCKET", "");
    expect(() => validateServerConfig()).toThrow(/S3_BUCKET/);
  });
  it("validates the AWS checksum environment override", () => {
    validConfig();
    vi.stubEnv("AWS_REQUEST_CHECKSUM_CALCULATION", "WHEN_REQUIRED");
    expect(() => validateServerConfig()).not.toThrow();
    vi.stubEnv("AWS_REQUEST_CHECKSUM_CALCULATION", "WHEN_SUPPORTED");
    expect(() => validateServerConfig()).not.toThrow();
    vi.stubEnv("AWS_REQUEST_CHECKSUM_CALCULATION", "typo");
    expect(() => validateServerConfig()).toThrow(
      /AWS_REQUEST_CHECKSUM_CALCULATION/
    );
  });
  it.each(["https://attacker.example", "not a url"])(
    "rejects browser mutation origin %s",
    origin => {
      const status = vi.fn().mockReturnThis(),
        json = vi.fn(),
        next = vi.fn();
      const req = {
        method: "POST",
        header: (name: string) => (name === "origin" ? origin : undefined),
        get: () => "civicfix.example",
      } as unknown as Request;
      sameOrigin(req, { status, json } as unknown as Response, next);
      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  );
  it("accepts same-origin mutations", () => {
    const next = vi.fn();
    sameOrigin(
      {
        method: "POST",
        header: (name: string) =>
          name === "origin" ? "https://civicfix.example" : undefined,
        get: () => "civicfix.example",
      } as unknown as Request,
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalled();
  });
});
