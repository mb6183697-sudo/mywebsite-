import { useAdminGetTierApplications, useAdminProcessTierApplication, getAdminGetTierApplicationsQueryKey, getAdminGetUsersQueryKey, getAdminGetGodOverviewQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Clock, ArrowUpCircle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const tierColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-600",
  silver: "bg-slate-100 text-slate-600",
  gold: "bg-yellow-100 text-yellow-700",
  diamond: "bg-cyan-100 text-cyan-700",
  bist: "bg-emerald-100 text-emerald-700",
  viop: "bg-purple-100 text-purple-700",
  fon: "bg-blue-100 text-blue-700",
  forex: "bg-orange-100 text-orange-700",
  kripto: "bg-yellow-50 text-yellow-700",
  halka_arz: "bg-pink-100 text-pink-700",
};

const tierNames: Record<string, string> = {
  standard: "Standart",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  bist: "BIST Yatırım",
  viop: "VİOP",
  fon: "Fon Hesabı",
  forex: "Forex",
  kripto: "Kripto",
  halka_arz: "Halka Arz",
};

const ACCOUNT_TYPES = new Set(["bist", "viop", "fon", "forex", "kripto", "halka_arz"]);

export default function TierApplicationsSection() {
  const { data: applications, isLoading } = useAdminGetTierApplications();
  const { mutate: processApp } = useAdminProcessTierApplication();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleProcess = (id: number, action: "approve" | "reject") => {
    processApp({ id, data: { action } }, {
      onSuccess: () => {
        toast({ title: action === "approve" ? "Başvuru onaylandı" : "Başvuru reddedildi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetTierApplicationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetGodOverviewQueryKey() });
      },
      onError: () => {
        toast({ title: "İşlem başarısız", variant: "destructive" });
      }
    });
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const items = applications || [];
  const pending = items.filter(a => a.status === "pending");
  const processed = items.filter(a => a.status !== "pending");

  const tierPending = pending.filter(a => !ACCOUNT_TYPES.has(a.requestedTier));
  const accountPending = pending.filter(a => ACCOUNT_TYPES.has(a.requestedTier));

  return (
    <div className="space-y-6">
      {/* Pending Tier Applications */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold">Bekleyen Tier Başvuruları ({tierPending.length})</h3>
        </div>

        {tierPending.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">Bekleyen tier başvurusu yok</div>
        ) : (
          <div className="divide-y divide-border">
            {tierPending.map((app) => (
              <div key={app.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{app.userName || `Kullanıcı #${app.userId}`}</span>
                    <span className="text-xs text-muted-foreground">#{app.userId}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColors[app.currentTier || "standard"]}`}>
                      {tierNames[app.currentTier || "standard"]}
                    </span>
                    <ArrowUpCircle className="w-4 h-4 text-primary" />
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColors[app.requestedTier]}`}>
                      {tierNames[app.requestedTier] || app.requestedTier}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtDate(app.createdAt)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={() => handleProcess(app.id, "approve")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Onayla
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleProcess(app.id, "reject")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Account Type Applications */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold">Bekleyen Hesap Başvuruları ({accountPending.length})</h3>
        </div>

        {accountPending.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">Bekleyen hesap başvurusu yok</div>
        ) : (
          <div className="divide-y divide-border">
            {accountPending.map((app) => (
              <div key={app.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{app.userName || `Kullanıcı #${app.userId}`}</span>
                    <span className="text-xs text-muted-foreground">#{app.userId}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColors[app.requestedTier] || "bg-gray-700/50 text-gray-300"}`}>
                      {tierNames[app.requestedTier] || app.requestedTier}
                    </span>
                    <span className="text-xs text-muted-foreground">hesabı açılması talep edildi</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtDate(app.createdAt)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={() => handleProcess(app.id, "approve")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Onayla
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleProcess(app.id, "reject")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Applications */}
      {processed.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold">İşlenmiş Başvurular ({processed.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/10 border-b border-border text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Kullanıcı</th>
                  <th className="px-4 py-2 text-center">Talep</th>
                  <th className="px-4 py-2 text-center">Durum</th>
                  <th className="px-4 py-2 text-left">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processed.map((app) => (
                  <tr key={app.id} className="hover:bg-secondary/5">
                    <td className="px-4 py-2">{app.userName || `#${app.userId}`}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColors[app.requestedTier] || "bg-gray-700/50 text-gray-300"}`}>
                        {tierNames[app.requestedTier] || app.requestedTier}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${app.status === "approved" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
                        {app.status === "approved" ? "Onaylandı" : "Reddedildi"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(app.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
