import { useAdminGetGodOverview } from "@workspace/api-client-react";
import { CreditCard, Banknote, ArrowUpCircle, ShieldCheck, Users, Wallet, Snowflake, UserPlus, Activity, TrendingUp, Gem } from "lucide-react";

interface Props {
  onNavigate: (section: string) => void;
}

export default function GodOverviewSection({ onNavigate }: Props) {
  const { data, isLoading, isError, refetch } = useAdminGetGodOverview({ query: { refetchInterval: 15_000 } });

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-28 bg-card rounded-xl animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-300 font-bold mb-2">Veriler yüklenemedi</p>
        <button onClick={() => refetch()} className="text-sm text-red-400 underline hover:text-red-300">Tekrar Dene</button>
      </div>
    );
  }

  const pendingCards = [
    {
      label: "Bekleyen Yatırım",
      count: data.pendingDeposits,
      icon: CreditCard,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: data.pendingDeposits > 0 ? "border-amber-400/30" : "border-border",
      section: "deposits",
    },
    {
      label: "Bekleyen Çekim",
      count: data.pendingWithdrawals,
      icon: Banknote,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      border: data.pendingWithdrawals > 0 ? "border-orange-400/30" : "border-border",
      section: "withdrawals",
    },
    {
      label: "Tier Başvurusu",
      count: data.pendingTiers,
      icon: ArrowUpCircle,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: data.pendingTiers > 0 ? "border-cyan-400/30" : "border-border",
      section: "tiers",
    },
    {
      label: "Kimlik Doğrulama",
      count: data.pendingIdentity,
      icon: ShieldCheck,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: data.pendingIdentity > 0 ? "border-violet-400/30" : "border-border",
      section: "users",
    },
    {
      label: "Emtia Hesabı Başvurusu",
      count: (data as any).pendingMetal ?? 0,
      icon: Gem,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: ((data as any).pendingMetal ?? 0) > 0 ? "border-amber-500/30" : "border-border",
      section: "metal",
    },
  ];

  const totalPending = data.pendingDeposits + data.pendingWithdrawals + data.pendingTiers + data.pendingIdentity + ((data as any).pendingMetal ?? 0);

  return (
    <div className="space-y-6">
      {totalPending > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 font-bold text-lg">{totalPending}</span>
          </div>
          <div>
            <p className="font-bold text-amber-300">Bekleyen İşlem</p>
            <p className="text-xs text-amber-400/70">Onayınızı bekleyen toplam {totalPending} işlem var</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pendingCards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.section)}
            className={`bg-card rounded-xl border ${card.border} p-5 text-left transition-all hover:shadow-lg hover:scale-[1.02] group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              {card.count > 0 && (
                <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${card.bg} ${card.color}`}>
                  {card.count}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.count}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Toplam Kullanıcı</p>
          <p className="text-2xl font-bold mt-1">{data.totalUsers}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Toplam Bakiye</p>
          <p className="text-2xl font-bold mt-1">{fmtCurrency(data.totalBalance)}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <Snowflake className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Donmuş Bakiye</p>
          <p className="text-2xl font-bold mt-1">{fmtCurrency(data.totalFrozen)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-bold mb-4 text-sm text-muted-foreground uppercase tracking-wide">Son 24 Saat</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Yeni Kayıt</p>
              <p className="text-xl font-bold">{data.last24hRegistrations}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">İşlem Sayısı</p>
              <p className="text-xl font-bold">{data.last24hTransactions}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-400/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">İşlem Hacmi</p>
              <p className="text-xl font-bold">{fmtCurrency(data.last24hVolume)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
