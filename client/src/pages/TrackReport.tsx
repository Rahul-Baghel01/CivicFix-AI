import { CivicMap } from "@/components/CivicMap";
import { ResolutionVerification } from "@/components/ResolutionVerification";
import { CivicShell } from "@/components/CivicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Circle, Clock3, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "wouter";

const severityStyle: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-800", MEDIUM: "bg-amber-100 text-amber-800", HIGH: "bg-orange-100 text-orange-800", CRITICAL: "bg-red-100 text-red-800" };
const sequence = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"];

export default function TrackReport() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("id") ?? "CIV-2026-08-000124");
  const [reportId, setReportId] = useState(params.get("id") ?? "CIV-2026-08-000124");
  const track = trpc.civic.track.useQuery({ reportId }, { retry: false });
  useEffect(() => { const id = params.get("id"); if (id) { setSearch(id); setReportId(id); } }, [params]);
  const report = track.data?.report;
  return <CivicShell title="Track your report" eyebrow="Transparent resolution">
    <div className="max-w-3xl"><form onSubmit={event => { event.preventDefault(); setReportId(search.trim().toUpperCase()); }} className="flex gap-2 rounded-2xl border border-[#dce8df] bg-white p-2 shadow-[0_7px_22px_rgba(21,62,53,.05)]"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="CIV-YYYY-MM-XXXXXX" className="border-0 shadow-none focus-visible:ring-0" aria-label="Report reference number" /><Button type="submit" className="rounded-xl bg-[#153e35] hover:bg-[#0d3028]"><Search size={16} />Find report</Button></form>
      {track.isLoading && <p className="py-10 text-center text-sm text-[#6c8076]">Looking up your report…</p>}
      {!track.isLoading && !report && <div className="mt-6 rounded-2xl border border-dashed border-[#d7e4db] bg-white p-10 text-center"><Search className="mx-auto text-[#a1b4aa]" /><h2 className="mt-4 font-display text-xl font-semibold text-[#153e35]">No matching report</h2><p className="mt-2 text-sm text-[#6b7e75]">Check the reference number and try again.</p></div>}
      {report && <div className="mt-6 space-y-6"><section className="overflow-hidden rounded-[26px] bg-[#153e35] p-6 text-white shadow-[0_18px_45px_rgba(21,62,53,.15)] md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-xs text-[#c6dbce]">{report.reportId}</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.03em]">{report.issueType}</h2><p className="mt-3 flex items-center gap-1.5 text-sm text-[#d6e5dc]"><MapPin size={15} />{report.address}</p></div><Badge className={`border-0 ${severityStyle[report.severity]}`}>{report.severity}</Badge></div><div className="mt-7 grid gap-3 border-t border-white/15 pt-5 text-sm sm:grid-cols-3"><div><p className="text-xs text-[#aac4b7]">Current status</p><p className="mt-1 font-semibold">{report.status}</p></div><div><p className="text-xs text-[#aac4b7]">Responsible team</p><p className="mt-1 font-semibold">{report.department}</p></div><div><p className="text-xs text-[#aac4b7]">Priority</p><p className="mt-1 font-semibold">{report.priority}</p></div></div></section>
        <section className="grid gap-6 lg:grid-cols-[1fr_.9fr]"><div className="rounded-2xl border border-[#e0e9e2] bg-white p-6"><h3 className="font-display text-xl font-semibold text-[#153e35]">Resolution timeline</h3><div className="mt-6 space-y-0">{sequence.map((status, index) => { const current = sequence.indexOf(report.status); const complete = index <= current; const event = track.data?.events?.find(item => item.status === status); return <div key={status} className="relative flex gap-4 pb-7 last:pb-0"><span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${complete ? "bg-[#153e35] text-[#d8ff76]" : "border border-[#cbdcd1] bg-white text-[#9ab0a4]"}`}>{complete ? <Check size={15} /> : <Circle size={13} />}</span>{index < sequence.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-px ${complete ? "bg-[#9bbeb0]" : "bg-[#e2ece5]"}`} />}<div><p className={`text-sm font-semibold ${complete ? "text-[#153e35]" : "text-[#91a39a]"}`}>{status === "In Progress" && report.status === "In Progress" ? "Work in progress" : status}</p><p className="mt-1 text-xs leading-5 text-[#74867e]">{event?.details ?? (complete ? "Status recorded by the CivicFix workflow." : "Awaiting this step.")}</p>{event?.createdAt && <p className="mt-1.5 text-[11px] font-medium text-[#a0aea7]">{new Date(event.createdAt).toLocaleString()}</p>}</div></div>; })}</div></div><div className="space-y-5"><div className="overflow-hidden rounded-2xl border border-[#e0e9e2]"><CivicMap markers={[{ latitude: report.latitude, longitude: report.longitude, label: `${report.issueType} · ${report.status}`, severity: report.severity }]} className="h-[265px]" /></div>{report.status === "Resolved" ? <ResolutionVerification originalImageUrl={report.imageUrl} resolutionImageUrl={report.resolutionImageUrl} verificationScore={report.verificationScore} explanation={report.verificationExplanation ?? report.resolutionNote} /> : <div className="rounded-2xl bg-[#fff6ee] p-5"><div className="flex gap-3"><Clock3 className="shrink-0 text-[#e66a40]" /><div><p className="font-semibold text-[#6b3d2c]">We’ll keep you updated</p><p className="mt-1 text-sm leading-6 text-[#875c4c]">Updates are added as the responsible municipal team reviews and completes the work.</p></div></div></div>}</div></section></div>}
    </div>
  </CivicShell>;
}
