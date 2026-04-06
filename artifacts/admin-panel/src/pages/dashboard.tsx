import { useState, useEffect } from "react";
import { useAdminAuth } from "@/App";
import { useAdminGetGodOverview } from "@workspace/api-client-react";
import { Users, CreditCard, Building2, Megaphone, Star, BarChart3, LogOut, Menu, Banknote, ArrowUpCircle, Bell, Eye, MessageCircle, TrendingUp, Database, Shield, Percent, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import UsersSection from "@/sections/users";
import DepositRequestsSection from "@/sections/deposit-requests";
import WithdrawalRequestsSection from "@/sections/withdrawal-requests";
import TierApplicationsSection from "@/sections/tier-applications";
import AddressesSection from "@/sections/addresses";
import CampaignsSection from "@/sections/campaigns";
import ExpertPicksSection from "@/sections/expert-picks";
import StatsSection from "@/sections/stats";
import GodOverviewSection from "@/sections/god-overview";
import AdminNotificationsSection from "@/sections/admin-notifications";
import SupportMessagesSection from "@/sections/support-messages";
import TradeOrdersSection from "@/sections/trade-orders";
import StockRegistrySection from "@/sections/stock-registry";
import AdminAccountsSection from "@/sections/admin-accounts";
import IBSection from "@/sections/ib-section";
import SpreadManagementSection from "@/sections/spread-management";
import MetalApplicationsSection from "@/sections/metal-applications";

type Section = "god" | "stats" | "users" | "deposits" | "withdrawals" | "tiers" | "addresses" | "campaigns" | "expert-picks" | "notifications" | "messages" | "orders" | "stocks" | "admins" | "ib" | "spread" | "metal";

interface NavItem {
  id: Section;
  label: string;
  icon: typeof Users;
  permission?: string;
  superOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: "god", label: "God Mode", icon: Eye },
  { id: "stats", label: "İstatistikler", icon: BarChart3, permission: "stats" },
  { id: "users", label: "Kullanıcılar", icon: Users, permission: "users" },
  { id: "orders", label: "İşlemler", icon: TrendingUp, permission: "orders" },
  { id: "deposits", label: "Yatırım Talepleri", icon: CreditCard, permission: "deposits" },
  { id: "withdrawals", label: "Çekim Talepleri", icon: Banknote, permission: "withdrawals" },
  { id: "tiers", label: "Tier Başvuruları", icon: ArrowUpCircle, permission: "tier_apps" },
  { id: "messages", label: "Mesajlar", icon: MessageCircle, permission: "support" },
  { id: "notifications", label: "Bildirimler", icon: Bell, permission: "notifications" },
  { id: "addresses", label: "Adres Yönetimi", icon: Building2, permission: "deposits" },
  { id: "campaigns", label: "Kampanyalar", icon: Megaphone, permission: "campaigns" },
  { id: "expert-picks", label: "Uzman Hisseler", icon: Star, permission: "expert_picks" },
  { id: "stocks", label: "Hisse Kayıtları", icon: Database, permission: "stocks" },
  { id: "admins", label: "Adminler", icon: Shield, superOnly: true },
  { id: "ib", label: "IB Kadrosu", icon: Users, superOnly: true },
  { id: "spread", label: "Spread Yönetimi", icon: Percent, superOnly: true },
  { id: "metal", label: "Değerli Metaller", icon: Gem, superOnly: true },
];

const SECTION_KEY = "admin_active_section";

export default function Dashboard() {
  const { user, logout, hasPermission } = useAdminAuth();
  const [activeSection, setActiveSection] = useState<Section>(() => {
    const saved = localStorage.getItem(SECTION_KEY) as Section | null;
    const valid: Section[] = ["god","stats","users","deposits","withdrawals","tiers","addresses","campaigns","expert-picks","notifications","messages","orders","stocks","admins","ib","spread","metal"];
    return saved && valid.includes(saved) ? saved : "god";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: godData } = useAdminGetGodOverview({ query: { refetchInterval: 15_000 } });
  const [openChatsCount, setOpenChatsCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
    const fetchChats = () => {
      fetch("/api/admin/support/chats", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then((chats: { status: string }[]) => setOpenChatsCount(chats.filter(c => c.status === "open").length))
        .catch(() => {});
    };
    fetchChats();
    const interval = setInterval(fetchChats, 8000);
    return () => clearInterval(interval);
  }, []);

  const totalPending = godData ? godData.pendingDeposits + godData.pendingWithdrawals + godData.pendingTiers + godData.pendingIdentity : 0;

  const getBadge = (id: Section): number => {
    switch (id) {
      case "god": return totalPending + openChatsCount + ((godData as any)?.pendingMetal ?? 0);
      case "deposits": return godData?.pendingDeposits ?? 0;
      case "withdrawals": return godData?.pendingWithdrawals ?? 0;
      case "tiers": return godData?.pendingTiers ?? 0;
      case "messages": return openChatsCount;
      case "metal": return (godData as any)?.pendingMetal ?? 0;
      default: return 0;
    }
  };

  // Scroll to top after the new section renders (requestAnimationFrame ensures post-render)
  useEffect(() => {
    requestAnimationFrame(() => {
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [activeSection]);

  const changeSection = (section: Section) => {
    setActiveSection(section);
    localStorage.setItem(SECTION_KEY, section);
    setSidebarOpen(false);
  };

  const handleNavigate = (section: string) => {
    changeSection(section as Section);
  };

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(item => {
    if (item.superOnly) return user?.isSuper === true;
    if (!item.permission) return true; // god mode visible to all
    return hasPermission(item.permission);
  });

  const renderSection = () => {
    switch (activeSection) {
      case "god": return <GodOverviewSection onNavigate={handleNavigate} />;
      case "stats": return <StatsSection />;
      case "users": return <UsersSection />;
      case "orders": return <TradeOrdersSection />;
      case "deposits": return <DepositRequestsSection />;
      case "withdrawals": return <WithdrawalRequestsSection />;
      case "tiers": return <TierApplicationsSection />;
      case "messages": return <SupportMessagesSection />;
      case "notifications": return <AdminNotificationsSection />;
      case "addresses": return <AddressesSection />;
      case "campaigns": return <CampaignsSection />;
      case "expert-picks": return <ExpertPicksSection />;
      case "stocks": return <StockRegistrySection />;
      case "admins": return <AdminAccountsSection />;
      case "ib": return <IBSection />;
      case "spread": return <SpreadManagementSection />;
      case "metal": return <MetalApplicationsSection />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-foreground">1000 Yatırımlar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Admin Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const badge = getBadge(item.id);
            return (
              <button
                key={item.id}
                onClick={() => changeSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                    activeSection === item.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-amber-500/20 text-amber-400"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {user?.displayName?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">{user?.displayName}</div>
              <div className="text-xs text-muted-foreground">{user?.isSuper ? "Süper Admin" : "Admin"}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4">
          <button className="lg:hidden p-2 hover:bg-accent rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">
            {visibleNavItems.find(n => n.id === activeSection)?.label}
          </h2>
          {totalPending > 0 && activeSection !== "god" && (
            <button
              onClick={() => changeSection("god")}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px]">{totalPending}</span>
              Bekleyen İşlem
            </button>
          )}
        </header>

        <div className="p-4 lg:p-6">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
