import type { Express } from "express";
import express from "express";
import { authenticateRequest } from "../services/auth";
import {
  normalizeKey,
  storageGetSignedUrl,
  storagePut,
  storagePutPrepared,
  storageValidate,
} from "../storage";
import { getReportByEvidenceKey } from "../civicDb";
import { canViewReportEvidence } from "../services/evidenceAccess";
export function registerStorageRoutes(app: Express) {
  app.get("/uploads/*", async (req, res) => {
    res.set({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    try {
      const user = await authenticateRequest(req);
      if (!user)
        return res.status(401).json({ error: "Sign in to view evidence." });
      const key = normalizeKey((req.params as Record<string, string>)[0]);
      const report = await getReportByEvidenceKey(key);
      if (!report || !canViewReportEvidence(report, user))
        return res.status(404).json({ error: "Evidence image not found." });
      if (process.env.STORAGE_DRIVER === "s3")
        return res.redirect(302, await storageGetSignedUrl(key));
      const { bytes, mime } = await storageValidate(key);
      res
        .set({
          "Content-Type": mime,
          "X-Content-Type-Options": "nosniff",
        })
        .send(bytes);
    } catch {
      res.status(404).json({ error: "Evidence image not found." });
    }
  });
  app.post(
    "/api/authority/resolution-upload",
    express.raw({ type: "application/octet-stream", limit: "5mb" }),
    async (req, res) => {
      try {
        const user = await authenticateRequest(req);
        if (!user || user.role !== "admin")
          return res
            .status(403)
            .json({ error: "Authority access is required." });
        const type = req.header("x-civicfix-image-type") ?? "";
        if (!["image/jpeg", "image/png", "image/webp"].includes(type))
          return res
            .status(415)
            .json({ error: "Upload a JPG, PNG, or WebP image." });
        if (!Buffer.isBuffer(req.body))
          return res.status(400).json({ error: "An image is required." });
        const extension =
          type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const ticket = req.query.ticket;
        const stored =
          typeof ticket === "string"
            ? await storagePutPrepared(ticket, user.id, req.body, type)
            : await storagePut(
                `civicfix/resolutions/${user.id}/${Date.now()}.${extension}`,
                req.body,
                type
              );
        return res.status(201).json(stored);
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Resolution upload failed.",
        });
      }
    }
  );
}
