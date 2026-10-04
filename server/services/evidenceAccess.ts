import type { CivicReport } from "../../shared/civic";
import type { SessionUser } from "./auth";

export function canViewReportEvidence(
  report: CivicReport,
  user: SessionUser | null
) {
  return Boolean(user && (user.role === "admin" || report.userId === user.id));
}

export function reportForViewer(report: CivicReport, user: SessionUser | null) {
  const allowed = canViewReportEvidence(report, user);
  return {
    ...report,
    imageKey: allowed ? (report.imageKey ?? null) : null,
    imageUrl: allowed && report.imageKey ? `/uploads/${report.imageKey}` : null,
    resolutionImageKey: allowed ? (report.resolutionImageKey ?? null) : null,
    resolutionImageUrl:
      allowed && report.resolutionImageKey
        ? `/uploads/${report.resolutionImageKey}`
        : null,
  };
}
