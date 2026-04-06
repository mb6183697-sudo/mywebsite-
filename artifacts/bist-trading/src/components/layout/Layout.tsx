import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Ticker } from "./Ticker";
import { NotificationBell } from "./NotificationBell";
import { 
  BarChart2, 
  Home, 
  LineChart, 
  Newspaper, 
  PieChart, 
  Search, 
  Settings, 
  User as UserIcon,
  LogOut,
  TrendingUp,
  TrendingDown,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TradeProvider } from "@/hooks/use-trade";
import { LiveSupport } from "@/components/LiveSupport";
import { useTrade } from "@/hooks/use-trade";
import { useGetStocks } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function StockSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openTrade } = useTrade();

  const { data: stocks } = useGetStocks(
    { search: query || undefined },
    { query: { enabled: query.length >= 1, staleTime: 10000 } }
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = stocks?.slice(0, 8) || [];

  const handleSelect = (stock: typeof results[0]) => {
    openTrade({
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price ?? 0,
      change: stock.change ?? 0,
      changePercent: stock.changePercent ?? 0,
      volume: stock.volume ?? 0,
    });
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="hidden sm:flex relative group">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 1 && setOpen(true)}
        placeholder="Hisse Ara..."
        className="pl-9 pr-8 py-2 bg-secondary/5 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-64"
      />
      {query && (
        <button
          onClick={() => { setQuery(""); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && query.length >= 1 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {stocks === undefined ? "Aranıyor..." : "Sonuç bulunamadı"}
            </div>
          ) : (
            <div className="py-1">
              {results.map(stock => {
                const isUp = (stock.changePercent ?? 0) >= 0;
                return (
                  <button
                    key={stock.symbol}
                    onMouseDown={e => { e.preventDefault(); handleSelect(stock); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isUp ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                        {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{stock.symbol}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">{stock.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(stock.price ?? 0)}</p>
                      <p className={`text-xs font-medium ${isUp ? "text-success" : "text-destructive"}`}>
                        {isUp ? "+" : ""}{formatPercent(stock.changePercent ?? 0)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Ana Sayfa", icon: Home },
    { href: "/hisseler", label: "Hisseler", icon: LineChart },
    { href: "/portfoy", label: "Portföy", icon: PieChart },
    { href: "/haberler", label: "Haberler", icon: Newspaper },
  ];

  const mobileNavItems = [
    { href: "/", label: "Ana Sayfa", icon: Home },
    { href: "/hisseler", label: "Hisseler", icon: LineChart },
    { href: "/haberler", label: "Haberler", icon: Newspaper },
    { href: "/portfoy", label: "Portföy", icon: PieChart },
    { href: "/profil", label: "Profil", icon: UserIcon },
  ];

  if (user?.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin Paneli", icon: Settings });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Ticker />
      
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo_1000_nobg.png`} 
                alt="1000 Yatırımlar Logo" 
                className="h-7 md:h-8 object-contain transition-transform group-hover:scale-105"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/10 hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <StockSearch />

            {user && <NotificationBell />}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="font-semibold">{user.firstName} {user.lastName}</span>
                    <span className="text-xs text-muted-foreground">#{user.accountId}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profil" className="cursor-pointer flex items-center">
                      <UserIcon className="w-4 h-4 mr-2" /> Profilim
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portfoy" className="cursor-pointer flex items-center">
                      <BarChart2 className="w-4 h-4 mr-2" /> Portföyüm
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Giriş Yap
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border shadow-lg">
          <div className="flex items-center justify-around h-16 px-2">
            {mobileNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function LiveSupportConditional() {
  const [location] = useLocation();
  const hidden = location === "/portfoy" || location === "/portfoy/";
  if (hidden) return null;
  return <LiveSupport />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TradeProvider>
      <LayoutInner>{children}</LayoutInner>
      <LiveSupportConditional />
    </TradeProvider>
  );
}
