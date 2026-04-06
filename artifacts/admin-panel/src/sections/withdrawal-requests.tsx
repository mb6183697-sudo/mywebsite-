import { useAdminGetWithdrawalRequests, useAdminProcessWithdrawalRequest, getAdminGetWithdrawalRequestsQueryKey, getAdminGetStatsQueryKey, getAdminGetUsersQueryKey, getAdminGetGodOverviewQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Clock, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function WithdrawalRequestsSection() {
  const { data: requests, isLoading } = useAdminGetWithdrawalRequests();
  const { mutate: processRequest } = useAdminProcessWithdrawalRequest();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleProcess = (id: number, action: "approve" | "reject") => {
    processRequest({ id, data: { action } }, {
      onSuccess: () => {
        toast({ title: action === "approve" ? "Çekim onaylandı" : "Çekim reddedildi, bakiye iade edildi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetWithdrawalRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetGodOverviewQueryKey() });
      },
      onError: () => {
        toast({ title: "İşlem başarısız", variant: "destructive" });
      }
    });
  };

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const items = requests || [];
  const pending = items.filter(r => r.status === "pending");
  const processed = items.filter(r => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold">Bekleyen Çekim Talepleri ({pending.length})</h3>
        </div>

        {pending.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">Bekleyen çekim talebi yok</div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((req) => (
              <div key={req.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{req.userName || `Kullanıcı #${req.userId}`}</span>
                    <span className="text-xs text-muted-foreground">#{req.userId}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-bold text-foreground text-lg">{fmtCurrency(req.amount)}</span>
                    <span>{fmtDate(req.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <Banknote className="w-3 h-3 inline mr-1" />
                    <span className="font-medium">{req.accountName}</span> — {req.accountAddress}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="bg-green-700 hover:bg-green-600 text-white" onClick={() => handleProcess(req.id, "approve")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Onayla
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleProcess(req.id, "reject")}>
                    <XCircle className="w-4 h-4 mr-1" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {processed.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold">İşlenmiş Çekim Talepleri ({processed.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/10 border-b border-border text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Kullanıcı</th>
                  <th className="px-4 py-2 text-right">Tutar</th>
                  <th className="px-4 py-2 text-left">Hesap</th>
                  <th className="px-4 py-2 text-center">Durum</th>
                  <th className="px-4 py-2 text-left">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processed.map((req) => (
                  <tr key={req.id} className="hover:bg-secondary/5">
                    <td className="px-4 py-2">{req.userName || `#${req.userId}`}</td>
                    <td className="px-4 py-2 text-right font-bold">{fmtCurrency(req.amount)}</td>
                    <td className="px-4 py-2 text-xs">{req.accountName}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${req.status === "approved" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
                        {req.status === "approved" ? "Onaylandı" : "Reddedildi"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(req.createdAt)}</td>
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
