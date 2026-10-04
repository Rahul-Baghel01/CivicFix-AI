import { z } from "zod";
import {
  CIVIC_ISSUES,
  DEPARTMENTS,
  PRIORITIES,
  SEVERITIES,
  type CivicIssue,
} from "../../../shared/civic.js";
import { requestStructuredVision } from "./provider.js";

export const analysisSchema = z
  .object({
    issueType: z.enum(CIVIC_ISSUES),
    category: z.string().min(1).max(120),
    severity: z.enum(SEVERITIES),
    confidence: z.number().min(0).max(1),
    description: z.string().min(1).max(3000),
    potentialRisk: z.string().min(1).max(600),
    recommendedDepartment: z.enum(DEPARTMENTS),
    estimatedPriority: z.enum(PRIORITIES),
    isRelevant: z.boolean(),
    reason: z.string().min(1).max(1000),
  })
  .strict();
export type CivicAnalysis = z.infer<typeof analysisSchema>;
export const ISSUE_PROFILES: Record<
  CivicIssue,
  Omit<CivicAnalysis, "confidence" | "isRelevant" | "reason">
> = {
  Pothole: {
    issueType: "Pothole",
    category: "Road Infrastructure",
    severity: "HIGH",
    description:
      "A visible road-surface cavity appears to affect the normal driving line.",
    potentialRisk: "Potential accident risk for two-wheelers and vehicles.",
    recommendedDepartment: "Roads & Infrastructure",
    estimatedPriority: "HIGH",
  },
  "Broken streetlight": {
    issueType: "Broken streetlight",
    category: "Public Lighting",
    severity: "MEDIUM",
    description:
      "A streetlight appears non-functional or physically damaged near a public route.",
    potentialRisk: "Reduced nighttime visibility and pedestrian safety.",
    recommendedDepartment: "Electrical & Street Lighting",
    estimatedPriority: "MEDIUM",
  },
  "Garbage dumping": {
    issueType: "Garbage dumping",
    category: "Solid Waste",
    severity: "MEDIUM",
    description:
      "Waste appears to have accumulated in a public area outside an approved disposal point.",
    potentialRisk: "Sanitation issues, pests, and blocked pedestrian access.",
    recommendedDepartment: "Sanitation & Waste",
    estimatedPriority: "MEDIUM",
  },
  "Overflowing garbage bin": {
    issueType: "Overflowing garbage bin",
    category: "Solid Waste",
    severity: "MEDIUM",
    description:
      "A public bin appears to be over capacity with waste spilling into the surrounding area.",
    potentialRisk: "Public-health concern and obstruction of the walkway.",
    recommendedDepartment: "Sanitation & Waste",
    estimatedPriority: "MEDIUM",
  },
  "Water leakage": {
    issueType: "Water leakage",
    category: "Water Infrastructure",
    severity: "MEDIUM",
    description:
      "Water appears to be leaking from a civic supply line or roadside fixture.",
    potentialRisk:
      "Water loss, slippery surfaces, and gradual infrastructure damage.",
    recommendedDepartment: "Water Supply",
    estimatedPriority: "MEDIUM",
  },
  "Open manhole": {
    issueType: "Open manhole",
    category: "Public Safety",
    severity: "CRITICAL",
    description:
      "An uncovered or damaged manhole appears to create an immediate hazard in a public path.",
    potentialRisk:
      "Immediate fall hazard for pedestrians, cyclists, and vehicles.",
    recommendedDepartment: "Drainage & Sewerage",
    estimatedPriority: "URGENT",
  },
  "Damaged road": {
    issueType: "Damaged road",
    category: "Road Infrastructure",
    severity: "HIGH",
    description:
      "The road surface appears broadly broken or uneven across a usable section.",
    potentialRisk: "Vehicle instability and increased risk of road accidents.",
    recommendedDepartment: "Roads & Infrastructure",
    estimatedPriority: "HIGH",
  },
  "Blocked drainage": {
    issueType: "Blocked drainage",
    category: "Drainage",
    severity: "HIGH",
    description: "A drain inlet appears obstructed by debris or sediment.",
    potentialRisk: "Flooding and waterlogging during rainfall.",
    recommendedDepartment: "Drainage & Sewerage",
    estimatedPriority: "HIGH",
  },
  "Sewage problem": {
    issueType: "Sewage problem",
    category: "Drainage",
    severity: "CRITICAL",
    description:
      "Sewage appears to be overflowing or backing up in a public area.",
    potentialRisk: "Immediate sanitation and public-health exposure.",
    recommendedDepartment: "Drainage & Sewerage",
    estimatedPriority: "URGENT",
  },
  "Fallen tree": {
    issueType: "Fallen tree",
    category: "Urban Forestry",
    severity: "HIGH",
    description:
      "A fallen tree or large branch appears to obstruct a public route.",
    potentialRisk:
      "Blocked access, traffic obstruction, and potential utility damage.",
    recommendedDepartment: "Parks & Urban Forestry",
    estimatedPriority: "HIGH",
  },
  "Traffic signal problem": {
    issueType: "Traffic signal problem",
    category: "Traffic Safety",
    severity: "CRITICAL",
    description:
      "A traffic control signal appears non-functional or inconsistent at a public junction.",
    potentialRisk: "Conflicting traffic movement and collision risk.",
    recommendedDepartment: "Traffic Management",
    estimatedPriority: "URGENT",
  },
  "Illegal dumping": {
    issueType: "Illegal dumping",
    category: "Solid Waste",
    severity: "MEDIUM",
    description:
      "Materials appear to have been discarded in a public space without authorized collection.",
    potentialRisk: "Obstruction, pollution, and unsafe public conditions.",
    recommendedDepartment: "Sanitation & Waste",
    estimatedPriority: "MEDIUM",
  },
  "Public property damage": {
    issueType: "Public property damage",
    category: "Public Assets",
    severity: "MEDIUM",
    description: "A civic fixture appears broken or unsafe for public use.",
    potentialRisk:
      "Potential injury and reduced availability of public infrastructure.",
    recommendedDepartment: "Public Works",
    estimatedPriority: "MEDIUM",
  },
  Other: {
    issueType: "Other",
    category: "General Civic Issue",
    severity: "LOW",
    description:
      "The submitted image appears to show a civic condition that requires human review.",
    potentialRisk:
      "The public impact should be verified by the receiving department.",
    recommendedDepartment: "Public Works",
    estimatedPriority: "LOW",
  },
};

export function getFallback(hint?: string): CivicAnalysis {
  const matched =
    CIVIC_ISSUES.find(issue =>
      hint?.toLowerCase().includes(issue.toLowerCase())
    ) ?? "Other";
  const profile = ISSUE_PROFILES[matched];
  return analysisSchema.parse({
    ...profile,
    confidence: 0,
    isRelevant: true,
    description:
      matched === "Other"
        ? "Citizen-submitted civic condition requires municipal inspection."
        : `Citizen reports ${matched.toLowerCase()}; municipal inspection is required to confirm the condition.`,
    reason:
      "Automated image analysis is unavailable. This preliminary routing uses your issue hint, not verified visual evidence. Review and edit before submitting.",
  });
}
export async function analyzeCivicIssue(
  imageDataUrl: string,
  hint?: string
): Promise<CivicAnalysis> {
  if (
    !imageDataUrl.startsWith("data:image/") &&
    !imageDataUrl.startsWith("https://")
  )
    return getFallback(hint);
  try {
    return await requestStructuredVision(
      analysisSchema,
      "civic_issue_analysis",
      "You are CivicFix AI, a municipal image triage system. Assess only visible civic issues. Never invent location details. For unrelated images return isRelevant false, issueType Other, severity LOW, estimatedPriority LOW, recommendedDepartment Public Works. Return strict JSON.",
      "Classify this image, public safety severity, confidence, risk, department and priority.",
      [imageDataUrl]
    );
  } catch {
    return getFallback(hint);
  }
}
const verificationSchema = z
  .object({
    verificationScore: z.number().min(0).max(100),
    issueAppearsResolved: z.boolean(),
    explanation: z.string().min(1).max(2000),
  })
  .strict();
export async function verifyResolution(
  originalImageUrl: string | null,
  resolutionImageUrl: string
) {
  const manual = {
    verificationScore: 0,
    issueAppearsResolved: false,
    explanation:
      "Automated comparison is unavailable or evidence is incomplete. A supervisor should complete a visual review.",
  };
  if (!originalImageUrl || !resolutionImageUrl) return manual;
  try {
    const result = await requestStructuredVision(
      verificationSchema,
      "resolution_verification",
      "You are a careful municipal evidence reviewer. Compare before and after images of the same site. If evidence is unclear or the locations do not match, issueAppearsResolved must be false. Never guarantee completion. Return strict JSON.",
      "First image: original issue. Second image: proposed completion evidence.",
      [originalImageUrl, resolutionImageUrl]
    );
    return {
      ...result,
      verificationScore: result.issueAppearsResolved
        ? result.verificationScore
        : Math.min(result.verificationScore, 79),
      issueAppearsResolved:
        result.issueAppearsResolved && result.verificationScore >= 80,
    };
  } catch {
    return manual;
  }
}
