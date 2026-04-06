import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Target, Eye, Shield, Users } from "lucide-react";

export default function About() {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-20 pb-32 relative overflow-hidden border-b border-border bg-background">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/about-globe.png`} 
            alt="About Global Reach" 
            className="w-full h-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 text-foreground">Biz Kimiz?</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              1000 Yatırımlar, finansal piyasaları herkes için erişilebilir, şeffaf ve teknolojik hale getirmek amacıyla kurulmuş yeni nesil bir aracı kurum platformudur.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border p-10 rounded-3xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-4">Misyonumuz</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Yatırımcılara en hızlı, en güvenilir ve en düşük maliyetli piyasa erişimini sunmak. Karmaşık finansal araçları basitleştirerek, kullanıcılarımızın bilinçli ve kârlı kararlar almalarını sağlamak.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border p-10 rounded-3xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-4">Vizyonumuz</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Türkiye'nin en büyük, en teknolojik ve en çok güvenilen yatırım ekosistemi olmak. Yerel piyasalardan küresel piyasalara uzanan köprüde öncü rol oynamak.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-accent/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">Değerlerimiz</h2>
            <p className="text-muted-foreground text-lg">Bizi biz yapan, iş yapış şeklimizi belirleyen temel prensiplerimiz.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "Güven ve Şeffaflık", desc: "Tüm işlemlerimizde maksimum şeffaflık ve müşteri güvenliğini en üst planda tutarız." },
              { icon: Zap, title: "İnovasyon", desc: "Teknolojiyi yakından takip eder, altyapımızı sürekli geliştirerek en hızlı hizmeti sunarız." },
              { icon: Users, title: "Müşteri Odaklılık", desc: "Her bir yatırımcımızın ihtiyacını dinler, onlara özel çözümler ve destek sağlarız." }
            ].map((v, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center px-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-card border border-border flex items-center justify-center mb-6 shadow-lg shadow-black/5">
                  <v.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{v.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
