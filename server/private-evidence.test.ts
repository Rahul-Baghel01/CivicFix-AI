import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { registerStorageRoutes } from "./_core/storageRoutes.js";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";
import type { CivicReport } from "../shared/civic.js";
import * as civicDb from "./civicDb.js";
import { authenticateRequest } from "./services/auth.js";
import * as storage from "./storage.js";
import {
  analyzeCivicIssue,
  getFallback,
  verifyResolution,
} from "./services/ai/civicIssueAnalyzer.js";

vi.mock("./civicDb.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./civicDb.js")>()),
  getReportByEvidenceKey: vi.fn(),
  getReportByPublicId: vi.fn(),
  listReports: vi.fn(),
  listReportsForUser: vi.fn(),
  listEvents: vi.fn(),
  createReport: vi.fn(),
  resolveReport: vi.fn(),
}));
vi.mock("./services/auth.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./services/auth.js")>()),
  authenticateRequest: vi.fn(),
}));
vi.mock("./storage.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./storage.js")>()),
  storageGetSignedUrl: vi.fn(),
  storageValidate: vi.fn(),
  storagePut: vi.fn(),
}));
vi.mock("./services/ai/civicIssueAnalyzer.js", async importOriginal => ({
  ...(await importOriginal<
    typeof import("./services/ai/civicIssueAnalyzer.js")
  >()),
  analyzeCivicIssue: vi.fn(),
  verifyResolution: vi.fn(),
}));

function context(
  id: number | null,
  role: "user" | "admin" = "user"
): TrpcContext {
  return {
    user: id === null ? null : { id, role },
    req: { headers: {} },
    res: {},
  } as TrpcContext;
}
const original = "civicfix/originals/private.png";
const resolution = "civicfix/resolutions/9/private.png";
const report = {
  id: 19,
  userId: 7,
  reportId: "CIV-2026-09-000001",
  issueType: "Pothole",
  category: "Road Infrastructure",
  severity: "HIGH",
  status: "Submitted",
  latitude: 26,
  longitude: 80,
  createdAt: "2026-09-01T00:00:00Z",
  imageKey: original,
  resolutionImageKey: resolution,
  imageUrl: "https://old-public.example/private.png",
  resolutionImageUrl: "https://old-public.example/after.png",
} as CivicReport;
const signedUrl =
  "https://audit-project.storage.supabase.co/storage/v1/s3/civicfix-evidence/private.png?signature=dummy";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=",
  "base64"
);
const app = express();
registerStorageRoutes(app);
const server = createServer(app);
let base: string;

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STORAGE_DRIVER", "s3");
  vi.stubEnv("JWT_SECRET", "test-secret-at-least-thirty-two-characters-long");
  vi.mocked(authenticateRequest).mockResolvedValue(context(7).user);
  vi.mocked(civicDb.getReportByEvidenceKey).mockResolvedValue(report);
  vi.mocked(civicDb.getReportByPublicId).mockResolvedValue(report);
  vi.mocked(civicDb.listReports).mockResolvedValue([report]);
  vi.mocked(civicDb.listReportsForUser).mockResolvedValue([report]);
  vi.mocked(civicDb.listEvents).mockResolvedValue([]);
  vi.mocked(civicDb.createReport).mockResolvedValue(report);
  vi.mocked(civicDb.resolveReport).mockResolvedValue(report);
  vi.mocked(storage.storageGetSignedUrl).mockResolvedValue(signedUrl);
  vi.mocked(storage.storageValidate).mockResolvedValue({
    bytes: png,
    mime: "image/png",
  });
  vi.mocked(storage.storagePut).mockResolvedValue({
    key: original,
    url: `/uploads/${original}`,
  });
  vi.mocked(analyzeCivicIssue).mockResolvedValue(getFallback("Pothole"));
  vi.mocked(verifyResolution).mockResolvedValue({
    verificationScore: 90,
    issueAppearsResolved: true,
    explanation: "Repair verified.",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("authorized private evidence delivery", () => {
  it.each(["GET", "HEAD"])(
    "denies anonymous %s requests before object lookup",
    async method => {
      vi.mocked(authenticateRequest).mockResolvedValue(null);
      const response = await fetch(`${base}/uploads/${original}`, {
        method,
        redirect: "manual",
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(civicDb.getReportByEvidenceKey).not.toHaveBeenCalled();
      expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
      expect(storage.storageValidate).not.toHaveBeenCalled();
    }
  );
  it("denies other citizens without signing or reading evidence", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(context(8).user);
    const response = await fetch(`${base}/uploads/${original}`, {
      redirect: "manual",
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
    expect(storage.storageValidate).not.toHaveBeenCalled();
  });
  it.each([
    [7, "user"],
    [9, "admin"],
  ] as const)(
    "redirects authorized account %s to S3 without proxying bytes",
    async (id, role) => {
      vi.mocked(authenticateRequest).mockResolvedValue(context(id, role).user);
      const response = await fetch(`${base}/uploads/${resolution}`, {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(signedUrl);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(storage.storageGetSignedUrl).toHaveBeenCalledWith(resolution);
      expect(storage.storageValidate).not.toHaveBeenCalled();
    }
  );
  it("denies unlinked keys even for admins", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(context(9, "admin").user);
    vi.mocked(civicDb.getReportByEvidenceKey).mockResolvedValue(null);
    expect(
      (await fetch(`${base}/uploads/${original}`, { redirect: "manual" }))
        .status
    ).toBe(404);
    expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
  });
  it("serves local files only after the same owner check", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    const response = await fetch(`${base}/uploads/${original}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
  });
});

describe("private evidence in civic workflows", () => {
  it.each([null, 8])(
    "redacts keys and old public URLs from public queries for viewer %s",
    async id => {
      const caller = appRouter.createCaller(context(id));
      const dashboard = await caller.civic.dashboard();
      const track = await caller.civic.track({ reportId: report.reportId });
      const duplicates = await caller.civic.duplicateCheck({
        latitude: 26,
        longitude: 80,
        issueType: "Pothole",
      });
      for (const item of [dashboard.reports[0], track!.report, duplicates[0]]) {
        expect(item).toMatchObject({
          reportId: report.reportId,
          imageUrl: null,
          imageKey: null,
          resolutionImageUrl: null,
          resolutionImageKey: null,
        });
      }
      expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
    }
  );
  it("gives owners and authorities stable authenticated image URLs", async () => {
    const own = await appRouter.createCaller(context(7)).civic.mine();
    const authority = await appRouter
      .createCaller(context(9, "admin"))
      .authority.list();
    for (const item of [own[0], authority[0]]) {
      expect(item.imageUrl).toBe(`/uploads/${original}`);
      expect(item.resolutionImageUrl).toBe(`/uploads/${resolution}`);
    }
  });
  it("does not read an arbitrary private key using an invalid receipt", async () => {
    await expect(
      appRouter
        .createCaller(context(null))
        .civic.analyzeUpload({ imageKey: original, evidenceToken: "forged" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storage.storageValidate).not.toHaveBeenCalled();
    expect(storage.storageGetSignedUrl).not.toHaveBeenCalled();
    expect(analyzeCivicIssue).not.toHaveBeenCalled();
  });
  it("issues a matching receipt with the real browser PUT signature", async () => {
    vi.stubEnv("S3_BUCKET", "civicfix-evidence");
    vi.stubEnv("S3_REGION", "ap-northeast-1");
    vi.stubEnv(
      "S3_ENDPOINT",
      "https://audit-project.storage.supabase.co/storage/v1/s3"
    );
    vi.stubEnv("S3_ACCESS_KEY_ID", "dummy-test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "dummy-test-secret");
    vi.stubEnv("AWS_REQUEST_CHECKSUM_CALCULATION", "WHEN_REQUIRED");
    const upload = await appRouter
      .createCaller(context(null))
      .civic.prepareUpload({
        contentType: "image/png",
        contentLength: png.length,
      });
    expect(upload.method).toBe("PUT");
    if (upload.method !== "PUT") throw new Error("Expected direct S3 upload.");
    const url = new URL(upload.uploadUrl);
    expect(url.pathname).toBe(`/storage/v1/s3/civicfix-evidence/${upload.key}`);
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    await expect(
      storage.storageVerifyUploadReceipt(upload.key, upload.evidenceToken)
    ).resolves.toBeUndefined();
  });
  it("preserves pre-login direct upload analysis with a valid scoped receipt", async () => {
    vi.mocked(civicDb.getReportByEvidenceKey).mockResolvedValue(null);
    const evidenceToken = await storage.storageCreateUploadReceipt(original);
    const result = await appRouter
      .createCaller(context(null))
      .civic.analyzeUpload({
        imageKey: original,
        evidenceToken,
        hint: "Pothole",
      });
    expect(storage.storageValidate).toHaveBeenCalledWith(original);
    expect(analyzeCivicIssue).toHaveBeenCalledWith(signedUrl, "Pothole");
    expect(result).toMatchObject({ imageKey: original, evidenceToken });
  });
  it("blocks receipts for evidence already attached to another citizen", async () => {
    const evidenceToken = await storage.storageCreateUploadReceipt(original);
    await expect(
      appRouter
        .createCaller(context(8))
        .civic.analyzeUpload({ imageKey: original, evidenceToken })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storage.storageValidate).not.toHaveBeenCalled();
  });
  it("issues a receipt for local inline analysis without requiring sign-in", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    const result = await appRouter
      .createCaller(context(null))
      .civic.analyzeUpload({
        imageDataUrl: `data:image/png;base64,${png.toString("base64")}`,
        hint: "Pothole",
      });
    await expect(
      storage.storageVerifyUploadReceipt(result.imageKey, result.evidenceToken)
    ).resolves.toBeUndefined();
    expect(analyzeCivicIssue).toHaveBeenCalledWith(
      `data:image/png;base64,${png.toString("base64")}`,
      "Pothole"
    );
  });
  it("requires an upload receipt at report submission", async () => {
    const input = {
      issueType: "Pothole" as const,
      category: "Road Infrastructure",
      description: "A large pothole creates danger near the market.",
      imageKey: original,
      imageUrl: `/uploads/${original}`,
      location: { latitude: 26, longitude: 80, address: "Market road" },
      severity: "HIGH" as const,
      confidence: 0.8,
      potentialRisk: "Accident risk",
      priority: "HIGH" as const,
      department: "Roads & Infrastructure" as const,
    };
    const caller = appRouter.createCaller(context(7));
    await expect(caller.civic.create(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(civicDb.createReport).not.toHaveBeenCalled();
    vi.mocked(civicDb.getReportByEvidenceKey).mockResolvedValue(null);
    const evidenceToken = await storage.storageCreateUploadReceipt(original);
    await caller.civic.create({ ...input, evidenceToken });
    expect(civicDb.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        imageKey: original,
        imageUrl: `/uploads/${original}`,
      })
    );
    expect(civicDb.createReport).toHaveBeenCalledWith(
      expect.not.objectContaining({ evidenceToken })
    );
  });
  it("passes signed private before/after URLs to authority verification", async () => {
    vi.mocked(storage.storageGetSignedUrl).mockImplementation(
      async key => `${signedUrl}&key=${key}`
    );
    await appRouter
      .createCaller(context(9, "admin"))
      .authority.resolve({
        reportId: report.reportId,
        resolutionNote: "Road repair completed.",
        resolutionImageKey: resolution,
        resolutionImageUrl: `/uploads/${resolution}`,
      });
    expect(verifyResolution).toHaveBeenCalledWith(
      `${signedUrl}&key=${original}`,
      `${signedUrl}&key=${resolution}`
    );
  });
});
