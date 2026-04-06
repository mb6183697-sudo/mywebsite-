import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  subject: z.string().min(5, "Konu en az 5 karakter olmalıdır"),
  message: z.string().min(10, "Mesajınız en az 10 karakter olmalıdır"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    
    toast({
      title: "Mesajınız Gönderildi",
      description: "En kısa sürede size dönüş yapacağız. Teşekkürler!",
    });
    
    form.reset();
  };

  return (
    <Layout>
      <section className="pt-20 pb-32">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-6">İletişime Geçin</h1>
            <p className="text-xl text-muted-foreground">
              Sorularınız, önerileriniz veya destek ihtiyaçlarınız için 7/24 yanınızdayız.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Contact Info */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1 space-y-8"
            >
              <div className="bg-card border border-border p-8 rounded-3xl h-full">
                <h3 className="text-2xl font-bold mb-8">İletişim Bilgileri</h3>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Adres</h4>
                      <p className="text-muted-foreground text-sm">Levent, Büyükdere Cd. No:195, 34394<br />Şişli/İstanbul</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Telefon</h4>
                      <p className="text-muted-foreground text-sm">+90 (850) 123 45 67</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">E-posta</h4>
                      <p className="text-muted-foreground text-sm">destek@binyatirimlar.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Çalışma Saatleri</h4>
                      <p className="text-muted-foreground text-sm">Destek: 7/24<br />Operasyon: Pzt-Cuma 09:00-18:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2"
            >
              <div className="bg-card border border-border p-8 md:p-10 rounded-3xl relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
                
                <h3 className="text-2xl font-bold mb-8 relative z-10 text-foreground">Mesaj Gönderin</h3>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative z-10">
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Ad Soyad</FormLabel>
                            <FormControl>
                              <Input placeholder="Ahmet Yılmaz" className="bg-background border-border focus:border-primary/50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">E-posta</FormLabel>
                            <FormControl>
                              <Input placeholder="ahmet@ornek.com" className="bg-background border-border focus:border-primary/50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Konu</FormLabel>
                          <FormControl>
                            <Input placeholder="Nasıl yardımcı olabiliriz?" className="bg-background border-border focus:border-primary/50" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Mesaj</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Detaylı mesajınızı buraya yazabilirsiniz..." 
                              className="min-h-[150px] bg-background border-border focus:border-primary/50 resize-none" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 shadow-md shadow-primary/20"
                    >
                      {isSubmitting ? "Gönderiliyor..." : (
                        <>Gönder <Send className="w-5 h-5" /></>
                      )}
                    </button>
                  </form>
                </Form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
