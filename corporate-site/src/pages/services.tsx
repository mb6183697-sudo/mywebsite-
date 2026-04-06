import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Check, Activity, BarChart, Smartphone, Laptop, Clock, ArrowRight } from "lucide-react";

export default function Services() {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-20 pb-32 relative overflow-hidden border-b border-border bg-background">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/services-abstract.png`} 
            alt="Services Abstract" 
            className="w-full h-full object-cover opacity-5"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">Hizmetlerimiz</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Yatırım stratejinize uygun, teknoloji odaklı, kesintisiz ve şeffaf çözümler sunuyoruz. Piyasaların hızına yetişmeniz için gereken her şey burada.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Activity className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Spot Piyasa İşlemleri</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                BIST hisse senetlerinde saniyenin kesirlerinde hızla emir gönderin. Gelişmiş emir tipleri (Zincir emir, Kar Al/Zarar Durdur) ile riskinizi otomatik yönetin.
              </p>
              <ul className="space-y-4">
                {["650+ Borsa İstanbul hissesine erişim", "Akıllı tahta ve derinlik verileri", "Komisyonsuz standart işlemler", "Gelişmiş emir tipleri ve algoritmik destek"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border p-8 rounded-3xl shadow-xl relative"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-[2rem] blur opacity-30"></div>
              {/* Abstract trading graphic */}
              <div className="relative h-[300px] bg-background rounded-xl border border-border flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/10 to-transparent"></div>
                <div className="flex items-end gap-2 w-full h-full pb-4">
                  {[40, 60, 45, 80, 55, 90, 75, 100].map((h, i) => (
                    <div key={i} className="flex-1 bg-primary/80 rounded-t-sm" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center flex-row-reverse">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border p-8 rounded-3xl shadow-xl relative lg:order-1 order-2"
            >
              <div className="absolute -inset-1 bg-gradient-to-l from-primary/20 to-purple-500/20 rounded-[2rem] blur opacity-30"></div>
              {/* Abstract analysis graphic */}
              <div className="relative h-[300px] bg-background rounded-xl border border-border flex flex-col items-center justify-center p-6 gap-4">
                <div className="w-full h-12 bg-accent rounded-lg"></div>
                <div className="w-full h-12 bg-accent rounded-lg w-5/6 mr-auto"></div>
                <div className="w-full h-12 bg-primary/10 border border-primary/20 rounded-lg w-4/6 mr-auto flex items-center px-4"><span className="text-primary font-bold text-sm">AL Sinyali Aktif</span></div>
                <div className="w-full h-12 bg-accent rounded-lg w-3/6 mr-auto"></div>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:order-2 order-1"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <BarChart className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Uzman Analizleri</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Yalnız değilsiniz. SPK lisanslı araştırma ekibimizin hazırladığı bültenler, model portföyler ve anlık teknik analiz uyarılarıyla piyasayı profesyoneller gibi okuyun.
              </p>
              <ul className="space-y-4">
                {["Günlük sabah ve akşam bültenleri", "Teknik ve temel hisse analizleri", "Sektörel raporlar", "Model portföy güncellemeleri"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Account Tiers */}
      <section className="py-24 bg-accent/20 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Hesap Tipleri</h2>
            <p className="text-muted-foreground text-lg">Yatırım tarzınıza en uygun hesabı seçin, size özel avantajlardan hemen faydalanmaya başlayın.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Standard */}
            <div className="bg-card border border-border p-8 rounded-3xl flex flex-col">
              <h3 className="text-2xl font-bold text-foreground mb-2">Standart</h3>
              <p className="text-muted-foreground mb-6">Yeni başlayanlar için ideal</p>
              <div className="text-4xl font-display font-bold text-foreground mb-8">Ücretsiz</div>
              <ul className="space-y-4 mb-8 flex-1">
                {["Canlı veriler", "₺0 İşlem Komisyonu", "Temel analiz raporları", "Standart müşteri desteği"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-full text-center border border-border hover:bg-accent transition-colors font-semibold text-foreground">
                Standart Seç
              </a>
            </div>

            {/* Pro */}
            <div className="bg-white border border-primary/30 p-8 rounded-3xl flex flex-col relative transform md:-translate-y-4 shadow-xl shadow-primary/10">
              <div className="absolute top-0 inset-x-0 h-1 bg-primary rounded-t-3xl"></div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                En Popüler
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">Aktif yatırımcılar için</p>
              <div className="text-4xl font-display font-bold text-foreground mb-2">₺99<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
              <p className="text-xs text-primary mb-6">Aylık 1M₺ hacimde ücretsiz</p>
              <ul className="space-y-4 mb-8 flex-1">
                {["Derinlik ve Kademe analizi (Karma)", "Hızlı emir pencereleri", "VIP müşteri temsilcisi", "Anlık teknik sinyaller", "Özel model portföy"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-full text-center bg-primary text-primary-foreground hover:scale-105 transition-all font-semibold shadow-lg shadow-primary/20">
                Pro'ya Geç
              </a>
            </div>

            {/* Elite */}
            <div className="bg-card border border-border p-8 rounded-3xl flex flex-col">
              <h3 className="text-2xl font-bold text-foreground mb-2">Elite</h3>
              <p className="text-muted-foreground mb-6">Profesyoneller için sınırsız güç</p>
              <div className="text-4xl font-display font-bold text-foreground mb-8">₺299<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {["Tüm Pro özellikleri", "Algoritmik işlem API erişimi", "Özel yatırım danışmanı", "Yüksek hacim iadeleri", "Öncelikli halka arz katılımı"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="https://sube.binyatirimlar.com/" target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-full text-center border border-border hover:bg-accent transition-colors font-semibold text-foreground">
                Elite Keşfet
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
