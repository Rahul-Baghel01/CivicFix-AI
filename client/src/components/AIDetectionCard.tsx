import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, CircleHelp, ScanLine, ShieldAlert, Sparkles } from "lucide-react";

type Detection = {
  issueType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  potentialRisk: string;
  recommendedDepartment: string;
  estimatedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description: string;
  reason: string;
};

const severityStyles: Record<Detection["severity"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export function AIDetectionCard({ analysis }: { analysis: Detection }) {
  return <section className="overflow-hidden rounded-2xl border border-[#d3e4d6] bg-white shadow-[0_12px_30px_rgba(21,62,53,.08)]">
    <div className="relative overflow-hidden bg-[#153e35] p-5 text-white"><div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#d8ff76]/15 blur-2xl" /><div className="relative flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d8ff76] text-[#153e35]"><ScanLine size={19} /></span><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d8ff76]">AI Detection</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.03em]">{analysis.issueType} detected</h2></div></div><Badge className={`border-0 ${severityStyles[analysis.severity]}`}>{analysis.severity} severity</Badge></div><p className="relative mt-4 max-w-xl text-sm leading-6 text-[#d6e6dd]">{analysis.description}</p></div>
    <div className="p-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#eff7f0] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#6f897d]">Confidence</p><p className="mt-1 text-2xl font-semibold text-[#153e35]">{Math.round(analysis.confidence * 100)}%</p></div><div className="rounded-xl bg-[#fff5e9] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#97713e]">Priority</p><p className="mt-1 text-lg font-semibold text-[#8c5217]">{analysis.estimatedPriority}</p></div><div className="rounded-xl bg-[#eef4ff] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#637ea5]">Classification</p><p className="mt-1 text-sm font-semibold text-[#264e83]">Civic issue</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="flex gap-3 rounded-xl border border-[#f0ddd2] bg-[#fff8f4] p-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#e66a40]" /><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#aa5a38]">Potential risk</p><p className="mt-1 text-sm leading-5 text-[#754d3b]">{analysis.potentialRisk}</p></div></div><div className="flex gap-3 rounded-xl border border-[#d9e7dc] bg-[#f6fbf7] p-3"><Building2 size={18} className="mt-0.5 shrink-0 text-[#2f6e52]" /><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#527565]">Route to</p><p className="mt-1 text-sm font-semibold leading-5 text-[#204d3a]">{analysis.recommendedDepartment}</p></div></div></div>
      <div className="mt-4 flex gap-3 rounded-xl bg-[#eef4ef] p-3"><CircleHelp size={18} className="mt-0.5 shrink-0 text-[#2c654d]" /><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#2c654d]">Why this result?</p><p className="mt-1 text-sm leading-5 text-[#537065]">{analysis.reason}</p></div></div>
      <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-[#73867d]"><Sparkles size={14} className="text-[#e66a40]" />AI provides a recommendation to review—not a guarantee. You can edit every report detail before submission.</p>
    </div>
  </section>;
}
