import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ArrowRight, Lock, Phone, User as UserIcon, CalendarDays, ShieldCheck, TrendingUp, CreditCard, Tag, Copy, Check, KeyRound } from "lucide-react";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showForgotForm, setShowForgotForm] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Login Form
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: doLogin, isPending: isLoggingIn } = useLogin();

  // Forgot Password Form
  const [forgotTcNo, setForgotTcNo] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isLoadingForgot, setIsLoadingForgot] = useState(false);
  const [copied, setCopied] = useState(false);

  // Register Form
  const [regData, setRegData] = useState({
    firstName: "", lastName: "", tcNo: "", birthDate: "", city: "", district: "", phone: "", password: "", confirmPassword: "", referralCode: ""
  });
  const { mutate: doRegister, isPending: isRegistering } = useRegister();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const val = identifier.trim();
    // If 11 digits → TC kimlik, otherwise → IB account number
    const isTC = /^\d{11}$/.test(val);
    doLogin({ data: isTC ? { tcNo: val, password } : { accountId: val, password } as any }, {
      onSuccess: (res) => {
        login(res.token);
        // mustChangePassword check is handled by use-auth redirect
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "Giriş Başarısız", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const tc = forgotTcNo.trim();
    if (!/^\d{11}$/.test(tc)) {
      toast({ title: "Hata", description: "11 haneli TC Kimlik No giriniz", variant: "destructive" });
      return;
    }
    setIsLoadingForgot(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tcNo: tc }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: data.message || "Hesap bulunamadı", variant: "destructive" });
        return;
      }
      setTempPassword(data.tempPassword);
    } catch {
      toast({ title: "Hata", description: "Bir hata oluştu, tekrar deneyin", variant: "destructive" });
    } finally {
      setIsLoadingForgot(false);
    }
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const validateTcNo = (tc: string): boolean => {
    if (!/^\d{11}$/.test(tc) || tc[0] === "0") return false;
    const d = tc.split("").map(Number);
    return ((d[0]+d[2]+d[4]+d[6]+d[8])*7-(d[1]+d[3]+d[5]+d[7]))%10===d[9] && d.slice(0,10).reduce((a,b)=>a+b,0)%10===d[10];
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      toast({ title: "Hata", description: "Şifreler uyuşmuyor.", variant: "destructive" });
      return;
    }
    if (!validateTcNo(regData.tcNo)) {
      toast({ title: "Hata", description: "Geçersiz TC kimlik numarası. 11 haneli geçerli bir TC giriniz.", variant: "destructive" });
      return;
    }
    const cleanPhone = regData.phone.replace(/\D/g, "");
    if (!/^5\d{9}$/.test(cleanPhone)) {
      toast({ title: "Hata", description: "Geçersiz telefon numarası. 5 ile başlayan 10 haneli numara giriniz.", variant: "destructive" });
      return;
    }
    doRegister({ data: regData }, {
      onSuccess: (res) => {
        login(res.token);
        setLocation("/");
      },
      onError: (err) => {
        toast({ title: "Kayıt Başarısız", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Visuals */}
      <div className="hidden lg:flex flex-1 relative bg-primary items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Background" 
            className="w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
        </div>
        
        <div className="relative z-10 text-primary-foreground max-w-md px-12">
          <img 
            src={`${import.meta.env.BASE_URL}images/logo_1000_nobg.png`} 
            alt="1000 Yatırımlar Logo" 
            className="h-16 object-contain mb-8 filter brightness-0 invert"
          />
          <h1 className="text-4xl font-display font-bold leading-tight mb-6">
            Borsada Geleceğe Yatırım Yapın
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
            Hisse senedi piyasalarında anlık verilerle işlem yapın, portföyünüzü güvenle yönetin.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
              <ShieldCheck className="w-6 h-6 text-success" />
              <span>SPK Denetiminde Güvenilir Altyapı</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <span>Anlık Veriler & Düşük Komisyon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Forms */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 py-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="text-center lg:hidden mb-8">
            <img 
              src={`${import.meta.env.BASE_URL}images/logo_1000_nobg.png`} 
              alt="Logo" 
              className="h-12 object-contain mx-auto"
            />
          </div>

          <div className="flex bg-secondary/10 p-1 rounded-2xl">
            <button
              onClick={() => { setTab("login"); setShowForgotForm(false); setTempPassword(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                tab === "login" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => { setTab("register"); setShowForgotForm(false); setTempPassword(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                tab === "register" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hesap Oluştur
            </button>
          </div>

          {tab === "login" ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!showForgotForm ? (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-4">
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input 
                        required
                        type="text"
                        placeholder="TC Kimlik No" 
                        className="pl-12 h-14 rounded-xl border-2 focus:ring-4 focus:ring-primary/10"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input 
                        required type="password" placeholder="Şifre" 
                        className="pl-12 h-14 rounded-xl border-2 focus:ring-4 focus:ring-primary/10"
                        value={password} onChange={e => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={isLoggingIn} className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                    {isLoggingIn ? "Giriş Yapılıyor..." : "Giriş Yap"} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotForm(true)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      Şifremi unuttum
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      type="button"
                      onClick={() => { setShowForgotForm(false); setTempPassword(null); setForgotTcNo(""); }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      ← Geri dön
                    </button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" /> Geçici Şifre Al
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      TC Kimlik Numaranızı girin. Sisteme kayıtlı hesabınıza geçici bir şifre oluşturulacak ve giriş sonrası yeni şifre belirlemeniz istenecektir.
                    </p>
                  </div>

                  {!tempPassword ? (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          required
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="TC Kimlik Numaranız"
                          className="pl-12 h-14 rounded-xl border-2 focus:ring-4 focus:ring-primary/10"
                          value={forgotTcNo}
                          onChange={e => setForgotTcNo(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <Button type="submit" disabled={isLoadingForgot} className="w-full h-14 text-base font-bold rounded-xl">
                        {isLoadingForgot ? "Oluşturuluyor..." : "Geçici Şifre Oluştur"} <KeyRound className="ml-2 w-5 h-5" />
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-5 space-y-3">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-300">Geçici şifreniz oluşturuldu!</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-white dark:bg-gray-900 border-2 border-green-300 dark:border-green-600 rounded-lg px-4 py-3 font-mono text-xl font-bold tracking-widest text-center text-green-800 dark:text-green-300 select-all">
                            {tempPassword}
                          </div>
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="flex items-center gap-1 px-3 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shrink-0"
                            title="Kopyala"
                          >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-400">
                          Bu şifreyi kopyalayın ve giriş yaptıktan sonra yeni bir şifre belirlemeniz gerekecektir.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setIdentifier(forgotTcNo);
                          setPassword(tempPassword);
                          setShowForgotForm(false);
                          setTempPassword(null);
                          setForgotTcNo("");
                        }}
                        className="w-full h-14 text-base font-bold rounded-xl"
                      >
                        Giriş Ekranına Dön <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <Input required placeholder="Adınız" value={regData.firstName} onChange={e => setRegData({...regData, firstName: e.target.value})} className="h-12 rounded-xl" />
                <Input required placeholder="Soyadınız" value={regData.lastName} onChange={e => setRegData({...regData, lastName: e.target.value})} className="h-12 rounded-xl" />
              </div>
              
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input required placeholder="TC Kimlik No (11 Hane)" maxLength={11} value={regData.tcNo} onChange={e => setRegData({...regData, tcNo: e.target.value})} className="pl-10 h-12 rounded-xl" />
              </div>
              
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="Doğum Tarihi (GG.AA.YYYY)"
                  maxLength={10}
                  value={regData.birthDate}
                  onChange={e => {
                    let v = e.target.value.replace(/[^\d.]/g, "");
                    const digits = v.replace(/\./g, "");
                    if (digits.length <= 2) v = digits;
                    else if (digits.length <= 4) v = digits.slice(0, 2) + "." + digits.slice(2);
                    else v = digits.slice(0, 2) + "." + digits.slice(2, 4) + "." + digits.slice(4, 8);
                    setRegData({ ...regData, birthDate: v });
                  }}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input required placeholder="İl" value={regData.city} onChange={e => setRegData({...regData, city: e.target.value})} className="h-12 rounded-xl" />
                <Input required placeholder="İlçe" value={regData.district} onChange={e => setRegData({...regData, district: e.target.value})} className="h-12 rounded-xl" />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input required type="tel" placeholder="Telefon" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} className="pl-10 h-12 rounded-xl" />
              </div>

              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Referans Kodu (opsiyonel)"
                  value={regData.referralCode}
                  onChange={e => setRegData({...regData, referralCode: e.target.value.toUpperCase()})}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input required type="password" placeholder="Şifre" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="h-12 rounded-xl" />
                <Input required type="password" placeholder="Şifre Tekrarı" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="h-12 rounded-xl" />
              </div>

              <Button type="submit" disabled={isRegistering} className="w-full h-14 mt-4 text-lg font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                {isRegistering ? "Oluşturuluyor..." : "Hesap Oluştur"} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
