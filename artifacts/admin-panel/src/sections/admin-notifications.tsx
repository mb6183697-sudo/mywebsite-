import { useState } from "react";
import { useAdminSendNotification } from "@workspace/api-client-react";
import { Send, Bell, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AdminNotificationsSection() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState<"broadcast" | "single">("broadcast");
  const { mutate: sendNotification, isPending } = useAdminSendNotification();
  const { toast } = useToast();

  const handleSend = () => {
    if (!title.trim()) {
      toast({ title: "Başlık gerekli", variant: "destructive" });
      return;
    }
    if (mode === "single" && !userId.trim()) {
      toast({ title: "Kullanıcı ID gerekli", variant: "destructive" });
      return;
    }
    sendNotification({
      data: {
        title: title.trim(),
        body: body.trim(),
        type: mode === "single" ? "info" : "broadcast",
        ...(mode === "single" ? { userId: Number(userId) } : {}),
      }
    }, {
      onSuccess: () => {
        toast({ title: mode === "broadcast" ? "Bildirim tüm kullanıcılara gönderildi" : "Bildirim gönderildi" });
        setTitle("");
        setBody("");
        setUserId("");
      },
      onError: () => {
        toast({ title: "Bildirim gönderilemedi", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">Bildirim Gönder</h3>
            <p className="text-xs text-muted-foreground">Tüm kullanıcılara veya tek bir kullanıcıya bildirim gönderin</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("broadcast")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "broadcast" ? "bg-primary text-primary-foreground" : "bg-secondary/10 text-muted-foreground hover:bg-secondary/20"
            }`}
          >
            <Users className="w-4 h-4" /> Toplu Gönderim
          </button>
          <button
            onClick={() => setMode("single")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "single" ? "bg-primary text-primary-foreground" : "bg-secondary/10 text-muted-foreground hover:bg-secondary/20"
            }`}
          >
            <User className="w-4 h-4" /> Tek Kullanıcı
          </button>
        </div>

        <div className="space-y-4">
          {mode === "single" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Kullanıcı ID</label>
              <Input
                placeholder="Kullanıcı numarası"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                type="number"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Başlık *</label>
            <Input
              placeholder="Bildirim başlığı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">İçerik</label>
            <textarea
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Bildirim detayı (isteğe bağlı)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={isPending || !title.trim()}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {isPending ? "Gönderiliyor..." : mode === "broadcast" ? "Herkese Gönder" : "Gönder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
