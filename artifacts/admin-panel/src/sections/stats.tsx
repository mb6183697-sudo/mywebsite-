import { useAdminGetStats } from "@workspace/api-client-react";
import { Users, UserCheck, ShieldAlert, Activity, TrendingUp, TrendingDown } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Users; color: string }) {
  return (
    <div className="bg-card p-5 rounded-xl border border-border">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function StatsSection() {
  const { data: stats, isLoading } = useAdminGetStats();

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Toplam Kullanıcı" value={stats?.totalUsers ?? 0} icon={Users} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Aktif Üye" value={stats?.activeUsers ?? 0} icon={UserCheck} color="bg-green-500/10 text-green-400" />
        <StatCard label="Kimlik Bekleyen" value={stats?.pendingVerifications ?? 0} icon={ShieldAlert} color="bg-amber-500/10 text-amber-400" />
        <StatCard label="Açık Pozisyon" value={stats?.openPositions ?? 0} icon={Activity} color="bg-purple-500/10 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-muted-foreground">Toplam Yatırımlar</span>
          </div>
          <div className="text-xl font-bold text-green-400">{fmtCurrency(stats?.totalDeposits ?? 0)}</div>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border">
          <div className="flex items-center gap-3 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm text-muted-foreground">Toplam Çekimler</span>
          </div>
          <div className="text-xl font-bold text-red-400">{fmtCurrency(stats?.totalWithdrawals ?? 0)}</div>
        </div>
      </div>

      {stats?.recentActivities && stats.recentActivities.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold">Son Aktiviteler</h3>
          </div>
          <div className="divide-y divide-border">
            {stats.recentActivities.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm">{a.message}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(a.createdAt ?? "").toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
