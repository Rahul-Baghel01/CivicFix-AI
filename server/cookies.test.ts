import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import type { Request } from "express";
afterEach(() => vi.unstubAllEnvs());
describe("session cookie options", () => {
  it("supports HTTP development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionCookieOptions({} as Request)).toMatchObject({
      secure: false,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });
  it("requires HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieOptions({} as Request)).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
  });
});
