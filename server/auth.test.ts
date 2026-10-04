import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import type { User } from "../drizzle/schema.js";
import { appRouter } from "./routers.js";
import {
  authenticateRequest,
  createSession,
  loginSchema,
  registerSchema,
  verifySession,
} from "./services/auth.js";
import * as db from "./db.js";
import { COOKIE_NAME } from "../shared/const.js";
import type { TrpcContext } from "./_core/context.js";
vi.mock("./db.js", () => ({
  getDb: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  recordSignIn: vi.fn(),
}));
const user: User = {
  id: 42,
  name: "Citizen",
  email: "citizen@example.com",
  passwordHash: null,
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const request = { headers: {} } as Request;
let cookie: ReturnType<typeof vi.fn>, clearCookie: ReturnType<typeof vi.fn>;
let sessions: unknown[],
  insert: ReturnType<typeof vi.fn>,
  remove: ReturnType<typeof vi.fn>;
function context(role?: "user" | "admin"): TrpcContext {
  const { passwordHash: _hash, ...safe } = user;
  return {
    req: request,
    res: { cookie, clearCookie } as unknown as Response,
    user: role ? { ...safe, role } : null,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
  vi.stubEnv("ADMIN_EMAILS", "admin@civicfix.local");
  cookie = vi.fn();
  clearCookie = vi.fn();
  sessions = [];
  insert = vi.fn().mockImplementation(async value => {
    sessions.push(value);
  });
  remove = vi.fn().mockImplementation(async () => {
    sessions = [];
  });
  vi.mocked(db.getDb).mockResolvedValue({
    insert: () => ({ values: insert }),
    delete: () => ({ where: remove }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => sessions }) }),
    }),
  } as unknown as Awaited<ReturnType<typeof db.getDb>>);
  vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
  vi.mocked(db.getUserById).mockResolvedValue(user);
  vi.mocked(db.createUser).mockImplementation(
    async input => ({ ...user, ...input }) as User
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("native authentication and server authorization", () => {
  it("normalizes email and enforces password byte limits", () => {
    expect(
      registerSchema.parse({
        name: "Citizen",
        email: "  CITIZEN@example.com ",
        password: "long-password-123",
      }).email
    ).toBe(user.email);
    expect(
      registerSchema.safeParse({
        name: "Citizen",
        email: user.email,
        password: "short",
      }).success
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        name: "Citizen",
        email: user.email,
        password: "🔑".repeat(20),
      }).success
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: user.email, password: "x".repeat(73) })
        .success
    ).toBe(false);
  });
  it("registers a citizen, hashes the password and returns no hash", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.auth.register({
      name: "Citizen",
      email: user.email,
      password: "long-password-123",
    });
    const input = vi.mocked(db.createUser).mock.calls[0][0];
    expect(input.role).toBe("user");
    expect(input).not.toHaveProperty("password");
    expect(await bcrypt.compare("long-password-123", input.passwordHash!)).toBe(
      true
    );
    expect(result).not.toHaveProperty("passwordHash");
    expect(cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
  });
  it("grants admin only to explicitly allowlisted registrations", async () => {
    await appRouter
      .createCaller(context())
      .auth.register({
        name: "Admin",
        email: "ADMIN@CIVICFIX.LOCAL",
        password: "long-password-123",
      });
    expect(vi.mocked(db.createUser).mock.calls[0][0].role).toBe("admin");
    await expect(
      appRouter
        .createCaller(context())
        .auth.register({
          name: "Citizen",
          email: user.email,
          password: "long-password-123",
          role: "admin",
        } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects duplicate registration", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(user);
    await expect(
      appRouter
        .createCaller(context())
        .auth.register({
          name: "Citizen",
          email: user.email,
          password: "long-password-123",
        })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.createUser).not.toHaveBeenCalled();
  });
  it("logs in with a valid hash and refreshes sign-in time", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("long-password-123", 4),
    });
    const result = await appRouter
      .createCaller(context())
      .auth.login({ email: user.email, password: "long-password-123" });
    expect(result.id).toBe(user.id);
    expect(result).not.toHaveProperty("passwordHash");
    expect(db.recordSignIn).toHaveBeenCalledWith(user.id, "user");
  });
  it.each(["missing", "wrong", "legacy"])(
    "rejects %s credentials",
    async scenario => {
      vi.mocked(db.getUserByEmail).mockResolvedValue(
        scenario === "missing"
          ? undefined
          : {
              ...user,
              passwordHash:
                scenario === "legacy"
                  ? null
                  : await bcrypt.hash("correct-password-123", 4),
            }
      );
      await expect(
        appRouter
          .createCaller(context())
          .auth.login({ email: user.email, password: "wrong-password-123" })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });
      expect(cookie).not.toHaveBeenCalled();
    }
  );
  it("authenticates a signed session and rejects it after logout", async () => {
    const ctx = context("user");
    await createSession(ctx.user!, ctx.req, ctx.res);
    const token = cookie.mock.calls[0][1];
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as Request;
    expect(await authenticateRequest(req)).toMatchObject({ id: user.id });
    expect(await authenticateRequest(req)).not.toHaveProperty("passwordHash");
    await appRouter.createCaller({ ...ctx, req }).auth.logout();
    expect(await authenticateRequest(req)).toBeNull();
    expect(clearCookie).toHaveBeenCalled();
  });
  it("rejects tampered, expired and foreign-audience tokens", async () => {
    const key = new TextEncoder().encode(process.env.JWT_SECRET!);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("42")
      .setJti("expired")
      .setIssuer("civicfix")
      .setAudience("civicfix-web")
      .setExpirationTime(1)
      .sign(key);
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("42")
      .setJti("foreign")
      .setIssuer("civicfix")
      .setAudience("other")
      .setExpirationTime("1h")
      .sign(key);
    expect(await verifySession("tampered")).toBeNull();
    expect(await verifySession(expired)).toBeNull();
    expect(await verifySession(foreign)).toBeNull();
  });
  it("rejects protected procedures without a session and authority access for citizens", async () => {
    await expect(
      appRouter.createCaller(context()).civic.mine()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      appRouter.createCaller(context()).authority.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const citizen = appRouter.createCaller(context("user"));
    await expect(
      citizen.authority.update({
        reportId: "CIV-2026-08-000124",
        status: "Assigned",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      citizen.authority.resolve({
        reportId: "CIV-2026-08-000124",
        resolutionNote: "Work completed.",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
