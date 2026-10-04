import { CivicShell } from "@/components/CivicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Bell, CheckCircle2, CircleAlert, Clock3, MapPin, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const statusStyles: Record<string, string> = { Submitted: "bg-slate-100 text-slate-700", "Under Review": "bg-amber-50 text-amber-700", Assigned: "bg-blue-50 text-blue-700", "In Progress": "bg-orange-50 text-orange-700", Resolved: "bg-emerald-50 text-emerald-700" };
const severityStyles: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-800", MEDIUM: "bg-amber-100 text-amber-800", HIGH: "bg-orange-100 text-orange-800", CRITICAL: "bg-red-100 text-red-800" };

export default function CitizenDashboard() {
  const { isAuthenticated } = useAuth();
  const dashboard = trpc.civic.dashboard.useQuery();
  const mine = trpc.civic.mine.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const notifications = trpc.civic.notifications.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const impact = trpc.civic.impact.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const reports = mine.data?.length ? mine.data : dashboard.data?.reports?.slice(0, 4) ?? [];
  const stats = dashboard.data?.stats;
  return <CivicShell title="Make a measurable difference." eyebrow="Citizen workspace">
    <section className="relative overflow-hidden rounded-[28px] bg-[#153e35] px-6 py-7 text-white shadow-[0_22px_60px_rgba(21,62,53,.18)] md:px-9 md:py-9">
      <div className="absolute -right-14 -top-20 h-60 w-60 rounded-full bg-[#d8ff76]/15 blur-2xl" />
      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div><p className="mb-2 text-sm font-medium text-[#d8ff76]">Good morning. Your city is listening.</p><h2 className="font-display max-w-xl text-3xl font-semibold tracking-[-.035em]">Spot it. Report it. Watch it get fixed.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#c9d8d1]">CivicFix routes clear, well-documented reports to the right municipal team and keeps every update in one place.</p></div>
        <Link href="/report"><Button className="h-12 rounded-xl bg-[#d8ff76] px-5 font-bold text-[#153e35] hover:bg-[#c7f364]"><Plus size={18} /> Report an issue</Button></Link>
      </div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Reports in city", value: stats?.total ?? "—", icon: CircleAlert, tone: "text-[#e66a40] bg-[#fff0eb]" }, { label: "Being repaired", value: stats?.inProgress ?? "—", icon: Clock3, tone: "text-[#c56c0a] bg-[#fff8e8]" }, { label: "Resolved", value: stats?.resolved ?? "—", icon: CheckCircle2, tone: "text-[#238759] bg-[#ecf8ef]" }, { label: "Your impact", value: mine.data?.length ? `${mine.data.length} reports` : "Start today", icon: Sparkles, tone: "text-[#2464ba] bg-[#edf5ff]" }].map(card => <div key={card.label} className="rounded-2xl border border-[#e0e9e2] bg-white p-5 shadow-[0_7px_22px_rgba(21,62,53,.05)]"><span className={`mb-5 grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><card.icon size={18} /></span><p className="text-2xl font-semibold tracking-tight text-[#153e35]">{card.value}</p><p className="mt-1 text-sm text-[#60736b]">{card.label}</p></div>)}
    </section>

    <section className="mt-9 grid gap-6 xl:grid-cols-[1.55fr_.75fr]">
      <div className="rounded-2xl border border-[#e0e9e2] bg-white shadow-[0_7px_22px_rgba(21,62,53,.05)]">
        <div className="flex items-center justify-between border-b border-[#eef3ef] px-5 py-5"><div><h2 className="font-display text-xl font-semibold text-[#153e35]">Recent reports</h2><p className="mt-1 text-sm text-[#70817a]">{mine.data?.length ? "Your submitted civic reports" : "Live civic activity shown for this demo"}</p></div><Link href="/track" className="inline-flex items-center gap-1 text-sm font-bold text-[#153e35] hover:text-[#e66a40]">Track report <ArrowRight size={15} /></Link></div>
        <div className="divide-y divide-[#eef3ef]">{reports.map(report => <Link key={report.reportId} href={`/track?id=${report.reportId}`} className="group grid gap-3 px-5 py-4 transition hover:bg-[#f8fbf8] sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#153e35]">{report.issueType}</p><Badge className={`border-0 text-[10px] ${severityStyles[report.severity]}`}>{report.severity}</Badge><Badge className={`border-0 text-[10px] ${statusStyles[report.status]}`}>{report.status}</Badge></div><p className="mt-1.5 flex items-center gap-1 text-sm text-[#657971]"><MapPin size={13} />{report.address}</p><p className="mt-1 font-mono text-[11px] text-[#91a09a]">{report.reportId}</p></div><ArrowRight className="justify-self-end text-[#a5b4ad] group-hover:text-[#e66a40]" size={18} /></Link>)}{dashboard.isLoading && <div className="px-5 py-10 text-sm text-[#70817a]">Loading live city reports…</div>}</div>
      </div>
      <aside className="rounded-2xl bg-[#edf4ee] p-6"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#153e35] shadow-sm"><Bell size={18} /></div>{notifications.data?.some(note => !note.isRead) ? <span className="rounded-full bg-[#e66a40] px-2 py-1 text-[10px] font-bold text-white">{notifications.data.filter(note => !note.isRead).length} new</span> : null}</div><h2 className="mt-5 font-display text-xl font-semibold text-[#153e35]">Stay in the loop</h2><p className="mt-2 text-sm leading-6 text-[#60736b]">Report updates, assignments, and resolutions appear in one dependable place.</p>{notifications.data?.length ? <div className="mt-4 space-y-2">{notifications.data.slice(0, 2).map(note => <div key={note.id} className={`rounded-xl border p-3 text-sm ${note.isRead ? "border-[#d9e7da] bg-white/60 text-[#5d746a]" : "border-[#c9e0cf] bg-white text-[#214e3b]"}`}>{note.message}</div>)}</div> : <div className="mt-4 rounded-xl border border-[#d9e7da] bg-white/80 p-3 text-sm text-[#60756b]">New status updates will appear here after your first report is submitted.</div>}<Link href="/notifications" className="mt-4 inline-flex text-sm font-bold text-[#153e35] hover:text-[#e66a40]">Open updates <ArrowRight size={15} /></Link><div className="mt-6 rounded-xl border border-[#d9e7da] bg-white/80 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#e66a40]">Community impact</p><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-xl font-semibold text-[#153e35]">{impact.data?.reportsSubmitted ?? 0}</p><p className="text-xs text-[#638075]">Reports submitted</p></div><div><p className="text-xl font-semibold text-[#153e35]">{impact.data?.issuesResolved ?? 0}</p><p className="text-xs text-[#638075]">Issues resolved</p></div><div><p className="text-xl font-semibold text-[#153e35]">{impact.data?.estimatedPeopleImpacted ?? 0}</p><p className="text-xs text-[#638075]">Estimated people impacted</p></div><div><p className="text-xl font-semibold text-[#153e35]">{impact.data?.neighbourhoodScore ?? 0}%</p><p className="text-xs text-[#638075]">Resolution score</p></div></div><p className="mt-3 text-[11px] leading-4 text-[#73877c]">{impact.data?.methodology ?? "Impact metrics appear after you submit a report."}</p></div></aside>
    </section>
  </CivicShell>;
}
