import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as civicDb from "./civicDb";
import type { TrpcContext } from "./_core/context";
vi.mock("./civicDb", async importOriginal => ({
  ...(await importOriginal<typeof import("./civicDb")>()),
  createReport: vi.fn(),
  listReports: vi.fn(),
  getReportByPublicId: vi.fn(),
  getReportByEvidenceKey: vi.fn().mockResolvedValue(null),
  listEvents: vi.fn(),
  updateAuthorityReport: vi.fn(),
  resolveReport: vi.fn(),
}));
function context(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 7,
          name: "Citizen",
          email: "citizen@example.com",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { headers: {} },
    res: {},
  } as TrpcContext;
}
const input = {
  issueType: "Pothole" as const,
  category: "Road Infrastructure",
  description: "A large pothole creates danger near the market.",
  imageUrl: null,
  imageKey: null,
  location: {
    latitude: 26.4817,
    longitude: 80.3154,
    address: "Civil Lines, Kanpur",
  },
  severity: "HIGH" as const,
  confidence: 0.8,
  potentialRisk: "Accident risk to cyclists",
  priority: "HIGH" as const,
  department: "Roads & Infrastructure" as const,
};
beforeEach(() => vi.clearAllMocks());
describe("civic workflow API", () => {
  it("binds creation to the authenticated numeric user ID and preserves structured fields", async () => {
    vi.mocked(civicDb.createReport).mockResolvedValue({
      reportId: "CIV-2026-09-000001",
    } as Awaited<ReturnType<typeof civicDb.createReport>>);
    expect(
      await appRouter.createCaller(context("user")).civic.create(input)
    ).toMatchObject({ reportId: "CIV-2026-09-000001" });
    expect(civicDb.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        latitude: "26.481700",
        severity: "HIGH",
        department: input.department,
        status: "Submitted",
      })
    );
  });
  it("rejects invalid coordinates and anonymous submission", async () => {
    await expect(
      appRouter.createCaller(context("user")).civic.create({
        ...input,
        location: { ...input.location, latitude: 100 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      appRouter.createCaller(context(null)).civic.create(input)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(civicDb.createReport).not.toHaveBeenCalled();
  });
  it("rejects external evidence URLs and non-original storage namespaces", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(
      caller.civic.create({
        ...input,
        imageUrl: "https://example.com/arbitrary.jpg",
      })
    ).rejects.toThrow(/stored image key/);
    await expect(
      caller.civic.create({
        ...input,
        imageKey: "civicfix/resolutions/7/photo.jpg",
      })
    ).rejects.toThrow(/Invalid original/);
    expect(civicDb.createReport).not.toHaveBeenCalled();
  });
  it("tracks reports with their event timeline", async () => {
    vi.mocked(civicDb.getReportByPublicId).mockResolvedValue({
      id: 19,
      reportId: "CIV-2026-09-000001",
    } as Awaited<ReturnType<typeof civicDb.getReportByPublicId>>);
    vi.mocked(civicDb.listEvents).mockResolvedValue([
      { title: "Assigned" },
    ] as Awaited<ReturnType<typeof civicDb.listEvents>>);
    const result = await appRouter
      .createCaller(context(null))
      .civic.track({ reportId: "CIV-2026-09-000001" });
    expect(result?.events[0].title).toBe("Assigned");
    expect(civicDb.listEvents).toHaveBeenCalledWith(19);
  });
  it("routes admin assignment and operational notes with the acting officer identity", async () => {
    await appRouter.createCaller(context("admin")).authority.update({
      reportId: "CIV-2026-09-000001",
      status: "Assigned",
      department: input.department,
      assignedOfficer: "Road crew",
      note: "Inspect today",
    });
    expect(civicDb.updateAuthorityReport).toHaveBeenCalledWith(
      "CIV-2026-09-000001",
      expect.objectContaining({
        assignedByUserId: 7,
        assignedOfficer: "Road crew",
        note: "Inspect today",
      })
    );
  });
  it("records manual review when the authority closes a report without evidence", async () => {
    vi.mocked(civicDb.getReportByPublicId).mockResolvedValue({
      id: 19,
      reportId: "CIV-2026-09-000001",
    } as Awaited<ReturnType<typeof civicDb.getReportByPublicId>>);
    await appRouter.createCaller(context("admin")).authority.resolve({
      reportId: "CIV-2026-09-000001",
      resolutionNote: "Road repair completed.",
    });
    expect(civicDb.resolveReport).toHaveBeenCalledWith(
      "CIV-2026-09-000001",
      expect.objectContaining({
        verificationScore: 0,
        verificationExplanation: expect.stringMatching(/human review/),
      })
    );
  });
  it("rejects evidence belonging to another authority account", async () => {
    vi.mocked(civicDb.getReportByPublicId).mockResolvedValue({
      id: 19,
    } as Awaited<ReturnType<typeof civicDb.getReportByPublicId>>);
    await expect(
      appRouter.createCaller(context("admin")).authority.resolve({
        reportId: "CIV-2026-09-000001",
        resolutionNote: "Road repair completed.",
        resolutionImageUrl: "/uploads/civicfix/resolutions/8/photo.jpg",
        resolutionImageKey: "civicfix/resolutions/8/photo.jpg",
      })
    ).rejects.toThrow(/not authorized/);
    expect(civicDb.resolveReport).not.toHaveBeenCalled();
  });
});
