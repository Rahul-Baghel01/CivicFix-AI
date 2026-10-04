import { CivicShell } from "@/components/CivicShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bell, Check, Clock3, Inbox, LogIn } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const notifications = trpc.civic.notifications.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const utils = trpc.useUtils();
  const read = trpc.civic.markNotificationRead.useMutation({ onSuccess: () => utils.civic.notifications.invalidate(), onError: error => toast.error(error.message) });
  if (!isAuthenticated) return <CivicShell title="Your updates" eyebrow="Notifications"><div className="rounded-2xl border border-dashed border-[#d9e6dc] bg-white p-10 text-center"><LogIn className="mx-auto text-[#8da69a]" /><h2 className="mt-4 font-display text-xl font-semibold text-[#153e35]">Sign in to see your report updates</h2><p className="mt-2 text-sm text-[#697d73]">Your status notifications are private to your CivicFix account.</p><Button className="mt-5 rounded-xl bg-[#153e35] hover:bg-[#0e3029]" onClick={startLogin}>Sign in</Button></div></CivicShell>;
  return <CivicShell title="Your updates" eyebrow="Notifications"><div className="mx-auto max-w-3xl rounded-2xl border border-[#e0e9e2] bg-white shadow-[0_7px_22px_rgba(21,62,53,.05)]"><div className="flex items-center justify-between border-b border-[#eef3ef] px-6 py-5"><div><h2 className="font-display text-xl font-semibold text-[#153e35]">Report notifications</h2><p className="mt-1 text-sm text-[#6b7f75]">Assignments, work progress, and resolution confirmations.</p></div><Bell className="text-[#e66a40]" /></div>{notifications.isLoading ? <p className="p-8 text-sm text-[#6b7f75]">Loading updates…</p> : notifications.data?.length ? <div className="divide-y divide-[#eef3ef]">{notifications.data.map(note => <div key={note.id} className={`flex gap-4 p-5 ${note.isRead ? "bg-white" : "bg-[#f4faf5]"}`}><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${note.isRead ? "bg-[#eef3ef] text-[#6b8276]" : "bg-[#dff3e1] text-[#238759]"}`}>{note.isRead ? <Check size={16} /> : <Bell size={16} />}</span><div className="min-w-0 flex-1"><p className={`text-sm leading-6 ${note.isRead ? "text-[#587068]" : "font-semibold text-[#153e35]"}`}>{note.message}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#8a9b93]"><Clock3 size={12} />{new Date(note.createdAt).toLocaleString()}</p></div>{!note.isRead && <Button size="sm" variant="outline" className="shrink-0 rounded-lg" disabled={read.isPending} onClick={() => read.mutate({ notificationId: note.id })}>Mark read</Button>}</div>)}</div> : <div className="p-10 text-center"><Inbox className="mx-auto text-[#9eb2a7]" /><h3 className="mt-4 font-display text-lg font-semibold text-[#153e35]">No updates yet</h3><p className="mt-2 text-sm text-[#697d73]">Status notifications are created when the authority team makes progress on your reports.</p></div>}</div></CivicShell>;
}
