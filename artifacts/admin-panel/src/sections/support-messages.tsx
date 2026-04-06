import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, CheckCircle, Clock, User, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatItem {
  id: number;
  userId: number;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  accountId: string | null;
  phone: string | null;
}

interface Message {
  id: number;
  chatId: number;
  isAdmin: boolean;
  content: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  yatirim: "Yatırım İşlemleri",
  cekim: "Çekim İşlemleri",
  teknik: "Teknik Sorun",
  diger: "Diğer",
};

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

export default function SupportMessagesSection() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMsgCountRef = useRef<number>(0);

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Reset count when switching chats so first load scrolls to bottom
    prevMsgCountRef.current = 0;
    if (activeChat) {
      fetchMessages(activeChat.id);
      startPolling(activeChat.id);
    }
    return () => stopPolling();
  }, [activeChat?.id]);

  // Only scroll when new messages actually arrive — scroll inside container, not the page
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  const fetchChats = async () => {
    try {
      const data: ChatItem[] = await apiFetch("/admin/support/chats");
      setChats(data);
    } catch {
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId: number) => {
    try {
      const data = await apiFetch(`/support/chats/${chatId}/messages`);
      setMessages(data.messages || []);
    } catch {}
  };

  const startPolling = (chatId: number) => {
    stopPolling();
    pollRef.current = setInterval(() => fetchMessages(chatId), 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const msg: Message = await apiFetch(`/admin/support/chats/${activeChat.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [...prev, msg]);
    } catch {
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async () => {
    if (!activeChat) return;
    const newStatus = activeChat.status === "open" ? "closed" : "open";
    try {
      await apiFetch(`/admin/support/chats/${activeChat.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setActiveChat({ ...activeChat, status: newStatus });
      setChats((prev) => prev.map((c) => (c.id === activeChat.id ? { ...c, status: newStatus } : c)));
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredChats = chats.filter((c) => filter === "all" || c.status === filter);
  const openCount = chats.filter((c) => c.status === "open").length;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-80 flex-shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Destek Talepleri</h3>
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs">{openCount} açık</Badge>
            )}
          </div>
          <div className="flex gap-1">
            {(["open", "all", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary"
                )}
              >
                {f === "open" ? "Açık" : f === "closed" ? "Kapalı" : "Tümü"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChats && (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingChats && filteredChats.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Henüz talep yok
            </div>
          )}
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={cn(
                "w-full text-left p-3 border-b border-border/50 hover:bg-accent/50 transition-colors",
                activeChat?.id === chat.id && "bg-accent"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {chat.firstName || "?"} {chat.lastName || ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">#{chat.accountId}</p>
                  </div>
                </div>
                <span className={cn(
                  "flex-shrink-0 w-2 h-2 rounded-full mt-1",
                  chat.status === "open" ? "bg-green-500" : "bg-muted"
                )} />
              </div>
              <div className="mt-1.5 pl-9">
                <p className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[chat.category] || chat.category}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {new Date(chat.updatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Sohbet seçin</p>
            <p className="text-xs mt-1 opacity-60">Soldan bir destek talebi seçin</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    {activeChat.firstName} {activeChat.lastName}
                    <span className="ml-2 text-xs font-mono text-muted-foreground">#{activeChat.accountId}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[activeChat.category]} · {activeChat.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={activeChat.status === "open" ? "default" : "secondary"} className="text-xs">
                  {activeChat.status === "open" ? <><Clock className="w-3 h-3 mr-1" /> Açık</> : <><CheckCircle className="w-3 h-3 mr-1" /> Kapalı</>}
                </Badge>
                <Button size="sm" variant="outline" onClick={toggleStatus} className="text-xs h-7">
                  {activeChat.status === "open" ? <><X className="w-3 h-3 mr-1" /> Kapat</> : <><CheckCircle className="w-3 h-3 mr-1" /> Aç</>}
                </Button>
              </div>
            </div>

            <div ref={messagesContainerRef} className="flex-1 p-4 space-y-2 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">Henüz mesaj yok.</div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[70%] px-3 py-2 rounded-2xl text-sm",
                      msg.isAdmin
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    )}
                  >
                    {!msg.isAdmin && <p className="text-[10px] font-semibold mb-0.5 text-primary">{activeChat.firstName}</p>}
                    <p className="break-words">{msg.content}</p>
                    <p className={cn("text-[10px] mt-1", msg.isAdmin ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      {new Date(msg.createdAt).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border flex gap-2 items-end">
              {activeChat.status === "closed" ? (
                <p className="text-xs text-muted-foreground text-center w-full py-1">Bu sohbet kapatılmıştır. Tekrar açmak için yukarıdaki butonu kullanın.</p>
              ) : (
                <>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Yanıtınızı yazın..."
                    rows={1}
                    className="flex-1 resize-none bg-secondary/20 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all max-h-24"
                    style={{ minHeight: 36 }}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={!input.trim() || sending} className="rounded-xl h-9 w-9 flex-shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
