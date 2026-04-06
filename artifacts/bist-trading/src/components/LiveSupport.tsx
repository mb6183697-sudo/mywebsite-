import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle, X, Send, ChevronLeft, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  chatId: number;
  isAdmin: boolean;
  content: string;
  createdAt: string;
}

interface Chat {
  id: number;
  userId: number;
  category: string;
  status: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: "yatirim", label: "Yatırım İşlemleri" },
  { value: "cekim", label: "Çekim İşlemleri" },
  { value: "teknik", label: "Teknik Sorun" },
  { value: "diger", label: "Diğer" },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function LiveSupport() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "chat">("select");
  const [category, setCategory] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    checkExistingChat();
  }, [user]);

  useEffect(() => {
    if (chat && step === "chat") {
      startPolling();
    }
    return () => stopPolling();
  }, [chat, step]);

  useEffect(() => {
    if (open && unread > 0) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkExistingChat = async () => {
    try {
      const chats: Chat[] = await apiFetch("/support/chats/my");
      const openChat = chats.find((c) => c.status === "open");
      if (openChat) {
        setChat(openChat);
        setStep("chat");
        await loadMessages(openChat.id);
      }
    } catch {
    }
  };

  const loadMessages = async (chatId: number) => {
    try {
      const data = await apiFetch(`/support/chats/${chatId}/messages`);
      const prev = messages.length;
      setMessages(data.messages || []);
      if (!open && data.messages.length > prev) {
        setUnread((u) => u + (data.messages.length - prev));
      }
    } catch {
    }
  };

  const startPolling = () => {
    stopPolling();
    if (!chat) return;
    pollRef.current = setInterval(() => loadMessages(chat.id), 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startChat = async () => {
    if (!category) return;
    setLoading(true);
    try {
      const newChat: Chat = await apiFetch("/support/chats", {
        method: "POST",
        body: JSON.stringify({ category }),
      });
      setChat(newChat);
      setMessages([]);
      setStep("chat");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !chat || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const msg: Message = await apiFetch(`/support/chats/${chat.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [...prev, msg]);
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const categoryLabel = CATEGORIES.find((c) => c.value === chat?.category)?.label || chat?.category;

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 md:bottom-24 md:right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: 480 }}>
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            {step === "chat" && (
              <button onClick={() => { setStep("select"); setChat(null); setMessages([]); stopPolling(); }} className="hover:opacity-70 transition-opacity">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Canlı Destek</div>
              {step === "chat" && chat && (
                <div className="text-xs text-primary-foreground/70 truncate">{categoryLabel} — {chat.status === "open" ? "Aktif" : "Kapatıldı"}</div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>

          {step === "select" && (
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Headphones className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Nasıl yardımcı olabiliriz?</h3>
                <p className="text-xs text-muted-foreground mt-1">Hesap ID: <span className="font-mono font-medium">#{user.accountId}</span></p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ulaşım Sebebi</p>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                      category === cat.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/50 hover:bg-accent text-foreground"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <Button onClick={startChat} disabled={!category || loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sohbete Başla
              </Button>
            </div>
          )}

          {step === "chat" && (
            <>
              <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    Destek ekibimiz en kısa sürede yanıt verecektir.<br />Mesajınızı yazabilirsiniz.
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
                        msg.isAdmin
                          ? "bg-slate-600 text-white rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      )}
                    >
                      {msg.isAdmin && <p className="text-[10px] font-semibold mb-0.5 text-slate-300">Destek Ekibi</p>}
                      <p className="break-words">{msg.content}</p>
                      <p className={cn("text-[10px] mt-1", msg.isAdmin ? "text-slate-300" : "text-primary-foreground/60")}>
                        {new Date(msg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {chat?.status === "closed" && (
                  <div className="text-center text-xs text-muted-foreground py-2 bg-secondary/50 rounded-lg">
                    Bu sohbet kapatılmıştır.
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {chat?.status !== "closed" && (
                <div className="p-3 border-t border-border flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mesajınızı yazın..."
                    rows={1}
                    className="flex-1 resize-none bg-secondary/20 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all max-h-24"
                    style={{ minHeight: 36 }}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={!input.trim() || sending} className="rounded-xl h-9 w-9 flex-shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
