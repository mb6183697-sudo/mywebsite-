import { Layout } from "@/components/layout/Layout";
import { MarketPanel } from "@/components/MarketPanel";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, ShieldCheck, Zap, LineChart, Wallet, Smartphone, Star, Quote, Building2, Timer, Percent, Lock, CheckCircle2, TrendingUp, Users } from "lucide-react";

export default function Home() {
  const FADE_UP = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const STAGGER = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <Layout>
      {/* HERO SECTION */}
      <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-background pt-20">
        {/* Background Decorative */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-primary/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 blur-[100px] rounded-full" />
          <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full" />
        </div>

        <div className="container relative z-10 px-4 py-20 text-center lg:text-left flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            className="flex-1"
            initial="hidden"
            animate="visible"
            variants={STAGGER}
          >
            <motion.h1 variants={FADE_UP} className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold text-foreground leading-[1.1] mb-8">
              Türkiye'nin En <br className="hidden lg:block"/>
              <span className="text-gradient">Güvenilir</span> BIST <br className="hidden lg:block"/>
              Trading Platformu
            </motion.h1>
            
            <motion.p variants={FADE_UP} className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
              Gerçek zamanlı verilerle 650+ BIST hissesinde işlem yapın. Komisyonsuz işlemler, derinlik analizleri ve anlık sinyallerle yatırımlarınıza yön verin.
            </motion.p>
            
            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-2 px-8 py-5 text-lg font-bold rounded-full bg-primary text-primary-foreground overflow-hidden transition-all hover:scale-105 shadow-2xl shadow-primary/30 hover:shadow-primary/50">
                <span className="relative z-10 flex items-center gap-2">
                  Hemen Kayıt Ol <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              </a>
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-5 text-lg font-bold rounded-full bg-white/60 backdrop-blur-md border border-black/5 hover:bg-white/90 transition-all text-foreground shadow-xl">
                Ücretsiz Hesap Aç <ArrowRight className="w-6 h-6 text-primary" />
              </a>
            </motion.div>
          </motion.div>

          <motion.div 
            className="flex-1 w-full relative hidden lg:block"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            {/* Rich Hero Mockup */}
            <div className="relative w-full max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-indigo-500/30 rounded-[3rem] transform rotate-3 blur-2xl scale-105"></div>
              
              <img 
                src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
                alt="Trading Interface" 
                className="relative w-full h-auto rounded-[2rem] border-8 border-white/40 shadow-2xl backdrop-blur-sm object-cover aspect-[4/3] z-10 bg-white"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1000";
                }}
              />
              
              {/* Floating Stat Card */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="absolute -bottom-10 -left-10 z-20 bg-white p-6 rounded-2xl shadow-2xl border border-border flex items-center gap-6"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Günlük Getiri</p>
                  <p className="text-3xl font-display font-bold text-foreground">+₺12,450.00</p>
                  <p className="text-sm font-semibold text-green-600 mt-1 flex items-center gap-1">
                    <ArrowRight className="w-4 h-4 -rotate-45" /> +4.2%
                  </p>
                </div>
              </motion.div>

              {/* Floating Element 2 */}
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="absolute -top-8 -right-8 z-20 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-border flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Emir İletildi</p>
                  <p className="text-xs text-muted-foreground">50ms'de gerçekleşti</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-border bg-white relative z-20 shadow-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border">
            {[
              { icon: BarChart3, label: "Canlı Hisse", value: "650+" },
              { icon: Percent, label: "İşlem Komisyonu", value: "₺0" },
              { icon: Timer, label: "Uzman Destek", value: "7/24" },
              { icon: Users, label: "Mutlu Kullanıcı", value: "100K+" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-4xl md:text-5xl lg:text-6xl font-display font-black text-foreground mb-2">{stat.value}</div>
                <div className="text-sm md:text-base font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE MARKET PANEL */}
      <MarketPanel />

      {/* NEDEN BIZ SECTION */}
      <section className="py-24 md:py-32 relative bg-background overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-bold tracking-widest uppercase mb-4 text-sm md:text-base">Neden Biz?</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold mb-6 text-foreground leading-tight">Yatırımda Yeni Standart</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, title: "Lisanslı & Denetimli", desc: "SPK lisanslı ve düzenleyici kurumların denetimi altında, güvenli yatırım altyapısı.", number: "01" },
              { icon: Zap, title: "Türkiye'nin En Hızlısı", desc: "Gelişmiş teknolojik altyapımızla emirleriniz ortalama 50ms'de piyasaya iletilir.", number: "02" },
              { icon: Percent, title: "Sıfır Komisyon", desc: "Tüm BIST hisse senedi işlemlerinde sıfır komisyon avantajıyla kazancınızı artırın.", number: "03" }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-card border-2 border-border p-10 rounded-[2rem] hover:border-primary transition-all duration-300 group overflow-hidden"
              >
                <div className="absolute -right-8 -top-8 text-9xl font-black text-primary/[0.03] group-hover:text-primary/[0.05] transition-colors">{feature.number}</div>
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary transition-all duration-500 relative z-10">
                  <feature.icon className="w-10 h-10 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h4 className="text-2xl font-bold mb-4 text-foreground relative z-10">{feature.title}</h4>
                <p className="text-muted-foreground text-lg leading-relaxed relative z-10">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="ozellikler" className="py-24 md:py-32 relative bg-accent/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-bold tracking-widest uppercase mb-4 text-sm md:text-base">Platform Özellikleri</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold mb-6 text-foreground leading-tight">Her Şey Kontrolünüz Altında</h3>
            <p className="text-muted-foreground text-xl">Modern arayüzümüz ve gelişmiş altyapımızla piyasaları anlık takip edin, fırsatları kaçırmayın.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: BarChart3, title: "Gerçek Zamanlı Fiyatlar", desc: "BIST verilerine gecikmesiz, anlık olarak ulaşın. Derinlik ve kademe analizleriyle pazarın nabzını tutun." },
              { icon: Lock, title: "Güvenli İşlemler", desc: "Banka seviyesinde güvenlik altyapısı ve uçtan uca şifreleme ile yatırımlarınız güvence altında." },
              { icon: Timer, title: "Anlık Bildirimler", desc: "Fiyat alarmları ve KAP haberleri anında cebinizde. Piyasada olan biten her şeyden ilk siz haberdar olun." },
              { icon: LineChart, title: "Uzman Tavsiyeleri", desc: "Uzman analistlerimizin hazırladığı günlük model portföyler ve hisse analizlerine ücretsiz erişin." },
              { icon: Wallet, title: "Kolay Para Transferi", desc: "Anlaşmalı bankalarımızla 7/24 kesintisiz, anında ve ücretsiz para yatırma ve çekme işlemleri." },
              { icon: Smartphone, title: "Mobil Uyumlu", desc: "İster webden ister telefondan, nerede olursanız olun yatırımlarınızı kolayca yönetin." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gradient-to-br from-card to-accent/50 border border-border/60 p-10 rounded-[2rem] hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform duration-500">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h4 className="text-2xl font-bold mb-4 text-foreground">{feature.title}</h4>
                <p className="text-muted-foreground text-lg leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none transform -translate-y-1/2" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-primary font-bold tracking-widest uppercase mb-4 text-sm md:text-base">Nasıl Çalışır?</h2>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold mb-8 text-foreground leading-tight">Sadece 3 Adımda Başlayın</h3>
              <p className="text-muted-foreground text-xl mb-12">Uzun formlar, karmaşık onay süreçleri yok. Dakikalar içinde hesabınızı oluşturun ve borsaya adım atın.</p>
              
              <div className="flex flex-col gap-10">
                {[
                  { num: "1", title: "Kayıt Ol", desc: "TC Kimlik numaranız ve temel bilgilerinizle güvenli profilinizi oluşturun." },
                  { num: "2", title: "Hesabını Doğrula", desc: "Gelişmiş biyometrik doğrulama sistemimizle saniyeler içinde kimliğinizi onaylayın." },
                  { num: "3", title: "İşlem Yapmaya Başla", desc: "Anında para transferi yapın ve ilk hisse senedinizi hemen alın." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="shrink-0 w-16 h-16 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-center justify-center font-display font-bold text-primary text-2xl relative group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors duration-300">
                      {step.num}
                      {i !== 2 && <div className="absolute top-16 bottom-[-2.5rem] w-0.5 bg-gradient-to-b from-primary/30 to-transparent"></div>}
                    </div>
                    <div className="pt-2">
                      <h4 className="text-2xl font-bold mb-3 text-foreground">{step.title}</h4>
                      <p className="text-muted-foreground text-lg leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative aspect-square max-w-lg mx-auto w-full"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
              <img 
                src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1000" 
                alt="Trading Interface" 
                className="w-full h-full object-cover rounded-[3rem] border-8 border-white/50 shadow-2xl relative z-10"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 md:py-32 bg-background border-t border-border relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold mb-6 text-foreground">Yatırımcılar Ne Diyor?</h3>
            <p className="text-muted-foreground text-xl">Binlerce yatırımcının tercih ettiği 1000 Yatırımlar platformuyla tanışın.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Ahmet Y.", role: "Bireysel Yatırımcı", text: "Uygulamanın hızı muazzam. Emirlerim saniyeler içinde gerçekleşiyor. Sıfır komisyon olması da cabası." },
              { name: "Ayşe K.", role: "Portföy Yöneticisi", text: "Özellikle derinlik analizleri ve anlık fiyat bildirimleri günlük işlemlerimde en büyük yardımcım oldu." },
              { name: "Can T.", role: "Day Trader", text: "Birçok platform denedim ama arayüzü en temiz ve anlaşılır olanı kesinlikle 1000 Yatırımlar." }
            ].map((t, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border p-10 rounded-[2rem] relative shadow-lg hover:shadow-xl transition-shadow"
              >
                <Quote className="absolute top-8 right-8 w-12 h-12 text-primary/10" />
                <div className="flex text-yellow-400 mb-6 gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-5 h-5 fill-current" />)}
                </div>
                <p className="text-muted-foreground text-lg mb-8 leading-relaxed relative z-10">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">{t.name}</h4>
                    <p className="text-sm text-primary font-medium">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* GUVENLIK & LISANS SECTION */}
      <section className="py-16 bg-white border-y border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-foreground" />
              <span className="font-bold text-lg text-foreground">SPK Lisanslı</span>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-foreground" />
              <span className="font-bold text-lg text-foreground">BDDK Uyumlu</span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-foreground" />
              <span className="font-bold text-lg text-foreground">256-bit SSL</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-foreground" />
              <span className="font-bold text-lg text-foreground">Ayrı Müşteri Hesapları</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-indigo-900" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-[0.05] mix-blend-overlay" />
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-white/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-black/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold mb-8 text-white leading-tight">
              Geleceğinize <br className="hidden md:block"/> Yatırım Yapın
            </h2>
            <p className="text-xl md:text-2xl text-white/80 mb-12 font-light">
              Bugün ücretsiz hesabınızı açın, borsadaki fırsatları kaçırmayın.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-5 text-xl font-bold rounded-full bg-white text-primary hover:scale-105 transition-all shadow-2xl">
                Ücretsiz Kayıt Ol <ArrowRight className="w-6 h-6" />
              </a>
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-5 text-xl font-bold rounded-full bg-black/20 text-white hover:bg-black/30 border border-white/20 transition-all backdrop-blur-md">
                Hemen Başla <ArrowRight className="w-6 h-6" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
