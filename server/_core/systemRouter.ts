import { publicProcedure, router } from "./trpc.js";
export const systemRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});
