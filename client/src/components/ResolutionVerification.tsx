import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleHelp, ImageOff, ShieldCheck } from "lucide-react";

export function ResolutionVerification({
  originalImageUrl,
  resolutionImageUrl,
  verificationScore,
  explanation,
}: {
  originalImageUrl: string | null | undefined;
  resolutionImageUrl: string | null | undefined;
  verificationScore: number | null | undefined;
  explanation: string | null | undefined;
}) {
  const likelyResolved = (verificationScore ?? 0) >= 80;
  const evidence = (label: string, url: string | null | undefined, tone: string) => <div className="overflow-hidden rounded-xl border border-[#dce7df] bg-white"><div className={`flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-[.13em] ${tone}`}><span>{label}</span><span className="h-1.5 w-1.5 rounded-full bg-current" /></div>{url ? <img src={url} alt={`${label} evidence`} className="h-28 w-full object-cover" /> : <div className="grid h-28 place-items-center bg-[#f6f9f6] text-center text-xs text-[#74877e]"><span className="inline-flex flex-col items-center gap-2"><ImageOff size={16} />Evidence image unavailable</span></div>}</div>;
  return <section className="overflow-hidden rounded-2xl border border-[#cde4d2] bg-[#eff8f0] shadow-[0_10px_24px_rgba(35,135,89,.08)]"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d8eadc] bg-white/70 p-5"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d8ff76] text-[#153e35]"><ShieldCheck size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#2e724f]">Resolution verification</p><h3 className="mt-1 font-display text-xl font-semibold text-[#153e35]">Evidence review completed</h3></div></div><Badge className={`border-0 ${likelyResolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{likelyResolved ? "Likely resolved" : "Manual review"}</Badge></div><div className="p-5"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">{evidence("Before image", originalImageUrl, "bg-[#fff0eb] text-[#a44e30]")}<span className="grid h-8 w-8 place-items-center rounded-full bg-[#153e35] text-[#d8ff76]">+</span>{evidence("After image", resolutionImageUrl, "bg-[#e6f6e9] text-[#277349]")}</div><div className="mt-4 rounded-xl bg-white/80 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#5d7c6a]">Verification confidence</p><p className="mt-1 text-2xl font-semibold text-[#153e35]">{verificationScore ?? "—"}{verificationScore !== null ? "%" : ""}</p></div><CheckCircle2 className={likelyResolved ? "text-[#238759]" : "text-[#c58a1c]"} size={26} /></div><p className="mt-3 text-sm leading-6 text-[#547268]">{explanation ?? "The authority supplied a resolution update. A municipal reviewer should confirm evidence where needed."}</p></div><p className="mt-3 flex gap-2 text-xs leading-5 text-[#677e72]"><CircleHelp size={15} className="mt-0.5 shrink-0" />{likelyResolved ? "AI verification is an evidence-based recommendation, not a guarantee. Municipal quality checks remain in place." : "Manual verification recommended: the evidence is incomplete or uncertain."}</p></div></section>;
}
