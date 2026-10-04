export const CIVIC_ISSUES = [
  "Pothole",
  "Broken streetlight",
  "Garbage dumping",
  "Overflowing garbage bin",
  "Water leakage",
  "Open manhole",
  "Damaged road",
  "Blocked drainage",
  "Sewage problem",
  "Fallen tree",
  "Traffic signal problem",
  "Illegal dumping",
  "Public property damage",
  "Other",
] as const;

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const REPORT_STATUSES = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"] as const;

export type CivicIssue = (typeof CIVIC_ISSUES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DEPARTMENTS = [
  "Roads & Infrastructure",
  "Sanitation & Waste",
  "Water Supply",
  "Drainage & Sewerage",
  "Electrical & Street Lighting",
  "Parks & Urban Forestry",
  "Traffic Management",
  "Public Works",
] as const;

export type CivicReport = {
  id: number;
  reportId: string;
  issueType: CivicIssue;
  category: string;
  description: string;
  imageUrl: string | null;
  imageKey?: string | null;
  latitude: number;
  longitude: number;
  address: string;
  severity: Severity;
  confidence: number;
  potentialRisk: string;
  priority: Priority;
  department: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  userId?: number | null;
  assignedOfficer?: string | null;
  resolutionNote?: string | null;
  resolutionImageUrl?: string | null;
  resolutionImageKey?: string | null;
  verificationScore?: number | null;
  verificationExplanation?: string | null;
  resolvedAt?: string | null;
};

type DemoSeed = Omit<CivicReport, "id" | "updatedAt" | "isDemo">;

export const DEMO_REPORTS: DemoSeed[] = [
  { reportId: "CIV-2026-08-000124", issueType: "Pothole", category: "Road Infrastructure", description: "Large pothole near the Civil Lines market approach, posing a serious risk to two-wheelers.", imageUrl: null, latitude: 26.4817, longitude: 80.3154, address: "Civil Lines, Kanpur, Uttar Pradesh", severity: "HIGH", confidence: 0.94, potentialRisk: "Potential accident risk for two-wheelers and vehicles.", priority: "URGENT", department: "Roads & Infrastructure", status: "In Progress", createdAt: "2026-08-21T05:02:00.000Z", assignedOfficer: "Road Maintenance Team" },
  { reportId: "CIV-2026-08-000118", issueType: "Overflowing garbage bin", category: "Solid Waste", description: "Public waste bin is overflowing onto the footpath near the metro entry.", imageUrl: null, latitude: 28.6129, longitude: 77.2295, address: "Connaught Place, New Delhi", severity: "MEDIUM", confidence: 0.91, potentialRisk: "Obstructed pedestrian access and sanitation concern.", priority: "MEDIUM", department: "Sanitation & Waste", status: "Assigned", createdAt: "2026-08-20T07:24:00.000Z", assignedOfficer: "Central Waste Zone" },
  { reportId: "CIV-2026-08-000117", issueType: "Water leakage", category: "Water Infrastructure", description: "Continuous water leakage from a roadside pipe is flooding the edge of the carriageway.", imageUrl: null, latitude: 19.076, longitude: 72.8777, address: "Andheri East, Mumbai, Maharashtra", severity: "HIGH", confidence: 0.89, potentialRisk: "Road surface damage and water loss.", priority: "HIGH", department: "Water Supply", status: "Under Review", createdAt: "2026-08-20T06:05:00.000Z" },
  { reportId: "CIV-2026-08-000116", issueType: "Open manhole", category: "Public Safety", description: "Uncovered manhole in an active pedestrian lane outside the bus stand.", imageUrl: null, latitude: 12.9716, longitude: 77.5946, address: "Majestic, Bengaluru, Karnataka", severity: "CRITICAL", confidence: 0.97, potentialRisk: "Immediate fall hazard for pedestrians and cyclists.", priority: "URGENT", department: "Drainage & Sewerage", status: "Assigned", createdAt: "2026-08-19T13:15:00.000Z", assignedOfficer: "Ward 95 Response Unit" },
  { reportId: "CIV-2026-08-000115", issueType: "Broken streetlight", category: "Public Lighting", description: "Streetlight is non-functional at a poorly lit junction after sunset.", imageUrl: null, latitude: 13.0827, longitude: 80.2707, address: "T. Nagar, Chennai, Tamil Nadu", severity: "MEDIUM", confidence: 0.88, potentialRisk: "Reduced visibility and pedestrian safety after dark.", priority: "MEDIUM", department: "Electrical & Street Lighting", status: "Submitted", createdAt: "2026-08-19T10:36:00.000Z" },
  { reportId: "CIV-2026-08-000114", issueType: "Blocked drainage", category: "Drainage", description: "Stormwater drain blocked by sediment and plastic waste before monsoon rain.", imageUrl: null, latitude: 22.5726, longitude: 88.3639, address: "Salt Lake, Kolkata, West Bengal", severity: "HIGH", confidence: 0.9, potentialRisk: "Local flooding during heavy rainfall.", priority: "HIGH", department: "Drainage & Sewerage", status: "In Progress", createdAt: "2026-08-19T08:14:00.000Z", assignedOfficer: "Drainage Rapid Team" },
  { reportId: "CIV-2026-08-000113", issueType: "Fallen tree", category: "Urban Forestry", description: "Fallen tree branch partially blocks one lane and covers a footpath.", imageUrl: null, latitude: 17.385, longitude: 78.4867, address: "Banjara Hills, Hyderabad, Telangana", severity: "HIGH", confidence: 0.93, potentialRisk: "Traffic obstruction and possible overhead-line damage.", priority: "HIGH", department: "Parks & Urban Forestry", status: "Resolved", createdAt: "2026-08-18T11:20:00.000Z", assignedOfficer: "Tree Response Cell", resolutionNote: "Fallen branches were safely removed and the footpath cleared.", verificationScore: 93, verificationExplanation: "Resolution view indicates that the reported obstruction has been removed." },
  { reportId: "CIV-2026-08-000112", issueType: "Traffic signal problem", category: "Traffic Safety", description: "Signal at the four-way junction remains stuck on red for one approach.", imageUrl: null, latitude: 18.5204, longitude: 73.8567, address: "Shivajinagar, Pune, Maharashtra", severity: "CRITICAL", confidence: 0.95, potentialRisk: "High risk of conflicting traffic movements at a busy junction.", priority: "URGENT", department: "Traffic Management", status: "Under Review", createdAt: "2026-08-18T08:10:00.000Z" },
  { reportId: "CIV-2026-08-000111", issueType: "Garbage dumping", category: "Solid Waste", description: "Repeated dumping of household waste beside the public park boundary.", imageUrl: null, latitude: 26.8467, longitude: 80.9462, address: "Gomti Nagar, Lucknow, Uttar Pradesh", severity: "MEDIUM", confidence: 0.87, potentialRisk: "Public health risk and pest attraction.", priority: "MEDIUM", department: "Sanitation & Waste", status: "Submitted", createdAt: "2026-08-17T15:44:00.000Z" },
  { reportId: "CIV-2026-08-000110", issueType: "Damaged road", category: "Road Infrastructure", description: "Road surface has broken along a 25-metre stretch near a school entrance.", imageUrl: null, latitude: 23.2599, longitude: 77.4126, address: "MP Nagar, Bhopal, Madhya Pradesh", severity: "HIGH", confidence: 0.92, potentialRisk: "Vehicle instability and school-zone safety risk.", priority: "HIGH", department: "Roads & Infrastructure", status: "Assigned", createdAt: "2026-08-17T11:06:00.000Z", assignedOfficer: "Zone 2 Roads Crew" },
  { reportId: "CIV-2026-08-000109", issueType: "Sewage problem", category: "Drainage", description: "Sewage water is backing up from a roadside chamber near residential buildings.", imageUrl: null, latitude: 28.7041, longitude: 77.1025, address: "Rohini, New Delhi", severity: "CRITICAL", confidence: 0.96, potentialRisk: "Serious sanitation and public-health exposure.", priority: "URGENT", department: "Drainage & Sewerage", status: "In Progress", createdAt: "2026-08-16T09:54:00.000Z", assignedOfficer: "Sewer Response Team" },
  { reportId: "CIV-2026-08-000108", issueType: "Public property damage", category: "Public Assets", description: "Damaged bus-shelter bench has sharp exposed metal edges.", imageUrl: null, latitude: 21.1458, longitude: 79.0882, address: "Dharampeth, Nagpur, Maharashtra", severity: "MEDIUM", confidence: 0.86, potentialRisk: "Potential injury to commuters.", priority: "MEDIUM", department: "Public Works", status: "Resolved", createdAt: "2026-08-16T06:21:00.000Z", assignedOfficer: "Asset Repair Team", resolutionNote: "The damaged bench was removed and a replacement is scheduled.", verificationScore: 91, verificationExplanation: "The hazardous exposed section is no longer visible in the resolution image." },
  { reportId: "CIV-2026-08-000107", issueType: "Illegal dumping", category: "Solid Waste", description: "Construction debris has been dumped on the service lane.", imageUrl: null, latitude: 30.7333, longitude: 76.7794, address: "Sector 17, Chandigarh", severity: "MEDIUM", confidence: 0.84, potentialRisk: "Blocked service access and dust pollution.", priority: "MEDIUM", department: "Sanitation & Waste", status: "Under Review", createdAt: "2026-08-15T14:18:00.000Z" },
  { reportId: "CIV-2026-08-000106", issueType: "Pothole", category: "Road Infrastructure", description: "Small but deep pothole near a residential street speed-breaker.", imageUrl: null, latitude: 25.5941, longitude: 85.1376, address: "Boring Road, Patna, Bihar", severity: "MEDIUM", confidence: 0.9, potentialRisk: "Cyclist and motorbike instability.", priority: "MEDIUM", department: "Roads & Infrastructure", status: "Resolved", createdAt: "2026-08-15T08:48:00.000Z", assignedOfficer: "Patna Road Repair Unit", resolutionNote: "Pothole filled and road surface sealed.", verificationScore: 96, verificationExplanation: "The repaired road surface appears continuous and no visible cavity remains." },
  { reportId: "CIV-2026-08-000105", issueType: "Water leakage", category: "Water Infrastructure", description: "Water is leaking continuously around a public tap valve.", imageUrl: null, latitude: 11.0168, longitude: 76.9558, address: "RS Puram, Coimbatore, Tamil Nadu", severity: "LOW", confidence: 0.82, potentialRisk: "Persistent water wastage.", priority: "LOW", department: "Water Supply", status: "Submitted", createdAt: "2026-08-14T12:32:00.000Z" },
  { reportId: "CIV-2026-08-000104", issueType: "Broken streetlight", category: "Public Lighting", description: "Two consecutive lamps are out on a pedestrian walkway.", imageUrl: null, latitude: 15.2993, longitude: 74.124, address: "Panjim, Goa", severity: "MEDIUM", confidence: 0.9, potentialRisk: "Reduced safety for pedestrians at night.", priority: "MEDIUM", department: "Electrical & Street Lighting", status: "Assigned", createdAt: "2026-08-14T09:30:00.000Z", assignedOfficer: "Lighting Team West" },
  { reportId: "CIV-2026-08-000103", issueType: "Open manhole", category: "Public Safety", description: "Broken cover leaves a manhole partially exposed beside a market lane.", imageUrl: null, latitude: 24.5854, longitude: 73.7125, address: "Hathipole, Udaipur, Rajasthan", severity: "HIGH", confidence: 0.94, potentialRisk: "Trip and fall hazard for pedestrians.", priority: "HIGH", department: "Drainage & Sewerage", status: "In Progress", createdAt: "2026-08-13T16:08:00.000Z", assignedOfficer: "Udaipur Safety Crew" },
  { reportId: "CIV-2026-08-000102", issueType: "Blocked drainage", category: "Drainage", description: "Drain cover is clogged with leaves and plastic on a low-lying road.", imageUrl: null, latitude: 22.7196, longitude: 75.8577, address: "Vijay Nagar, Indore, Madhya Pradesh", severity: "MEDIUM", confidence: 0.89, potentialRisk: "Water accumulation during rain.", priority: "MEDIUM", department: "Drainage & Sewerage", status: "Resolved", createdAt: "2026-08-13T08:47:00.000Z", assignedOfficer: "Indore Drain Care", resolutionNote: "Drain inlet was cleared and flow restored.", verificationScore: 94, verificationExplanation: "Resolution evidence shows the drain inlet is visibly clear." },
  { reportId: "CIV-2026-08-000101", issueType: "Fallen tree", category: "Urban Forestry", description: "A small fallen tree blocks access to a community play area.", imageUrl: null, latitude: 26.9124, longitude: 75.7873, address: "Malviya Nagar, Jaipur, Rajasthan", severity: "LOW", confidence: 0.85, potentialRisk: "Restricted access to public space.", priority: "LOW", department: "Parks & Urban Forestry", status: "Submitted", createdAt: "2026-08-12T12:15:00.000Z" },
  { reportId: "CIV-2026-08-000100", issueType: "Traffic signal problem", category: "Traffic Safety", description: "Pedestrian crossing signal does not illuminate at a school crossing.", imageUrl: null, latitude: 23.0225, longitude: 72.5714, address: "Navrangpura, Ahmedabad, Gujarat", severity: "HIGH", confidence: 0.92, potentialRisk: "Unsafe crossing conditions for schoolchildren.", priority: "HIGH", department: "Traffic Management", status: "Resolved", createdAt: "2026-08-12T07:03:00.000Z", assignedOfficer: "Traffic Signal Cell", resolutionNote: "Signal controller reset and pedestrian phase tested.", verificationScore: 89, verificationExplanation: "The signal is visibly operating in the submitted completion photo." },
];

export function formatReportId(date = new Date(), sequence?: number) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const serial = String(sequence ?? Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return `CIV-${year}-${month}-${serial.slice(-6)}`;
}

export function nextStatus(status: ReportStatus): ReportStatus | null {
  const index = REPORT_STATUSES.indexOf(status);
  return index === -1 || index === REPORT_STATUSES.length - 1 ? null : REPORT_STATUSES[index + 1];
}

export function severityRank(value: Severity) {
  return SEVERITIES.indexOf(value) + 1;
}
