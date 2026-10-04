import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import * as civicDb from "./civicDb";
import {
  CIVIC_ISSUES,
  DEPARTMENTS,
  PRIORITIES,
  REPORT_STATUSES,
  SEVERITIES,
} from "../shared/civic";
import {
  analyzeCivicIssue,
  verifyResolution,
} from "./services/ai/civicIssueAnalyzer";
import {
  storageGetSignedUrl,
  storagePut,
  storageCreatePresignedPut,
  storageCreateUploadReceipt,
  storageVerifyUploadReceipt,
} from "./storage";
import { storageGet, storageValidate } from "./storage";
import { decodeImage } from "./services/images";
import * as auth from "./services/auth";
import {
  canViewReportEvidence,
  reportForViewer,
} from "./services/evidenceAccess";

const dataUrl = z
  .string()
  .regex(
    /^data:image\/(jpeg|png|webp);base64,/,
    "Upload a JPG, PNG, or WebP image."
  )
  .max(7_000_000, "Images must be 5 MB or smaller.");
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(3).max(500),
});
const reportCreateSchema = z.object({
  issueType: z.enum(CIVIC_ISSUES),
  category: z.string().min(2).max(120),
  description: z.string().min(20).max(3000),
  imageUrl: z.string().max(1200).nullable(),
  imageKey: z.string().max(800).nullable(),
  evidenceToken: z.string().max(2048).optional(),
  location: locationSchema,
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
  potentialRisk: z.string().min(3).max(600),
  priority: z.enum(PRIORITIES),
  department: z.enum(DEPARTMENTS),
});

async function storeDataUrl(data: string, prefix: string) {
  const { mime, bytes } = decodeImage(data);
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw new Error("Images must be 5 MB or smaller.");
  const extension =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return storagePut(`${prefix}/${Date.now()}.${extension}`, bytes, mime);
}

async function authorizeOriginalEvidence(
  ctx: TrpcContext,
  key: string,
  token?: string
) {
  if (!key.startsWith("civicfix/originals/"))
    throw new Error("Invalid original evidence key.");
  try {
    if (!token) throw new Error("Missing receipt.");
    await storageVerifyUploadReceipt(key, token);
  } catch {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Evidence upload authorization expired or is invalid. Upload the photo again.",
    });
  }
  const report = await civicDb.getReportByEvidenceKey(key);
  if (report && !canViewReportEvidence(report, ctx.user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Evidence is not authorized for this account.",
    });
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(auth.registerSchema)
      .mutation(({ input, ctx }) => auth.register(input, ctx.req, ctx.res)),
    login: publicProcedure
      .input(auth.loginSchema)
      .mutation(({ input, ctx }) => auth.login(input, ctx.req, ctx.res)),
    logout: publicProcedure.mutation(({ ctx }) =>
      auth.logout(ctx.req, ctx.res)
    ),
  }),
  civic: router({
    dashboard: publicProcedure.query(async ({ ctx }) => {
      const reports = await civicDb.listReports();
      const byStatus = Object.fromEntries(
        REPORT_STATUSES.map(status => [
          status,
          reports.filter(report => report.status === status).length,
        ])
      );
      const unresolved = reports.filter(report => report.status !== "Resolved");
      const highRisk = unresolved.filter(
        report => report.severity === "HIGH" || report.severity === "CRITICAL"
      );
      const resolvedWithTiming = reports.filter(
        report => report.status === "Resolved" && report.resolvedAt
      );
      const averageResolutionDays = resolvedWithTiming.length
        ? Number(
            (
              resolvedWithTiming.reduce(
                (sum, report) =>
                  sum +
                  (new Date(report.resolvedAt!).getTime() -
                    new Date(report.createdAt).getTime()) /
                    86_400_000,
                0
              ) / resolvedWithTiming.length
            ).toFixed(1)
          )
        : 0;
      return {
        reports: reports.map(report => reportForViewer(report, ctx.user)),
        stats: {
          total: reports.length,
          resolved: byStatus.Resolved,
          inProgress: byStatus["In Progress"],
          highRisk: highRisk.length,
          averageResolutionDays,
        },
        insights: [
          {
            label: "Priority alert",
            value: `${highRisk.filter(report => report.issueType === "Pothole").length} high-risk potholes remain unresolved.`,
            tone: "critical",
          },
          {
            label: "Hotspot detection",
            value:
              "Garbage and drainage reports are concentrated around three active zones.",
            tone: "warm",
          },
          {
            label: "Recommended action",
            value:
              "Deploy a road maintenance team to Civil Lines and nearby Kanpur wards.",
            tone: "calm",
          },
        ],
      };
    }),
    analyzeUpload: publicProcedure
      .input(
        z.union([
          z.object({
            imageDataUrl: dataUrl,
            hint: z.string().max(120).optional(),
          }),
          z.object({
            imageKey: z.string().max(800),
            evidenceToken: z.string().max(2048),
            hint: z.string().max(120).optional(),
          }),
        ])
      )
      .mutation(async ({ input, ctx }) => {
        if ("imageKey" in input) {
          await authorizeOriginalEvidence(
            ctx,
            input.imageKey,
            input.evidenceToken
          );
          await storageValidate(input.imageKey);
          const imageUrl = await storageGetSignedUrl(input.imageKey);
          const analysis = await analyzeCivicIssue(imageUrl, input.hint);
          return {
            ...analysis,
            imageUrl: (await storageGet(input.imageKey)).url,
            imageKey: input.imageKey,
            evidenceToken: input.evidenceToken,
          };
        }
        const upload = await storeDataUrl(
          input.imageDataUrl,
          "civicfix/originals"
        );
        const analysis = await analyzeCivicIssue(
          input.imageDataUrl,
          input.hint
        );
        return {
          ...analysis,
          imageUrl: upload.url,
          imageKey: upload.key,
          evidenceToken: await storageCreateUploadReceipt(upload.key),
        };
      }),
    prepareUpload: publicProcedure
      .input(
        z.object({
          contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          contentLength: z
            .number()
            .int()
            .positive()
            .max(5 * 1024 * 1024),
        })
      )
      .mutation(async ({ input }) => {
        if (process.env.STORAGE_DRIVER !== "s3")
          return { method: "INLINE" as const };
        const extension =
          input.contentType === "image/png"
            ? "png"
            : input.contentType === "image/webp"
              ? "webp"
              : "jpg";
        const upload = await storageCreatePresignedPut(
          `civicfix/originals/${Date.now()}.${extension}`,
          input.contentType,
          input.contentLength
        );
        return {
          ...upload,
          evidenceToken: await storageCreateUploadReceipt(upload.key),
        };
      }),
    duplicateCheck: publicProcedure
      .input(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
          issueType: z.enum(CIVIC_ISSUES),
        })
      )
      .query(async ({ input, ctx }) => {
        const reports = await civicDb.listReports();
        return civicDb
          .findPossibleDuplicates(reports, input)
          .map(report => reportForViewer(report, ctx.user));
      }),
    track: publicProcedure
      .input(
        z.object({ reportId: z.string().regex(/^CIV-\d{4}-\d{2}-\d{6}$/) })
      )
      .query(async ({ input, ctx }) => {
        const report = await civicDb.getReportByPublicId(input.reportId);
        if (!report) return null;
        const events = await civicDb.listEvents(report.id);
        return { report: reportForViewer(report, ctx.user), events };
      }),
    create: protectedProcedure
      .input(reportCreateSchema)
      .mutation(async ({ ctx, input }) => {
        if (input.imageKey) {
          await authorizeOriginalEvidence(
            ctx,
            input.imageKey,
            input.evidenceToken
          );
          await storageValidate(input.imageKey);
          input.imageUrl = (await storageGet(input.imageKey)).url;
        } else if (input.imageUrl)
          throw new Error("Original evidence requires a stored image key.");
        const report = await civicDb.createReport({
          userId: ctx.user.id,
          issueType: input.issueType,
          category: input.category,
          description: input.description,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          latitude: input.location.latitude.toFixed(6),
          longitude: input.location.longitude.toFixed(6),
          address: input.location.address,
          severity: input.severity,
          confidence: input.confidence.toFixed(3),
          potentialRisk: input.potentialRisk,
          priority: input.priority,
          department: input.department,
          assignedOfficer: null,
          status: "Submitted",
          resolutionNote: null,
          resolutionImageUrl: null,
          resolutionImageKey: null,
          verificationScore: null,
          verificationExplanation: null,
          resolvedAt: null,
        });
        return reportForViewer(report, ctx.user);
      }),
    mine: protectedProcedure.query(async ({ ctx }) =>
      (await civicDb.listReportsForUser(ctx.user.id)).map(report =>
        reportForViewer(report, ctx.user)
      )
    ),
    notifications: protectedProcedure.query(async ({ ctx }) =>
      civicDb.listNotificationsForUser(ctx.user.id)
    ),
    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({
        success: await civicDb.markNotificationRead(
          ctx.user.id,
          input.notificationId
        ),
      })),
    impact: protectedProcedure.query(async ({ ctx }) =>
      civicDb.getCommunityImpact(ctx.user.id)
    ),
  }),
  authority: router({
    list: adminProcedure.query(async ({ ctx }) =>
      (await civicDb.listReports()).map(report =>
        reportForViewer(report, ctx.user)
      )
    ),
    prepareResolutionUpload: adminProcedure
      .input(
        z.object({
          contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          contentLength: z
            .number()
            .int()
            .positive()
            .max(5 * 1024 * 1024),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const extension =
          input.contentType === "image/png"
            ? "png"
            : input.contentType === "image/webp"
              ? "webp"
              : "jpg";
        return storageCreatePresignedPut(
          `civicfix/resolutions/${ctx.user.id}/${Date.now()}.${extension}`,
          input.contentType,
          input.contentLength
        );
      }),
    update: adminProcedure
      .input(
        z.object({
          reportId: z.string(),
          status: z.enum(REPORT_STATUSES).refine(value => value !== "Resolved"),
          priority: z.enum(PRIORITIES).optional(),
          department: z.enum(DEPARTMENTS).optional(),
          assignedOfficer: z.string().max(120).optional(),
          note: z.string().max(600).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const report = await civicDb.updateAuthorityReport(input.reportId, {
          ...input,
          assignedByUserId: ctx.user.id,
        });
        return report ? reportForViewer(report, ctx.user) : null;
      }),
    resolve: adminProcedure
      .input(
        z
          .object({
            reportId: z.string(),
            resolutionNote: z.string().min(10).max(2000),
            resolutionImageUrl: z.string().max(1200).optional(),
            resolutionImageKey: z.string().max(800).optional(),
          })
          .refine(
            input =>
              Boolean(input.resolutionImageUrl) ===
              Boolean(input.resolutionImageKey),
            "Resolution evidence needs both its stored key and URL."
          )
      )
      .mutation(async ({ ctx, input }) => {
        const report = await civicDb.getReportByPublicId(input.reportId);
        if (!report) throw new Error("Report not found.");
        let verification = {
          verificationScore: 0,
          explanation:
            "No resolution image was supplied; human review is required.",
          issueAppearsResolved: false,
        };
        if (input.resolutionImageUrl) {
          if (
            !input.resolutionImageKey?.startsWith(
              `civicfix/resolutions/${ctx.user.id}/`
            )
          )
            throw new Error(
              "Resolution evidence is not authorized for this authority account."
            );
          await storageValidate(input.resolutionImageKey);
          input.resolutionImageUrl = (
            await storageGet(input.resolutionImageKey)
          ).url;
          const originalImage = report.imageKey
            ? await storageGetSignedUrl(report.imageKey).catch(() => null)
            : null;
          const resolutionImage = await storageGetSignedUrl(
            input.resolutionImageKey
          );
          verification = await verifyResolution(originalImage, resolutionImage);
        }
        const resolved = await civicDb.resolveReport(input.reportId, {
          note: input.resolutionNote,
          imageUrl: input.resolutionImageUrl ?? null,
          imageKey: input.resolutionImageKey ?? null,
          verificationScore: verification.verificationScore,
          verificationExplanation: verification.explanation,
        });
        return resolved ? reportForViewer(resolved, ctx.user) : null;
      }),
  }),
});

export type AppRouter = typeof appRouter;
