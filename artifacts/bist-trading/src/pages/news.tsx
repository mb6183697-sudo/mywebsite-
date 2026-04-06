import { useState } from "react";
import { useGetNews, useGetCampaigns } from "@workspace/api-client-react";
import type { CampaignItem } from "@workspace/api-client-react";
import { formatDateTime } from "@/lib/utils";
import { ExternalLink, Newspaper, Gift, TrendingUp, X, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS: Record<string, string> = {
  "BIST": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Ekonomi": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Kur": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Şirket Haberleri": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/objects/")) return `/api/image?path=${encodeURIComponent(url)}`;
  return url;
}

function NewsImage({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <TrendingUp className="w-6 h-6 text-primary/60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-secondary/20"
    />
  );
}

export default function NewsPage() {
  const { data: news, isLoading } = useGetNews({ query: { refetchInterval: 5 * 60 * 1000 } });
  const { data: campaigns } = useGetCampaigns();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);

  const handleNewsClick = (url?: string) => {
    if (url) setRedirectUrl(url);
  };

  const confirmRedirect = () => {
    if (redirectUrl) {
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
      setRedirectUrl(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
      {campaigns && campaigns.length > 0 && (
        <div>
          <div className="flex items-center gap-3 pb-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center">
              <Gift className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">Kampanyalar & Fırsatlar</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign: CampaignItem) => {
              const imgSrc = resolveImageUrl(campaign.imageUrl);
              return (
                <div
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="bg-card rounded-2xl overflow-hidden border border-border hover:shadow-lg hover:border-amber-500/40 transition-all cursor-pointer group"
                >
                  {imgSrc ? (
                    <div className="w-full h-44 overflow-hidden bg-secondary/10">
                      <img
                        src={imgSrc}
                        alt={campaign.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                      <Gift className="w-10 h-10 text-amber-500/60" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-base mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{campaign.title}</h3>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{campaign.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-3 font-medium">
                      Detayları Gör <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kampanya Detay Modal */}
      {selectedCampaign && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedCampaign(null); }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base leading-snug">{selectedCampaign.title}</h3>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-1.5 rounded-lg hover:bg-secondary/20 text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resolveImageUrl(selectedCampaign.imageUrl) && (
              <div className="w-full max-h-72 overflow-hidden bg-secondary/10">
                <img
                  src={resolveImageUrl(selectedCampaign.imageUrl)}
                  alt={selectedCampaign.title}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                />
              </div>
            )}

            <div className="px-5 py-5 space-y-4">
              {selectedCampaign.description && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedCampaign.description}</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedCampaign(null)}
              >
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Newspaper className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Piyasa Haberleri</h1>
          <p className="text-muted-foreground text-sm">Güncel finansal haberler</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {news?.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNewsClick(item.url)}
              className="flex items-center gap-4 bg-card rounded-2xl px-4 py-3 border border-border hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer"
            >
              <NewsImage src={item.imageUrl} title={item.title} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/20 text-muted-foreground">
                    {item.source}
                  </span>
                  {item.category && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category] || "bg-secondary/20 text-muted-foreground"}`}>
                      {item.category}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {formatDateTime(item.publishedAt)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors leading-snug line-clamp-2">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                    {item.summary}
                  </p>
                )}
              </div>

              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!redirectUrl} onOpenChange={() => setRedirectUrl(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Dış Kaynağa Yönlendirme</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Haberin kaynak sayfasına yönlendirileceksiniz. Devam etmek istiyor musunuz?
            </p>
            <p className="text-xs text-muted-foreground font-mono bg-secondary/10 p-2 rounded break-all">
              {redirectUrl}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRedirectUrl(null)} className="flex-1">
                İptal
              </Button>
              <Button onClick={confirmRedirect} className="flex-1">
                Devam Et
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
