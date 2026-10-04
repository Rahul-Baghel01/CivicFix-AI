import { Bell, Building2, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Map, PlusCircle, ScanSearch, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

const citizenLinks = [
  { href: "/dashboard", icon: LayoutDashboard, label: "My dashboard" },
  { href: "/report", icon: PlusCircle, label: "Report an issue" },
  { href: "/track", icon: ScanSearch, label: "Track a report" },
  { href: "/analytics", icon: Map, label: "City map" },
  { href: "/notifications", icon: Bell, label: "Updates" },
];

export function CivicShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-[#f5f7f4] text-[#152824]">
      <header className="border-b border-[#dde7e0] bg-[#fbfdfb]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-[#153e35]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#153e35] text-[#d8ff76] shadow-sm"><Building2 size={18} /></span>
            <span>CivicFix <span className="text-[#e66a40]">AI</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {citizenLinks.map(item => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${location === item.href ? "bg-[#e6f0e9] text-[#153e35] font-semibold" : "text-[#52655f] hover:bg-[#eef4ef] hover:text-[#153e35]"}`}><Icon size={15} />{item.label}</Link>;
            })}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? <>
              <Link href="/dashboard" className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e6f0e9] text-[#153e35]" aria-label="Open my dashboard"><Bell size={17} /></Link>
              <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-[#d7e4dc] px-3 py-2 text-sm font-medium text-[#486059] transition hover:border-[#153e35] hover:text-[#153e35]"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button>
            </> : <button onClick={startLogin} className="inline-flex items-center gap-2 rounded-lg bg-[#153e35] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e3029]"><UserRound size={15} />Sign in</button>}
          </div>
        </div>
      </header>
      <main className="container py-7 md:py-10">
        <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e66a40]">{eyebrow}</p>}
            <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[#153e35] md:text-4xl">{title}</h1>
          </div>
          {user?.role === "admin" ? <Link href="/authority" className="inline-flex items-center gap-1 text-sm font-semibold text-[#153e35] hover:text-[#e66a40]">Authority console <ChevronRight size={16} /></Link> : <Link href="/authority" className="inline-flex items-center gap-1 text-sm font-semibold text-[#52655f] hover:text-[#153e35]"><CircleHelp size={15} /> Authority access</Link>}
        </div>
        {children}
      </main>
    </div>
  );
}
