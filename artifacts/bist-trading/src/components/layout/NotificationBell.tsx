import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, X, ChevronRight, ExternalLink } from "lucide-react";
import { useGetNotifications, useGetUnreadNotificationCount, useMarkNotificationRead, useMarkAllNotificationsRead, getGetNotificationsQueryKey, getGetUnreadNotificationCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/objects/")) return `/api/image?path=${encodeURIComponent(url)}`;
  return url;
}

const typeIcons: Record<string, string> = {
  deposit_approved: "💰",
  deposit_rejected: "❌",
  withdrawal_approved: "✅",
  withdrawal_rejected: "🚫",
  identity_approved: "🪪",
  identity_rejected: "📛",
  tier_approved: "⬆️",
  tier_rejected: "⬇️",
  broadcast: "📢",
  campaign: "🎉",
  info: "ℹ️",
};

type NotifDetail = {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  imageUrl?: string | null;
  actionUrl?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NotifDetail | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: unreadData } = useGetUnreadNotificationCount({
    query: { refetchInterval: 30_000 },
  });
  const { data: notifications } = useGetNotifications({
    query: { enabled: open },
  });
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const unreadCount = unreadData?.count || 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
  };

  const handleMarkRead = (id: number) => {
    markRead({ id }, { onSuccess: invalidate });
  };

  const handleMarkAllRead = () => {
    markAllRead(undefined, { onSuccess: invalidate });
  };

  const handleNotifClick = (n: NotifDetail) => {
    if (!n.isRead) handleMarkRead(n.id);
    setDetail(n);
  };

  const handleDetailAction = (n: NotifDetail) => {
    if (n.actionUrl) {
      setDetail(null);
      setOpen(false);
      setLocation(n.actionUrl);
    }
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60_000) return "Az önce";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk önce`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} saat önce`;
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-secondary/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-white text-[10px] font-bold rounded-full px-1 animate-in zoom-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/5">
            <h3 className="font-bold text-sm">Bildirimler</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Tümünü Oku
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary/20">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Henüz bildiriminiz yok
              </div>
            ) : (
              (notifications as NotifDetail[]).map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-secondary/10 ${
                    !n.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {typeIcons[n.type] || "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{n.title}</span>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      {n.imageUrl && resolveImageUrl(n.imageUrl) && (
                        <img
                          src={resolveImageUrl(n.imageUrl)}
                          alt={n.title}
                          className="w-full h-20 object-cover rounded-lg mt-2"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">{fmtDate(n.createdAt)}</span>
                        {n.actionUrl && (
                          <span className="text-[10px] text-primary flex items-center gap-0.5">
                            Detay <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Detail dialog */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">{typeIcons[detail.type] || "🔔"}</span>
                <h3 className="font-bold text-base leading-snug">{detail.title}</h3>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="p-1.5 rounded-lg hover:bg-secondary/20 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detail.imageUrl && resolveImageUrl(detail.imageUrl) && (
              <div className="w-full max-h-64 overflow-hidden bg-secondary/10">
                <img
                  src={resolveImageUrl(detail.imageUrl)}
                  alt={detail.title}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                />
              </div>
            )}

            <div className="px-5 py-4 space-y-3">
              {detail.body && (
                <p className="text-sm text-muted-foreground leading-relaxed">{detail.body}</p>
              )}
              <p className="text-xs text-muted-foreground">{fmtDate(detail.createdAt)}</p>
            </div>

            {detail.actionUrl && (
              <div className="px-5 pb-5">
                <button
                  onClick={() => handleDetailAction(detail)}
                  className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Kampanyalara Git
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
