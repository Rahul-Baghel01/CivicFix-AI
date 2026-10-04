import { describe, expect, it } from "vitest";
import {
  formatReportId,
  nextStatus,
  REPORT_STATUSES,
  severityRank,
} from "../shared/civic.js";
import { DEMO_REPORTS, type CivicReport } from "../shared/civic.js";
import {
  analyzeCivicIssue,
  verifyResolution,
} from "./services/ai/civicIssueAnalyzer.js";
import { findPossibleDuplicates } from "./civicDb.js";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";

describe("CivicFix workflow rules", () => {
  it("formats public report identifiers using the required pattern", () => {
    expect(formatReportId(new Date("2026-08-21T00:00:00.000Z"), 1284)).toBe(
      "CIV-2026-08-001284"
    );
  });

  it("preserves the required status pipeline", () => {
    expect(REPORT_STATUSES).toEqual([
      "Submitted",
      "Under Review",
      "Assigned",
      "In Progress",
      "Resolved",
    ]);
    expect(nextStatus("Assigned")).toBe("In Progress");
    expect(nextStatus("Resolved")).toBeNull();
  });

  it("orders severity levels consistently", () => {
    expect(severityRank("CRITICAL")).toBeGreaterThan(severityRank("HIGH"));
  });

  it("provides strict structured fallback analysis when vision is unavailable", async () => {
    const result = await analyzeCivicIssue(
      "not-a-valid-image-data-url",
      "pothole"
    );
    expect(result.issueType).toBe("Pothole");
    expect(result.severity).toBe("HIGH");
    expect(result).toHaveProperty("recommendedDepartment");
  });

  it("finds nearby unresolved reports of the same category", () => {
    const reports = DEMO_REPORTS.map((report, index) => ({
      ...report,
      id: index + 1,
      updatedAt: report.createdAt,
      isDemo: true,
    })) as CivicReport[];
    const matches = findPossibleDuplicates(reports, {
      latitude: 26.4817,
      longitude: 80.3154,
      issueType: "Pothole",
    });
    expect(
      matches.some(report => report.reportId === "CIV-2026-08-000124")
    ).toBe(true);
  });

  it("rejects authority procedures for citizen accounts", async () => {
    const ctx = {
      user: {
        id: 41,
        email: "citizen@example.com",
        name: "Citizen",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: {},
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.authority.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("recommends manual review when an original image is unavailable for resolution verification", async () => {
    const result = await verifyResolution(
      null,
      "data:image/jpeg;base64,not-a-real-image"
    );
    expect(result.issueAppearsResolved).toBe(false);
    expect(result.explanation).toMatch(
      /supervisor should complete a visual review/i
    );
  });
});
