import type { RequestHandler } from "express";
export const sameOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.header("sec-fetch-site") === "cross-site")
    return res.status(403).json({ error: "Cross-site request denied." });
  const origin = req.header("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host"))
        return res.status(403).json({ error: "Cross-origin request denied." });
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }
  next();
};
