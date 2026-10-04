import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SessionUser } from "../services/auth";
import { authenticateRequest } from "../services/auth";
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionUser | null;
};
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return { ...opts, user: await authenticateRequest(opts.req) };
}
