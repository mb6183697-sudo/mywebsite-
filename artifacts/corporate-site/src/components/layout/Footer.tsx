import { Link } from "wouter";
import { TrendingUp, Twitter, Linkedin, Instagram, Mail, MapPin, Phone } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-background border-t border-border pt-16 pb-8 relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Brand */}
          <div className="flex flex-col gap-6">
            <Link href="/" className="flex items-center gap-2 group outline-none w-fit">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo_1000_nobg.png`} 
                alt="1000 Yatırımlar Logo" 
                className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Türkiye'nin en yenilikçi ve güvenilir BIST spot işlem platformu. Gerçek zamanlı veriler, sıfır komisyon ve uzman destek ile yatırımlarınıza yön verin.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border">
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-foreground">Hızlı Linkler</h3>
            <ul className="flex flex-col gap-4">
              <li><Link href="/" className="text-muted-foreground hover:text-primary transition-colors text-sm">Ana Sayfa</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors text-sm">Hakkımızda</Link></li>
              <li><Link href="/services" className="text-muted-foreground hover:text-primary transition-colors text-sm">Hizmetler</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors text-sm">İletişim</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-foreground">Yasal</h3>
            <ul className="flex flex-col gap-4">
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Kullanıcı Sözleşmesi</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Gizlilik Politikası</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">KVKK Aydınlatma Metni</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">Risk Bildirimi</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-foreground">İletişim</h3>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <span>Levent, Büyükdere Cd. No:195, 34394 Şişli/İstanbul</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span>+90 (850) 123 45 67</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <a
                  href="https://wa.me/905391364416"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[#25D366] hover:text-[#1aab53] transition-colors font-medium"
                >
                  <WhatsAppIcon className="w-5 h-5 shrink-0" />
                  <span>+90 539 136 44 16</span>
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <span>destek@binyatirimlar.com</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 1000 Yatırımlar. Tüm hakları saklıdır.
          </p>
          <p className="text-xs text-muted-foreground/50 text-center md:text-right max-w-xl">
            Sermaye piyasası işlemleri risk içerir. İşlem yapmadan önce risk profilinizi değerlendirmeniz ve gerekli araştırmaları yapmanız önerilir.
          </p>
        </div>
      </div>
    </footer>
  );
}
