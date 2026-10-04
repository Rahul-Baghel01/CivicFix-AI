import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { departments, reports, reportAssignments, reportEvents, notifications, type InsertReport, type Report } from "../drizzle/schema.js";
import { getDb } from "./db.js";
import { DEMO_REPORTS, formatReportId, REPORT_STATUSES, type CivicReport, type ReportStatus, type Severity } from "../shared/civic.js";

const DEPARTMENT_SEED = [
  ["Roads & Infrastructure", "Repairs roads, footpaths, and municipal transport infrastructure."],
  ["Sanitation & Waste", "Coordinates public waste collection, bins, and cleanliness response."],
  ["Water Supply", "Maintains public water lines, taps, and water distribution assets."],
  ["Drainage & Sewerage", "Responds to drainage, sewerage, manholes, and flooding complaints."],
  ["Electrical & Street Lighting", "Maintains municipal lighting and electrical street assets."],
  ["Parks & Urban Forestry", "Manages public parks, trees, and urban green spaces."],
  ["Traffic Management", "Coordinates traffic signals and safety controls."],
  ["Public Works", "Maintains general public property and civic assets."],
] as const;

function mapReport(report: Report): CivicReport {
  return {
    id: report.id,
    userId: report.userId,
    reportId: report.reportId,
    issueType: report.issueType as CivicReport["issueType"],
    category: report.category,
    description: report.description,
    imageUrl: report.imageUrl,
    imageKey: report.imageKey,
    latitude: Number(report.latitude),
    longitude: Number(report.longitude),
    address: report.address,
    severity: report.severity as Severity,
    confidence: Number(report.confidence),
    potentialRisk: report.potentialRisk,
    priority: report.priority as CivicReport["priority"],
    department: report.department,
    status: report.status as ReportStatus,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    isDemo: Boolean(report.isDemo),
    assignedOfficer: report.assignedOfficer,
    resolutionNote: report.resolutionNote,
    resolutionImageUrl: report.resolutionImageUrl,
    resolutionImageKey: report.resolutionImageKey,
    verificationScore: report.verificationScore === null ? null : Number(report.verificationScore),
    verificationExplanation: report.verificationExplanation,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
  };
}

export async function ensureDemoReports() {
  const db = await getDb();
  if (!db) return;
  await ensureDepartments();
  const existing = await db.select({ count: sql<number>`count(*)` }).from(reports).where(eq(reports.isDemo, 1));
  if (Number(existing[0]?.count ?? 0) > 0) {
    await db.update(reports).set({ resolvedAt: sql`DATE_ADD(\`createdAt\`, INTERVAL 48 HOUR)` }).where(and(eq(reports.isDemo, 1), eq(reports.status, "Resolved"), isNull(reports.resolvedAt)));
    return;
  }
  const createdAt = new Date("2026-08-12T07:03:00.000Z");
  const values: InsertReport[] = DEMO_REPORTS.map((item, index) => ({
    reportId: item.reportId,
    issueType: item.issueType,
    category: item.category,
    description: item.description,
    imageUrl: null,
    imageKey: null,
    latitude: item.latitude.toFixed(6),
    longitude: item.longitude.toFixed(6),
    address: item.address,
    severity: item.severity,
    confidence: item.confidence.toFixed(2),
    potentialRisk: item.potentialRisk,
    priority: item.priority,
    department: item.department,
    assignedOfficer: item.assignedOfficer ?? null,
    status: item.status,
    isDemo: 1,
    createdAt: new Date(createdAt.getTime() + index * 3_600_000),
    updatedAt: new Date(createdAt.getTime() + index * 3_600_000),
    resolutionNote: item.resolutionNote ?? null,
    verificationScore: item.verificationScore?.toFixed(0) ?? null,
    verificationExplanation: item.verificationExplanation ?? null,
    resolvedAt: item.status === "Resolved" ? new Date(new Date(item.createdAt).getTime() + 48 * 60 * 60 * 1000) : null,
  }));
  await db.insert(reports).values(values).onDuplicateKeyUpdate({ set: { reportId: sql`reportId` } });
}

export async function ensureDepartments() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ count: sql<number>`count(*)` }).from(departments);
  if (Number(existing[0]?.count ?? 0) > 0) return;
  await db.insert(departments).values(DEPARTMENT_SEED.map(([name, description]) => ({ name, description, isActive: 1 }))).onDuplicateKeyUpdate({ set: { name: sql`name` } });
}

export async function listReports(limit = 100) {
  const db = await getDb();
  if (!db) return DEMO_REPORTS.map((item, index) => ({ ...item, id: index + 1, updatedAt: item.createdAt, isDemo: true })) as CivicReport[];
  await ensureDemoReports();
  const rows = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(limit);
  return rows.map(mapReport);
}

export async function getReportByPublicId(reportId: string) {
  const db = await getDb();
  if (!db) return (await listReports()).find(report => report.reportId === reportId) ?? null;
  await ensureDemoReports();
  const rows = await db.select().from(reports).where(eq(reports.reportId, reportId)).limit(1);
  return rows[0] ? mapReport(rows[0]) : null;
}

export async function listReportsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(reports).where(eq(reports.userId, userId)).orderBy(desc(reports.createdAt));
  return rows.map(mapReport);
}

export async function getReportByEvidenceKey(key: string) {
  const db = await getDb();
  const rows = await db.select().from(reports)
    .where(or(eq(reports.imageKey, key), eq(reports.resolutionImageKey, key)))
    .limit(1);
  return rows[0] ? mapReport(rows[0]) : null;
}

export async function createReport(input: Omit<InsertReport, "reportId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Reporting is temporarily unavailable. Please try again shortly.");
  let reportId = formatReportId();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await db.select({ id: reports.id }).from(reports).where(eq(reports.reportId, reportId)).limit(1);
    if (!existing[0]) break;
    reportId = formatReportId(new Date(), Math.floor(Math.random() * 1_000_000));
  }
  await db.insert(reports).values({ ...input, reportId, isDemo: 0 });
  const result = await getReportByPublicId(reportId);
  if (!result) throw new Error("Report was created but could not be retrieved.");
  await addReportEvent(result.id, "Submitted", "Report submitted", "Your civic issue report was created and queued for review.");
  if (result.userId) await addNotification(result.userId, result.id, `Your report ${result.reportId} was received and is awaiting review.`, "submission");
  return result;
}

export async function addReportEvent(reportId: number, status: ReportStatus, title: string, details: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reportEvents).values({ reportId, status, title, details });
}

export async function listEvents(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportEvents).where(eq(reportEvents.reportId, reportId)).orderBy(desc(reportEvents.createdAt));
}

export async function updateAuthorityReport(reportId: string, update: { status: ReportStatus; priority?: CivicReport["priority"]; department?: string; assignedOfficer?: string; note?: string; assignedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Authority updates are temporarily unavailable.");
  const report = await getReportByPublicId(reportId);
  if (!report) throw new Error("Report not found.");
  const currentIndex = REPORT_STATUSES.indexOf(report.status);
  const requestedIndex = REPORT_STATUSES.indexOf(update.status);
  if (requestedIndex < currentIndex) throw new Error("Report status cannot move backwards.");
  if (update.status === "Resolved") throw new Error("Use the resolution workflow to close a report.");
  await db.update(reports).set({ status: update.status, priority: update.priority, department: update.department, assignedOfficer: update.assignedOfficer, updatedAt: new Date() }).where(eq(reports.reportId, reportId));
  if (update.department || update.assignedOfficer) {
    await ensureDepartments();
    const departmentName = update.department ?? report.department;
    const department = await db.select().from(departments).where(eq(departments.name, departmentName)).limit(1);
    if (department[0]) {
      await db.insert(reportAssignments).values({ reportId: report.id, departmentId: department[0].id, officerName: update.assignedOfficer ?? report.assignedOfficer ?? null, assignedByUserId: update.assignedByUserId, note: update.note ?? null });
    }
  }
  await addReportEvent(report.id, update.status, `Status changed to ${update.status}`, update.note || `Report routed to ${update.department ?? report.department}.`);
  if (report.userId) await addNotification(report.userId, report.id, `Your report ${report.reportId} is now ${update.status}.`, "status_update");
  return getReportByPublicId(reportId);
}

export async function resolveReport(reportId: string, resolution: { note: string; imageUrl: string | null; imageKey: string | null; verificationScore: number; verificationExplanation: string }) {
  const db = await getDb();
  if (!db) throw new Error("Resolution updates are temporarily unavailable.");
  const report = await getReportByPublicId(reportId);
  if (!report) throw new Error("Report not found.");
  await db.update(reports).set({ status: "Resolved", resolutionNote: resolution.note, resolutionImageUrl: resolution.imageUrl, resolutionImageKey: resolution.imageKey, verificationScore: resolution.verificationScore.toFixed(0), verificationExplanation: resolution.verificationExplanation, updatedAt: new Date(), resolvedAt: new Date() }).where(eq(reports.reportId, reportId));
  await addReportEvent(report.id, "Resolved", "Issue resolved", resolution.note);
  if (report.userId) await addNotification(report.userId, report.id, `Your report ${report.reportId} has been marked resolved.`, "resolution");
  return getReportByPublicId(reportId);
}

export async function listNotificationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function addNotification(userId: number, reportId: number, message: string, type = "status_update") {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({ userId, reportId, message, type, isRead: 0 });
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(notifications).set({ isRead: 1 }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return result[0]?.affectedRows === 1;
}

export async function getCommunityImpact(userId: number) {
  const ownReports = await listReportsForUser(userId);
  const resolved = ownReports.filter(report => report.status === "Resolved");
  const impactWeight: Record<Severity, number> = { LOW: 25, MEDIUM: 75, HIGH: 200, CRITICAL: 350 };
  const estimatedPeopleImpacted = resolved.reduce((total, report) => total + impactWeight[report.severity], 0);
  const resolvedWeight = resolved.reduce((total, report) => total + impactWeight[report.severity], 0);
  const submittedWeight = ownReports.reduce((total, report) => total + impactWeight[report.severity], 0);
  const neighbourhoodScore = submittedWeight ? Math.round((resolvedWeight / submittedWeight) * 100) : 0;
  return {
    reportsSubmitted: ownReports.length,
    issuesResolved: resolved.length,
    estimatedPeopleImpacted,
    neighbourhoodScore,
    methodology: "Estimated public impact weights each resolved report by its assessed safety severity; the neighbourhood score reflects the severity-weighted share of your reports that reached resolution.",
  };
}

export function findPossibleDuplicates(reportsToSearch: CivicReport[], input: { latitude: number; longitude: number; issueType: string }) {
  return reportsToSearch.filter(report => {
    const distanceMetres = Math.sqrt(Math.pow((report.latitude - input.latitude) * 111_000, 2) + Math.pow((report.longitude - input.longitude) * 103_000, 2));
    return distanceMetres <= 500 && report.issueType === input.issueType && report.status !== "Resolved";
  }).slice(0, 3);
}
