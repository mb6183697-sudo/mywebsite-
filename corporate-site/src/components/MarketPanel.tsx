import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart2, Globe, Cpu, Landmark, Wheat } from "lucide-react";

const CATEGORIES = [
  {
    id: "indices",
    label: "Endeksler",
    Icon: BarChart2,
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    instruments: [
      { name: "BIST 100", detail: "Borsa İstanbul" },
      { name: "NASDAQ 100", detail: "ABD Teknoloji" },
      { name: "S&P 500", detail: "ABD Geniş Piyasa" },
      { name: "DAX 40", detail: "Almanya" },
      { name: "FTSE 100", detail: "İngiltere" },
    ],
  },
  {
    id: "forex",
    label: "Döviz",
    Icon: Globe,
    color: "from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    instruments: [
      { name: "USD/TRY", detail: "Dolar / TL" },
      { name: "EUR/TRY", detail: "Euro / TL" },
      { name: "GBP/TRY", detail: "Sterlin / TL" },
      { name: "EUR/USD", detail: "Euro / Dolar" },
      { name: "GBP/USD", detail: "Sterlin / Dolar" },
    ],
  },
  {
    id: "crypto",
    label: "Kripto",
    Icon: Cpu,
    color: "from-orange-500/20 to-orange-600/10",
    border: "border-orange-500/30",
    iconColor: "text-orange-400",
    instruments: [
      { name: "Bitcoin", detail: "BTC/USD" },
      { name: "Ethereum", detail: "ETH/USD" },
      { name: "BNB", detail: "BNB/USDT" },
      { name: "Solana", detail: "SOL/USDT" },
      { name: "XRP", detail: "XRP/USDT" },
    ],
  },
  {
    id: "bist",
    label: "BIST Hisseleri",
    Icon: Landmark,
    color: "from-violet-500/20 to-violet-600/10",
    border: "border-violet-500/30",
    iconColor: "text-violet-400",
    instruments: [
      { name: "THYAO", detail: "Türk Hava Yolları" },
      { name: "GARAN", detail: "Garanti Bankası" },
      { name: "AKBNK", detail: "Akbank" },
      { name: "EREGL", detail: "Ereğli Demir" },
      { name: "KCHOL", detail: "Koç Holding" },
    ],
  },
  {
    id: "commodities",
    label: "Emtia",
    Icon: Wheat,
    color: "from-yellow-500/20 to-yellow-600/10",
    border: "border-yellow-500/30",
    iconColor: "text-yellow-400",
    instruments: [
      { name: "Altın", detail: "XAUUSD" },
      { name: "Gümüş", detail: "XAGUSD" },
      { name: "Ham Petrol", detail: "USOIL" },
      { name: "Doğal Gaz", detail: "NATGAS" },
      { name: "Bakır", detail: "COPPER" },
    ],
  },
];

export function MarketPanel() {
  const [active, setActive] = useState("bist");
  const current = CATEGORIES.find(c => c.id === active) ?? CATEGORIES[0];

  return (
    <section className="py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="container px-4 relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-4">
            <TrendingUp className="w-4 h-4" />
            Erişilebilir Piyasalar
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
            Küresel Piyasaları <span className="text-gradient">Takip Edin</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Döviz, kripto, endeksler, BIST hisseleri ve emtia — 650+ enstrüman tek platformda.
          </p>
        </motion.div>

        {/* Category tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-6"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                active === cat.id
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              <cat.Icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Active category card */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`rounded-3xl border bg-gradient-to-br ${current.color} ${current.border} overflow-hidden shadow-2xl`}
        >
          {/* Card header */}
          <div className="flex items-center gap-4 px-8 py-6 border-b border-white/10">
            <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center ${current.iconColor}`}>
              <current.Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{current.label}</h3>
              <p className="text-sm text-white/60">İşlem yapılabilir enstrümanlar</p>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-semibold border border-white/10">
                {current.instruments.length} Enstrüman
              </span>
            </div>
          </div>

          {/* Instruments grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {current.instruments.map((inst, i) => (
              <motion.div
                key={inst.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="px-6 py-5 flex flex-col gap-1 hover:bg-white/5 transition-colors"
              >
                <span className="text-lg font-extrabold text-violet-300 tracking-tight">
                  {inst.name}
                </span>
                <span className="text-xs text-white/50 font-medium">{inst.detail}</span>
                <div className="mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-semibold">Canlı</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* All categories mini-grid below */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all duration-200 ${
                active === cat.id
                  ? `bg-gradient-to-br ${cat.color} ${cat.border}`
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <cat.Icon className={`w-5 h-5 ${active === cat.id ? cat.iconColor : "text-muted-foreground"}`} />
              <span className={`text-sm font-bold ${active === cat.id ? "text-white" : "text-foreground"}`}>
                {cat.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {cat.instruments.slice(0, 3).map(inst => (
                  <span key={inst.name} className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                    {inst.name}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { label: "İşlem Yapılabilir Kategori", value: "5", suffix: "Piyasa" },
            { label: "Takip Edilen Enstrüman", value: "650+", suffix: "Sembol" },
            { label: "Gerçek Zamanlı Veri", value: "7/24", suffix: "Canlı" },
            { label: "Platform Güvencesi", value: "%100", suffix: "Güvenli" },
          ].map(item => (
            <div key={item.label} className="bg-white/[0.03] border border-border/30 rounded-2xl p-4 text-center">
              <div className="text-2xl font-extrabold text-primary">{item.value}</div>
              <div className="text-xs text-primary/70 font-semibold uppercase tracking-wider">{item.suffix}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
