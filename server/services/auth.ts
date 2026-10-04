import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse } from "cookie";
import { and, eq, gt, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { authSessions, type User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
export type SessionUser = Omit<User, "passwordHash">;
export function publicUser(user: User): SessionUser {
  const { passwordHash: _hash, ...safe } = user;
  return safe;
}
const email = z
  .string()
  .trim()
  .pipe(z.email().max(320))
  .transform(v => v.toLowerCase());
const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    v => Buffer.byteLength(v) <= 72,
    "Password must be at most 72 UTF-8 bytes."
  );
export const registerSchema = z
  .object({ name: z.string().trim().min(1).max(120), email, password })
  .strict();
export const loginSchema = z
  .object({
    email,
    password: z
      .string()
      .min(1)
      .max(72)
      .refine(v => Buffer.byteLength(v) <= 72),
  })
  .strict();
export function isBootstrapAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || value.startsWith("change-me"))
    throw new Error(
      "JWT_SECRET must be a random secret of at least 32 characters."
    );
  return new TextEncoder().encode(value);
}
export async function createSession(
  user: SessionUser,
  req: Request,
  res: Response
) {
  const id = randomUUID(),
    expiresAt = new Date(Date.now() + 7 * 86400000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setJti(id)
    .setIssuer("civicfix")
    .setAudience("civicfix-web")
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  const database = await db.getDb();
  await database
    .delete(authSessions)
    .where(lt(authSessions.expiresAt, new Date()));
  await database
    .insert(authSessions)
    .values({ id, userId: user.id, expiresAt });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: 7 * 86400000,
  });
}
export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "civicfix",
      audience: "civicfix-web",
    });
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 && payload.jti
      ? { id: payload.jti, userId }
      : null;
  } catch {
    return null;
  }
}
export async function authenticateRequest(
  req: Request
): Promise<SessionUser | null> {
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  const database = await db.getDb();
  const stored = await database
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, session.id),
        eq(authSessions.userId, session.userId),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!stored[0]) return null;
  const user = await db.getUserById(session.userId);
  return user ? publicUser(user) : null;
}
export async function register(
  input: z.infer<typeof registerSchema>,
  req: Request,
  res: Response
) {
  if (await db.getUserByEmail(input.email))
    throw new TRPCError({
      code: "CONFLICT",
      message: "An account already exists for this email.",
    });
  const passwordHash = await bcrypt.hash(input.password, 12);
  let user: User;
  try {
    user = await db.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: isBootstrapAdmin(input.email) ? "admin" : "user",
    });
  } catch (error) {
    const failure = error as { code?: string; cause?: { code?: string } };
    if (
      failure.code === "ER_DUP_ENTRY" ||
      failure.cause?.code === "ER_DUP_ENTRY"
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account already exists for this email.",
      });
    throw error;
  }
  const safe = publicUser(user);
  await createSession(safe, req, res);
  return safe;
}
const dummyHash = bcrypt.hashSync("unused-login-timing-password", 12);
export async function login(
  input: z.infer<typeof loginSchema>,
  req: Request,
  res: Response
) {
  const user = await db.getUserByEmail(input.email);
  const matches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyHash
  );
  if (!user?.passwordHash || !matches)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    });
  const role = isBootstrapAdmin(user.email) ? "admin" : user.role;
  await db.recordSignIn(user.id, role);
  const safe = publicUser({ ...user, role, lastSignedIn: new Date() });
  await createSession(safe, req, res);
  return safe;
}
export async function logout(req: Request, res: Response) {
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  const session = token ? await verifySession(token) : null;
  if (session) {
    const database = await db.getDb();
    await database.delete(authSessions).where(eq(authSessions.id, session.id));
  }
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
  return { success: true } as const;
}
