import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetDepositAddresses, useCreateDepositRequest, useCreateWithdrawalRequest, useChangePassword, useApplyForTier, useUploadIdentity, useGetPortfolio, useUpdateMyProfile } from "@workspace/api-client-react";
import type { ApplyForTierBodyTier, User } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Camera, CheckCircle2, Clock, CreditCard, ShieldAlert, Upload, Diamond, Wallet, Lock, Eye, EyeOff, Copy, Check, LogOut, Briefcase, ChevronDown, Plus, Building2, MessageCircle, UserCog, Gem, ArrowLeftRight, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ── Hesaplar Arası Virman Dialog ─────────────────────────────────────────────
function VirmanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const token = () => localStorage.getItem("auth_token");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [usdTryRate, setUsdTryRate] = useState<number>(44);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingAccounts(true);
    fetch("/api/transfer/accounts", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => {
        setAccounts(d.accounts || []);
        setUsdTryRate(d.usdTryRate ?? 44);
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, [open]);

  const fromAcc = accounts.find(a => String(a.id) === fromId);
  const toAcc = accounts.find(a => String(a.id) === toId);
  const toAccounts = accounts.filter(a => String(a.id) !== fromId);

  const fromCurrency = fromAcc?.balanceCurrency ?? "TRY";
  const toCurrency = toAcc?.balanceCurrency ?? "TRY";
  const parsedAmount = parseFloat(amount) || 0;

  const receivedAmount = (() => {
    if (!parsedAmount || fromCurrency === toCurrency) return parsedAmount;
    if (fromCurrency === "TRY" && toCurrency === "USD") return parsedAmount / usdTryRate;
    if (fromCurrency === "USD" && toCurrency === "TRY") return parsedAmount * usdTryRate;
    return parsedAmount;
  })();

  const needsConversion = fromAcc && toAcc && fromCurrency !== toCurrency;
  const available = fromAcc ? (fromAcc.balance ?? 0) - (fromAcc.frozenBalance ?? 0) : 0;

  const getAccLabel = (acc: any) => {
    const name = acc.subAccountName ?? `${acc.firstName} ${acc.lastName}`;
    const curr = acc.balanceCurrency === "USD" ? "USD" : "TRY";
    const bal = acc.balanceCurrency === "USD"
      ? `$${(acc.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : formatCurrency(acc.balance ?? 0);
    return `${name} · ${acc.accountId} (${curr} · ${bal})`;
  };

  const handleTransfer = async () => {
    if (!fromId || !toId) return toast({ title: "Hesap seçin", description: "Kaynak ve hedef hesabı seçin.", variant: "destructive" });
    if (!parsedAmount || parsedAmount <= 0) return toast({ title: "Tutar girin", description: "Geçerli bir tutar girin.", variant: "destructive" });
    if (parsedAmount > available) return toast({ title: "Yetersiz bakiye", description: `Kullanılabilir: ${available.toFixed(2)} ${fromCurrency}`, variant: "destructive" });
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ fromAccountId: parseInt(fromId), toAccountId: parseInt(toId), amount: parsedAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Virman başarısız");
      toast({
        title: "Virman Tamamlandı",
        description: needsConversion
          ? `${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} (${usdTryRate.toFixed(2)} kur)`
          : `${parsedAmount.toFixed(2)} ${fromCurrency} aktarıldı.`,
      });
      setFromId(""); setToId(""); setAmount("");
      onClose();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" /> Hesaplarım Arası Virman
          </DialogTitle>
        </DialogHeader>

        {loadingAccounts ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Hesaplar yükleniyor...</div>
        ) : accounts.length < 2 ? (
          <div className="py-6 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Virman yapabilmek için en az 2 bağlı hesabınız olmalı.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Kaynak hesap */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Kaynak Hesap (Nereden)</label>
              <select
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={fromId}
                onChange={e => { setFromId(e.target.value); if (e.target.value === toId) setToId(""); }}
              >
                <option value="">Hesap seçin...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={String(acc.id)}>{getAccLabel(acc)}</option>
                ))}
              </select>
              {fromAcc && (
                <p className="text-xs text-muted-foreground mt-1 pl-1">
                  Kullanılabilir: <span className="font-semibold text-foreground">
                    {fromAcc.balanceCurrency === "USD"
                      ? `$${available.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : formatCurrency(available)}
                  </span>
                </p>
              )}
            </div>

            {/* Hedef hesap */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Hedef Hesap (Nereye)</label>
              <select
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={toId}
                onChange={e => setToId(e.target.value)}
                disabled={!fromId}
              >
                <option value="">Hesap seçin...</option>
                {toAccounts.map(acc => (
                  <option key={acc.id} value={String(acc.id)}>{getAccLabel(acc)}</option>
                ))}
              </select>
            </div>

            {/* Tutar */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Tutar ({fromCurrency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {fromCurrency === "USD" ? "$" : "₺"}
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-11 pl-8 text-base"
                />
                {fromAcc && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium hover:underline"
                    onClick={() => setAmount(available.toFixed(2))}
                  >
                    Tümü
                  </button>
                )}
              </div>
            </div>

            {/* Kur dönüşüm önizlemesi */}
            {needsConversion && parsedAmount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Kur Dönüşümü
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gönderilen</span>
                  <span className="font-bold">{fromCurrency === "USD" ? "$" : "₺"}{parsedAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Güncel USD/TRY kuru</span>
                  <span>1 USD = {usdTryRate.toFixed(4)} TRY</span>
                </div>
                <div className="h-px bg-amber-200 dark:bg-amber-800/40" />
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Alınan</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400 text-base">
                    {toCurrency === "USD" ? "$" : "₺"}{receivedAmount.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </span>
                </div>
              </div>
            )}

            {/* Özet — aynı para birimi */}
            {!needsConversion && fromAcc && toAcc && parsedAmount > 0 && (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aktarılacak tutar</span>
                <span className="font-bold">{fromCurrency === "USD" ? "$" : "₺"}{parsedAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={isSubmitting || !fromId || !toId || !parsedAmount}
              className="w-full h-11 text-sm font-semibold"
            >
              {isSubmitting ? "İşleniyor..." : (
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" /> Virmani Gerçekleştir
                </span>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Virman işlemlerinde herhangi bir kesinti uygulanmaz.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HesaplarimSection({ user }: { user: User }) {
  const { toast } = useToast();
  const { login } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountIsTest, setNewAccountIsTest] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const token = () => localStorage.getItem("auth_token");
  const isIBMain = (user as any).isIB && !(user as any).parentIbId;

  const loadAccounts = () => {
    setIsLoading(true);
    fetch("/api/ib/my-accounts", { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadAccounts(); }, [user.id]);

  const handleCreate = async () => {
    if (!newAccountName.trim()) {
      toast({ title: "Hesap adı gerekli", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/ib/sub-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ accountName: newAccountName.trim(), isTest: newAccountIsTest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Hata");
      toast({ title: "Hesap oluşturuldu", description: `${newAccountName} hesabı oluşturuldu.` });
      setNewAccountName("");
      setNewAccountIsTest(true);
      setIsAddOpen(false);
      loadAccounts();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitch = async (targetId: number, targetName: string) => {
    setSwitchingId(targetId);
    try {
      const res = await fetch(`/api/ib/switch/${targetId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Hata");
      toast({ title: `${targetName} hesabına geçildi` });
      login(data.token);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Hesaplarım
        </h2>
        {isIBMain && (
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="h-8">
            <Plus className="w-4 h-4 mr-1" /> Hesap Ekle
          </Button>
        )}
      </div>

      {isIBMain && (user as any).ibAllocatedBalance > 0 && (
        <div className="text-xs text-muted-foreground mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          IB havuz bakiyeniz: <span className="font-bold text-amber-700">{formatCurrency((user as any).ibAllocatedBalance || 0)}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => {
            const name = acc.subAccountName || acc.firstName + (acc.lastName ? ` ${acc.lastName}` : "");
            const isCurrent = acc.isCurrentAccount;
            const nameLow = name.toLowerCase();
            const isGold   = acc.role === "metal" && (nameLow.includes("altın") || nameLow.includes("gold"));
            const isBrent  = acc.role === "metal" && nameLow.includes("brent");
            const isWti    = acc.role === "metal" && nameLow.includes("wti");
            return (
              <div
                key={acc.id}
                className={`flex items-center justify-between rounded-xl p-3 border ${
                  isCurrent
                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                    : acc.role === "metal"
                      ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30"
                      : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    acc.role === "ib"
                      ? "bg-amber-500/20 text-amber-700"
                      : acc.role === "metal"
                        ? "bg-amber-100 dark:bg-amber-800/30 text-lg"
                        : acc.role === "main"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-primary/10 text-primary"
                  }`}>
                    {acc.role === "ib" ? "IB"
                      : acc.role === "metal" ? (isGold ? "🥇" : isBrent ? "🛢️" : isWti ? "⛽" : "🥈")
                      : acc.role === "main" ? "★"
                      : name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                      {name}
                      {isCurrent && (
                        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Aktif</span>
                      )}
                      {acc.role === "ib" && !isCurrent && (
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Ana Hesap</span>
                      )}
                      {acc.role === "metal" && (
                        <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                          1:{acc.leverage ?? 200} Kaldıraç
                        </span>
                      )}
                      {acc.role === "main" && !isCurrent && (
                        <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">Ana Hesap</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">#{acc.accountId}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {acc.balanceCurrency === "USD"
                        ? `$${(acc.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : formatCurrency(acc.balance)}
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={switchingId === acc.id}
                      onClick={() => handleSwitch(acc.id, name)}
                      className="h-8 text-xs px-3"
                    >
                      {switchingId === acc.id ? "..." : "Geç"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">Hesap bulunamadı.</div>
          )}
        </div>
      )}

      {isIBMain && (
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setNewAccountName(""); setNewAccountIsTest(true); } }}>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle>Yeni Hesap Oluştur</DialogTitle>
            </DialogHeader>
            <div className="py-3 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Hesap Adı</label>
                <Input
                  placeholder="ör. Portföy A, Emeklilik Fonu..."
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  className="h-11"
                  autoFocus
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={newAccountIsTest}
                    onChange={e => setNewAccountIsTest(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${newAccountIsTest ? "bg-amber-500 border-amber-500" : "border-border bg-background"}`}>
                    {newAccountIsTest && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Test Hesabı</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    İşaretlenirse bu hesap test/IB grubunda görünür ve bakiyesi genel istatistiklere dahil edilmez.
                  </p>
                </div>
              </label>
              <Button onClick={handleCreate} disabled={isCreating} className="w-full h-11">
                {isCreating ? "Oluşturuluyor..." : "Hesap Oluştur"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Değerli Metaller Hesabı bölümü ─────────────────────────────────────────
function MetalAccountSection({ user }: { user: User }) {
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const metalStatus = (user as any).metalApplicationStatus as string | null;
  const isMetalAccount = !!(user as any).isMetalAccount;

  // Ana metal hesap değilse ve zaten onaylandıysa bu bölümü gösterme
  // (Hesaplarım bölümünden yönetiyorlar)
  if (isMetalAccount) return null;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/metal/apply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Başvuru başarısız");
      toast({ title: "Başvurunuz alındı", description: data.message });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
      <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
        <Gem className="w-5 h-5 text-amber-500" />
        Değerli Metaller Hesabı
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        1 hesap, 4 enstrüman — Altın (XAUTRYG), Gümüş (XAGTRYG), Brent (BRENTOIL) ve WTI Ham Petrol (WTIOIL) işlemlerini tek bir USD bakiyeli hesaptan 1:200 kaldıraçla yapın.
        Minimum 0,01 lot, 7/24 işlem imkânı.
      </p>

      {/* Status display */}
      {metalStatus === "pending" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/50">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">Başvurunuz İnceleniyor</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">En kısa sürede değerlendirilecek ve hesabınız aktive edilecektir.</p>
          </div>
        </div>
      )}

      {metalStatus === "approved" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="font-semibold text-success">Hesabınız Aktif</p>
            <p className="text-sm text-muted-foreground">Metal hesabınız "Hesaplarım" bölümünden erişilebilir.</p>
          </div>
        </div>
      )}

      {metalStatus === "rejected" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">Başvurunuz reddedildi. Destek hattımızla iletişime geçebilirsiniz.</p>
          </div>
        </div>
      )}

      {/* Apply button — shown when no application or after rejection */}
      {(!metalStatus || metalStatus === "rejected") && (
        <div className="space-y-4">
          {/* Altın, Gümüş, Brent, WTI bilgi kartları */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50">
              <div className="text-2xl mb-2">🥇</div>
              <p className="font-bold text-sm">Altın (XAUTRYG)</p>
              <p className="text-xs text-muted-foreground mt-1">GC=F × USDTRY</p>
              <p className="text-xs text-muted-foreground">7/24 işlem</p>
            </div>
            <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-600/50">
              <div className="text-2xl mb-2">🥈</div>
              <p className="font-bold text-sm">Gümüş (XAGTRYG)</p>
              <p className="text-xs text-muted-foreground mt-1">SI=F × USDTRY</p>
              <p className="text-xs text-muted-foreground">7/24 işlem</p>
            </div>
            <div className="rounded-xl p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700/50">
              <div className="text-2xl mb-2">🛢️</div>
              <p className="font-bold text-sm">Brent Ham Petrol (BRENTOIL)</p>
              <p className="text-xs text-muted-foreground mt-1">BZ=F × USDTRY</p>
              <p className="text-xs text-muted-foreground">7/24 işlem</p>
            </div>
            <div className="rounded-xl p-4 border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700/50">
              <div className="text-2xl mb-2">⛽</div>
              <p className="font-bold text-sm">WTI Ham Petrol (WTIOIL)</p>
              <p className="text-xs text-muted-foreground mt-1">CL=F × USDTRY</p>
              <p className="text-xs text-muted-foreground">7/24 işlem</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
            <span className="font-bold text-primary">1:200</span> Kaldıraç · Anlık fiyatlar (Altın, Gümüş, Brent, WTI) · TRY cinsinden
          </div>
          <Button
            onClick={handleApply}
            disabled={isApplying || !(user as any).isIdentityVerified}
            className="w-full h-11"
            title={!(user as any).isIdentityVerified ? "Kimlik doğrulaması gerekli" : undefined}
          >
            {isApplying ? (
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Gönderiliyor...</span>
            ) : (
              <span className="flex items-center gap-2"><Gem className="w-4 h-4" /> Değerli Metaller Hesabı Başvurusu</span>
            )}
          </Button>
          {!(user as any).isIdentityVerified && (
            <p className="text-xs text-center text-muted-foreground">Başvuru için kimlik doğrulaması gereklidir.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { user, refetchUser, logout } = useAuth();
  const { toast } = useToast();
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isVirmanOpen, setIsVirmanOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ firstName: "", lastName: "", phone: "", city: "", district: "" });
  const [depositAmount, setDepositAmount] = useState("");
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [withdrawAccountAddress, setWithdrawAccountAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showBalance, setShowBalance] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [identityFront, setIdentityFront] = useState<File | null>(null);
  const [identityBack, setIdentityBack] = useState<File | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<string>("");
  const [isAccountApplying, setIsAccountApplying] = useState(false);

  const { data: portfolio } = useGetPortfolio({ query: { refetchInterval: 30_000 } });
  const isUsd = (user as any).balanceCurrency === "USD";
  const fmt = (n: number | null | undefined) => isUsd
    ? `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatCurrency(n ?? 0);
  const { data: depositAddresses } = useGetDepositAddresses();
  const { mutate: doUpload, isPending: isUploading } = useUploadIdentity();
  const { mutate: doCreateDeposit, isPending: isDepositPending } = useCreateDepositRequest();
  const { mutate: doWithdraw, isPending: isWithdrawPending } = useCreateWithdrawalRequest();
  const { mutate: doChangePassword, isPending: isPasswordPending } = useChangePassword();
  const { mutate: doApplyTier } = useApplyForTier();
  const { mutate: doUpdateProfile, isPending: isProfileSaving } = useUpdateMyProfile();

  const handleAccountApplication = async () => {
    if (!selectedAccountType) {
      toast({ title: "Hesap türü seçin", description: "Lütfen başvurmak istediğiniz hesap türünü seçin.", variant: "destructive" });
      return;
    }
    setIsAccountApplying(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/account-application", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountType: selectedAccountType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Başvuru gönderilemedi");
      toast({ title: "Başvuru Alındı", description: data.message || "Başvurunuz başarıyla alındı." });
      setSelectedAccountType("");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setIsAccountApplying(false);
    }
  };

  const handleIdentityUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityFront || !identityBack) {
      toast({ title: "Hata", description: "Lütfen kimlik ön ve arka yüz fotoğraflarını yükleyin", variant: "destructive" });
      return;
    }
    doUpload({ data: { front: identityFront, back: identityBack } }, {
      onSuccess: () => {
        toast({ title: "Kimlik Yüklendi", description: "Belgeleriniz başarıyla gönderildi. Onay süreci başlatıldı." });
        setIdentityFront(null);
        setIdentityBack(null);
        refetchUser();
      },
      onError: () => {
        toast({ title: "Hata", description: "Belgeler yüklenirken bir hata oluştu", variant: "destructive" });
      }
    });
  };

  const handleDepositRequest = () => {
    const val = parseFloat(depositAmount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Hata", description: "Geçerli bir tutar giriniz", variant: "destructive" });
      return;
    }

    doCreateDeposit({ data: { amount: val.toString(), receipt: depositFile || undefined } }, {
      onSuccess: () => {
        toast({ title: "Talep Alındı", description: "Para yükleme talebiniz alınmıştır. Dekontunuz inceleniyor." });
        setIsDepositOpen(false);
        setDepositAmount("");
        setDepositFile(null);
      },
      onError: (err) => {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleWithdraw = () => {
    const val = parseFloat(withdrawAmount);
    if (isNaN(val) || val <= 0 || !withdrawAccountName || !withdrawAccountAddress) {
      toast({ title: "Hata", description: "Tüm alanları doldurunuz", variant: "destructive" });
      return;
    }
    doWithdraw({ data: { amount: val, accountName: withdrawAccountName, accountAddress: withdrawAccountAddress } }, {
      onSuccess: () => {
        toast({ title: "Talep Alındı", description: "Çekim talebiniz alınmıştır. İşleminiz en kısa sürede gerçekleştirilecektir." });
        setIsWithdrawOpen(false);
        setWithdrawAmount("");
        setWithdrawAccountName("");
        setWithdrawAccountAddress("");
      },
      onError: (err) => {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast({ title: "Hata", description: "Tüm alanları doldurunuz", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Hata", description: "Yeni şifreler eşleşmiyor", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Hata", description: "Şifre en az 6 karakter olmalı", variant: "destructive" });
      return;
    }
    doChangePassword({ data: { currentPassword, newPassword } }, {
      onSuccess: () => {
        toast({ title: "Başarılı", description: "Şifreniz değiştirildi" });
        setIsPasswordOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (err) => {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    });
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId);
      toast({ title: "Kopyalandı", description: "Panoya kopyalandı" });
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {
      toast({ title: "Hata", description: "Kopyalama başarısız oldu", variant: "destructive" });
    });
  };

  const openProfileEdit = () => {
    setProfileEditForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      city: (user as any)?.city || "",
      district: (user as any)?.district || "",
    });
    setIsProfileEditOpen(true);
  };

  const handleProfileUpdate = () => {
    if (!profileEditForm.firstName.trim() || !profileEditForm.lastName.trim()) {
      toast({ title: "Hata", description: "Ad ve soyad zorunludur", variant: "destructive" });
      return;
    }
    doUpdateProfile({ data: profileEditForm }, {
      onSuccess: () => {
        toast({ title: "Profil Güncellendi", description: "Bilgileriniz başarıyla kaydedildi." });
        setIsProfileEditOpen(false);
        refetchUser();
      },
      onError: (err: any) => {
        toast({ title: "Hata", description: err?.message || "Güncelleme başarısız", variant: "destructive" });
      }
    });
  };

  const handleApplyTier = (tier: ApplyForTierBodyTier) => {
    doApplyTier({ data: { tier } }, {
      onSuccess: () => {
        toast({ title: "Başvuru Başarılı", description: "Talebiniz başarıyla oluşturuldu. Detaylı bilgi tarafınıza iletilecektir." });
      },
      onError: (err) => {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    });
  };

  if (!user) return null;

  const bankAddresses = depositAddresses?.filter((a) => a.type === "bank") || [];
  const cryptoAddresses = depositAddresses?.filter((a) => a.type === "crypto") || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      
      <div className="bg-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 md:gap-6 shadow-sm border border-border">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl md:text-3xl font-bold font-display">
          {user.firstName?.[0] ?? "?"}{user.lastName?.[0] ?? ""}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold">{user.firstName} {user.lastName}</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Hesap No: #{user.accountId}</p>
          {(user as any).parentIbName && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
              <span>Referans: <span className="font-semibold text-foreground">{(user as any).parentIbName}</span></span>
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={openProfileEdit}
            className="mt-3 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            <UserCog className="w-3.5 h-3.5 mr-1.5" /> Bilgilerimi Güncelle
          </Button>
        </div>
        <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold text-sm ${
          user.isIdentityVerified ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          {user.isIdentityVerified ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          {user.isIdentityVerified ? 'Onaylı Hesap' : 'Onaysız Hesap'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary"/> Finansal Bilgiler
              <button onClick={() => setShowBalance(!showBalance)} className="ml-auto">
                {showBalance ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              </button>
            </h2>
            <div className="space-y-1">
              {/* Available balance — can withdraw/trade */}
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <div>
                  <span className="text-sm font-medium">Kullanılabilir Bakiye</span>
                  <p className="text-xs text-muted-foreground">Para çekilebilir ve işlem yapılabilir</p>
                </div>
                <span className="font-bold text-lg text-primary tabular-nums">
                  {showBalance ? fmt(portfolio?.availableBalance ?? user.balance) : "****"}
                </span>
              </div>

              {/* T+2 — unsettled from closed trades */}
              {showBalance && (portfolio?.t2Balance ?? 0) > 0 && (
                <div className="flex justify-between items-center py-2.5 border-b border-border/50 bg-amber-500/5 rounded-lg px-2 -mx-2">
                  <div>
                    <span className="text-sm font-medium text-amber-600">T+2 Beklemede</span>
                    <p className="text-xs text-muted-foreground">Kapatılan işlemden 2 iş günü sonra serbest kalır</p>
                  </div>
                  <span className="font-bold text-amber-600 tabular-nums">
                    {fmt(portfolio?.t2Balance ?? 0)}
                  </span>
                </div>
              )}

              {/* Frozen — in open positions */}
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Açık Pozisyonlarda</span>
                  <p className="text-xs text-muted-foreground">Aktif emirlerde kilitli</p>
                </div>
                <span className="font-bold text-muted-foreground tabular-nums">
                  {showBalance ? fmt(user.frozenBalance || 0) : "****"}
                </span>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-muted-foreground">Toplam Varlık</span>
                <span className="font-bold tabular-nums">{showBalance ? fmt(portfolio?.totalValue ?? (user.balance + (user.frozenBalance || 0))) : "****"}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3">
            <Button 
              onClick={() => setIsDepositOpen(true)}
              disabled={!user.isIdentityVerified} 
              className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" /> Para Yatır
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsWithdrawOpen(true)}
              disabled={!user.isIdentityVerified}
              className="flex-1 h-11 border-red-300 text-red-600 hover:bg-red-50"
            >
              <CreditCard className="w-4 h-4 mr-2" /> Para Çek
            </Button>
          </div>
          {!user.isIdentityVerified && (
            <p className="text-xs text-center text-destructive mt-2 font-medium">
              Para işlemleri için kimlik onayı zorunludur.
            </p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary"/> Kimlik Doğrulama
          </h2>
          
          {user.isIdentityVerified ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-14 h-14 bg-success/20 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-success" />
              </div>
              <h3 className="font-bold text-success">Kimliğiniz Onaylandı</h3>
              <p className="text-muted-foreground mt-1 text-sm">Tüm platform özelliklerini kullanabilirsiniz.</p>
            </div>
          ) : user.identityStatus === 'pending' ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mb-3">
                <Clock className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="font-bold text-amber-500">İncelemede</h3>
              <p className="text-muted-foreground mt-1 text-sm">Kimlik belgeleriniz inceleniyor.</p>
            </div>
          ) : (
            <form onSubmit={handleIdentityUpload} className="space-y-3">
              <input ref={frontInputRef} type="file" accept="image/*" className="hidden" onChange={e => setIdentityFront(e.target.files?.[0] || null)} />
              <div
                onClick={() => frontInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/5 transition-colors ${identityFront ? 'border-success bg-success/5' : 'border-border'}`}
              >
                {identityFront ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                    <p className="text-sm font-medium text-success">{identityFront.name}</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Ön Yüz Yükle</p>
                  </>
                )}
              </div>
              <input ref={backInputRef} type="file" accept="image/*" className="hidden" onChange={e => setIdentityBack(e.target.files?.[0] || null)} />
              <div
                onClick={() => backInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/5 transition-colors ${identityBack ? 'border-success bg-success/5' : 'border-border'}`}
              >
                {identityBack ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                    <p className="text-sm font-medium text-success">{identityBack.name}</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Arka Yüz Yükle</p>
                  </>
                )}
              </div>
              <Button type="submit" disabled={isUploading || !identityFront || !identityBack} className="w-full h-11">
                {isUploading ? "Yükleniyor..." : "Belgeleri Gönder"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary"/> Şifre Değiştir
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Hesap güvenliğiniz için şifrenizi düzenli olarak değiştirin.</p>
          <Button variant="outline" onClick={() => setIsPasswordOpen(true)} className="w-full h-11">
            Şifre Değiştir
          </Button>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <LogOut className="w-5 h-5 text-destructive"/> Çıkış Yap
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Hesabınızdan güvenli bir şekilde çıkış yapın.</p>
          <Button variant="outline" onClick={logout} className="w-full h-11 border-destructive/30 text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
          <Diamond className="w-5 h-5 text-primary"/> Hesap Türleri
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
            user.accountType === "diamond" ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700" :
            user.accountType === "gold"    ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700" :
            user.accountType === "silver"  ? "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600" :
                                             "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
          }`}>
            {user.accountType === "diamond" ? "💎 Elmas" :
             user.accountType === "gold"    ? "🥇 Altın" :
             user.accountType === "silver"  ? "🥈 Gümüş" : "Standart"}
          </span>
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { id: "standard" as const, name: "Standart", limit: "100.000 ₺'ye kadar", spread: "Standart", comm: "%0.20", color: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700" },
            { id: "silver" as const, name: "Gümüş", limit: "100K - 250K ₺", spread: "Düşük", comm: "%0.15", color: "bg-zinc-200 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600" },
            { id: "gold" as const, name: "Altın", limit: "250K - 1M ₺", spread: "Çok Düşük", comm: "%0.10", color: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700/50" },
            { id: "diamond" as const, name: "Elmas", limit: "1M ₺ üzeri", spread: "Sıfıra Yakın", comm: "%0.05", color: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800/50" }
          ]).map((tier) => {
            const isCurrent = user.accountType === tier.id;
            const canApply = tier.id !== "standard" && !isCurrent;
            return (
              <div key={tier.name} className={`rounded-xl p-4 border-2 transition-all ${tier.color} ${isCurrent ? 'ring-2 ring-primary/20 shadow-lg' : 'opacity-80 hover:opacity-100'}`}>
                {isCurrent && <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-primary">Mevcut</div>}
                <h3 className="font-display font-bold text-base mb-0.5">{tier.name}</h3>
                <p className="text-[10px] opacity-80 mb-2">{tier.limit}</p>
                <div className="space-y-1 text-xs font-medium">
                  <div className="flex justify-between"><span>Makas:</span> <span>{tier.spread}</span></div>
                  <div className="flex justify-between"><span>Komisyon:</span> <span>{tier.comm}</span></div>
                </div>
                {canApply && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleApplyTier(tier.id)}
                    className="w-full mt-3 bg-white/50 hover:bg-white border-black/10 text-black text-xs h-8"
                  >
                    Başvur
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hesaplarım */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" /> Hesaplarım
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Farklı yatırım araçları için hesap açılış başvurusunda bulunabilirsiniz. Başvurularınız yönetici onayına gönderilir.
        </p>

        {/* Account type selector */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Hesap Türü</label>
          <div className="relative">
            <select
              value={selectedAccountType}
              onChange={(e) => setSelectedAccountType(e.target.value)}
              className="w-full appearance-none bg-background border border-border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="">Hesap türü seçin...</option>
              <option value="viop">VİOP Hesabı</option>
              <option value="fon">Fon Hesabı</option>
              <option value="forex">Forex Hesabı</option>
              <option value="kripto">Kripto Hesabı</option>
              <option value="halka_arz">Halka Arz Hesabı</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Account type cards */}
        {selectedAccountType && (
          <div className="mb-4 p-4 rounded-xl border border-border bg-secondary/10 text-sm space-y-1">
            {selectedAccountType === "viop" && (
              <>
                <p className="font-semibold">VİOP Hesabı</p>
                <p className="text-muted-foreground">Vadeli İşlem ve Opsiyon Piyasası'nda türev araçlarla işlem yapmak için hesap açın.</p>
              </>
            )}
            {selectedAccountType === "fon" && (
              <>
                <p className="font-semibold">Fon Hesabı</p>
                <p className="text-muted-foreground">Yatırım fonları, borsa yatırım fonları (ETF) ve serbest fonlar için hesap açın.</p>
              </>
            )}
            {selectedAccountType === "forex" && (
              <>
                <p className="font-semibold">Forex Hesabı</p>
                <p className="text-muted-foreground">Döviz çiftleri ve emtialar üzerinde kaldıraçlı işlem yapabileceğiniz hesap.</p>
              </>
            )}
            {selectedAccountType === "kripto" && (
              <>
                <p className="font-semibold">Kripto Hesabı</p>
                <p className="text-muted-foreground">Bitcoin, Ethereum ve diğer kripto para birimlerinde işlem yapmak için hesap açın.</p>
              </>
            )}
            {selectedAccountType === "halka_arz" && (
              <>
                <p className="font-semibold">Halka Arz Hesabı</p>
                <p className="text-muted-foreground">Yeni halka arzlara katılabilmek ve birincil piyasada işlem yapabilmek için hesap açın.</p>
              </>
            )}
          </div>
        )}

        <Button
          onClick={handleAccountApplication}
          disabled={isAccountApplying || !selectedAccountType}
          className="w-full h-11"
        >
          {isAccountApplying ? (
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Gönderiliyor...</span>
          ) : (
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Başvur</span>
          )}
        </Button>
      </div>

      {/* Değerli Metaller Hesabı */}
      <MetalAccountSection user={user} />

      {/* Hesaplarım — IB, alt hesap veya metal hesap sahibi kullanıcılar için */}
      {((user as any).isIB || (user as any).parentIbId || (user as any).isMetalAccount || (user as any).metalApplicationStatus === "approved") && <HesaplarimSection user={user} />}

      {/* Hesaplarım Arası Virman — birden fazla bağlı hesabı olan kullanıcılar için */}
      {((user as any).isIB || (user as any).parentIbId || (user as any).isMetalAccount || (user as any).metalApplicationStatus === "approved") && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Hesaplarım Arası Virman</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Hesaplarınız arasında para aktarın — kesintisiz</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsVirmanOpen(true)}
              className="h-9 text-xs px-4 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
            >
              Virman Yap <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <VirmanDialog open={isVirmanOpen} onClose={() => { setIsVirmanOpen(false); refetchUser(); }} />

      {/* İletişim */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" /> İletişim &amp; Destek
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Sorularınız için 7/24 WhatsApp destek hattımıza ulaşabilirsiniz.
        </p>
        <a
          href="https://wa.me/905391364416"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors group"
        >
          <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#25D366]/30 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#25D366] text-base">WhatsApp Destek</p>
            <p className="text-sm text-muted-foreground">+90 539 136 44 16</p>
            <p className="text-xs text-muted-foreground mt-0.5">Mesaj göndermek için tıklayın</p>
          </div>
          <svg className="w-5 h-5 text-[#25D366]/60 group-hover:text-[#25D366] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Para Yükle</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* Sabit bilgilendirme notu — IBAN değişiminden bağımsız */}
            <div className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 p-4 space-y-2">
              <p className="text-sm font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">⚠️ Yatırım Sürecine İlişkin Önemli Bilgilendirme</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="mt-0.5 shrink-0 text-amber-600">•</span>
                  <span>Minimum yatırım tutarı <strong>20.000 TL</strong>'dir.</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="mt-0.5 shrink-0 text-amber-600">•</span>
                  <span>Yatırım işlemi gerçekleştirilirken, açıklama kısmına <strong>ad ve soyad</strong> bilgilerinin eksiksiz şekilde yazılması gerekmektedir.</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="mt-0.5 shrink-0 text-amber-600">•</span>
                  <span>Yatırım işlemi tamamlandıktan sonra ilgili dekontun aşağıdaki <strong>"Dekont Yükle"</strong> alanından yüklenmesi zorunludur.</span>
                </li>
              </ul>
            </div>
            {bankAddresses.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2">Banka Hesap Bilgileri</h3>
                {bankAddresses.map((addr) => (
                  <div key={addr.id} className="bg-secondary/10 rounded-lg p-4 mb-2 text-sm border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{addr.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md p-2">
                      <div>
                        <span className="text-muted-foreground text-xs block">Alıcı Adı</span>
                        <span className="font-medium text-sm">{addr.accountHolder}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(addr.accountHolder!, `holder-${addr.id}`)}
                        className="shrink-0 p-1.5 rounded-md hover:bg-secondary/40 transition-colors"
                        title="Kopyala"
                      >
                        {copiedField === `holder-${addr.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                    {addr.iban && (
                      <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md p-2">
                        <div>
                          <span className="text-muted-foreground text-xs block">IBAN</span>
                          <span className="font-mono text-xs">{addr.iban}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(addr.iban!, `iban-${addr.id}`)}
                          className="shrink-0 p-1.5 rounded-md hover:bg-secondary/40 transition-colors"
                          title="Kopyala"
                        >
                          {copiedField === `iban-${addr.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    )}
                    {(addr as any).note && (
                      <div className="flex items-start gap-2 bg-amber-400/20 border border-amber-500/40 rounded-lg px-3 py-2.5 mt-1">
                        <span className="text-base shrink-0 mt-0.5">⚠️</span>
                        <div>
                          <span className="text-xs font-bold text-amber-300 block mb-0.5">Önemli Not</span>
                          <span className="text-xs text-foreground whitespace-pre-wrap">{(addr as any).note}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {cryptoAddresses.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2">Kripto Cüzdan Adresleri</h3>
                {cryptoAddresses.map((addr) => (
                  <div key={addr.id} className="bg-secondary/10 rounded-lg p-4 mb-2 text-sm border border-border space-y-2">
                    <div className="font-bold text-base">{addr.cryptoNetwork}</div>
                    <div className="flex items-center justify-between gap-2 bg-background/50 rounded-md p-2">
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-xs block">Cüzdan Adresi</span>
                        <span className="font-mono text-xs break-all">{addr.walletAddress}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(addr.walletAddress!, `wallet-${addr.id}`)}
                        className="shrink-0 p-1.5 rounded-md hover:bg-secondary/40 transition-colors"
                        title="Kopyala"
                      >
                        {copiedField === `wallet-${addr.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                    {(addr as any).note && (
                      <div className="flex items-start gap-2 bg-amber-400/20 border border-amber-500/40 rounded-lg px-3 py-2.5">
                        <span className="text-base shrink-0 mt-0.5">⚠️</span>
                        <div>
                          <span className="text-xs font-bold text-amber-300 block mb-0.5">Önemli Not</span>
                          <span className="text-xs text-foreground whitespace-pre-wrap">{(addr as any).note}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(!depositAddresses || depositAddresses.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Henüz bir yatırım adresi tanımlanmamış. Lütfen destek ile iletişime geçiniz.
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Tutar (₺)</label>
              <Input 
                type="number" 
                value={depositAmount} 
                onChange={(e) => setDepositAmount(e.target.value)} 
                className="h-11"
                placeholder="0.00"
              />
            </div>
            <div className="rounded-xl border-2 border-primary/60 bg-primary/5 p-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-primary mb-1">📎 DEKONT / BELGE YÜKLE</p>
              <p className="text-xs text-muted-foreground mb-3">Havale/EFT dekontu, banka makbuzu veya kripto transfer ekran görüntüsü — fotoğraf veya PDF kabul edilir.</p>
              <label className="flex items-center justify-center gap-2 w-full cursor-pointer rounded-lg bg-primary text-white font-bold py-2.5 text-sm hover:bg-primary/90 transition-colors">
                <span>📂 Dosya Seç</span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setDepositFile(e.target.files?.[0] || null)}
                />
              </label>
              {depositFile && (
                <p className="mt-2 text-xs text-green-400 font-medium text-center">✓ {depositFile.name}</p>
              )}
            </div>
            <Button onClick={handleDepositRequest} disabled={isDepositPending} className="w-full h-11">
              {isDepositPending ? "Gönderiliyor..." : "Talep Gönder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Para Çek</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Hesap Adı</label>
              <Input 
                value={withdrawAccountName} 
                onChange={(e) => setWithdrawAccountName(e.target.value)} 
                placeholder="Ad Soyad"
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hesap Adresi (IBAN / Cüzdan)</label>
              <Input 
                value={withdrawAccountAddress} 
                onChange={(e) => setWithdrawAccountAddress(e.target.value)} 
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tutar (₺)</label>
              <Input 
                type="number"
                value={withdrawAmount} 
                onChange={(e) => setWithdrawAmount(e.target.value)} 
                placeholder="0.00"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kullanılabilir: {fmt(portfolio?.availableBalance ?? user.balance)}
                {(portfolio?.t2Balance ?? 0) > 0 && (
                  <span className="text-amber-500 ml-2">· T+2 beklemede: {fmt(portfolio?.t2Balance ?? 0)}</span>
                )}
              </p>
            </div>
            <Button onClick={handleWithdraw} disabled={isWithdrawPending} className="w-full h-11 bg-red-600 hover:bg-red-700">
              {isWithdrawPending ? "İşleniyor..." : "Çekim Talebi Gönder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Şifre Değiştir</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Mevcut Şifre</label>
              <Input 
                type="password"
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Yeni Şifre</label>
              <Input 
                type="password"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Yeni Şifre (Tekrar)</label>
              <Input 
                type="password"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="h-11"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={isPasswordPending} className="w-full h-11">
              {isPasswordPending ? "İşleniyor..." : "Şifreyi Değiştir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileEditOpen} onOpenChange={setIsProfileEditOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" /> Kişisel Bilgileri Güncelle
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              TC kimlik numaranızı değiştirmek için müşteri temsilcimizle iletişime geçiniz.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Ad</label>
                <Input
                  value={profileEditForm.firstName}
                  onChange={e => setProfileEditForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Ad"
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Soyad</label>
                <Input
                  value={profileEditForm.lastName}
                  onChange={e => setProfileEditForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Soyad"
                  className="h-11"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Telefon Numarası</label>
              <Input
                value={profileEditForm.phone}
                onChange={e => setProfileEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="5xxxxxxxxx"
                maxLength={11}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">Rakam olarak giriniz (örn: 5321234567)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Şehir</label>
                <Input
                  value={profileEditForm.city}
                  onChange={e => setProfileEditForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="İstanbul"
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">İlçe</label>
                <Input
                  value={profileEditForm.district}
                  onChange={e => setProfileEditForm(f => ({ ...f, district: e.target.value }))}
                  placeholder="Kadıköy"
                  className="h-11"
                />
              </div>
            </div>
            <Button onClick={handleProfileUpdate} disabled={isProfileSaving} className="w-full h-11">
              {isProfileSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
