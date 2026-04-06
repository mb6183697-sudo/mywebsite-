import { useState, useRef, useCallback } from "react";
import { useGetCampaigns, useAdminCreateCampaign, useAdminUpdateCampaign, useAdminDeleteCampaign, getGetCampaignsQueryKey, CampaignItem } from "@workspace/api-client-react";
import { Plus, Trash2, Megaphone, Image, Pencil, X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function CampaignsSection() {
  const { data: campaigns, isLoading } = useGetCampaigns();
  const { mutate: createCampaign } = useAdminCreateCampaign();
  const { mutate: updateCampaign } = useAdminUpdateCampaign();
  const { mutate: deleteCampaign } = useAdminDeleteCampaign();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "" });
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ title: "", description: "", imageUrl: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (c: CampaignItem) => {
    setForm({ title: c.title || "", description: c.description || "", imageUrl: c.imageUrl || "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Sadece görsel dosyalar destekleniyor", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem("admin_auth_token");
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/admin/campaigns/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Yükleme başarısız");
      const data = await res.json();
      setForm(f => ({ ...f, imageUrl: data.url }));
      toast({ title: "Görsel yüklendi" });
    } catch {
      toast({ title: "Görsel yüklenemedi", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) { e.preventDefault(); uploadImage(file); }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  };

  const handleSubmit = () => {
    if (!form.title) {
      toast({ title: "Başlık gerekli", variant: "destructive" });
      return;
    }
    const payload = { title: form.title, description: form.description || undefined, imageUrl: form.imageUrl || undefined };

    if (editingId) {
      updateCampaign({ id: editingId, data: payload }, {
        onSuccess: () => {
          toast({ title: "Kampanya güncellendi" });
          queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
          resetForm();
        },
        onError: () => toast({ title: "Hata oluştu", variant: "destructive" }),
      });
    } else {
      createCampaign({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Kampanya eklendi" });
          queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
          resetForm();
        },
        onError: () => toast({ title: "Hata oluştu", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteCampaign({ id }, {
      onSuccess: () => {
        toast({ title: "Kampanya silindi" });
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
      },
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const items: CampaignItem[] = campaigns || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Haberler sayfasında "Kampanyalar & Fırsatlar" bölümünde gösterilir</p>
        <Button size="sm" onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}>
          {showForm ? <><X className="w-4 h-4 mr-1" /> Kapat</> : <><Plus className="w-4 h-4 mr-1" /> Yeni Kampanya</>}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-3" onPaste={handlePaste}>
          <h4 className="font-bold text-sm">{editingId ? "Kampanya Düzenle" : "Yeni Kampanya"}</h4>
          <Input placeholder="Kampanya Başlığı" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-background" />
          <Input placeholder="Açıklama (isteğe bağlı)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background" />

          {/* Image upload area */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Kampanya Görseli</p>

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"} ${form.imageUrl ? "p-2" : "p-6"}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : form.imageUrl ? (
                <div className="relative group">
                  <img src={form.imageUrl} alt="Önizleme" className="w-full max-h-48 object-cover rounded-md" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                    <span className="text-white text-xs font-medium">Değiştirmek için tıkla veya sürükle</span>
                  </div>
                  <button
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                    onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: "" })); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8 opacity-50" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Dosya seç veya sürükle</p>
                    <p className="text-xs opacity-70 mt-0.5">WhatsApp'tan gelen görseli buraya yapıştır (Ctrl+V)</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={uploading}>{editingId ? "Güncelle" : "Kaydet"}</Button>
            <Button variant="outline" onClick={resetForm}>İptal</Button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz kampanya eklenmemiş</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden group">
              {c.imageUrl && (
                <div className="h-40 bg-secondary/20 overflow-hidden">
                  <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                </div>
              )}
              {!c.imageUrl && (
                <div className="h-24 bg-secondary/10 flex items-center justify-center">
                  <Image className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm truncate">{c.title}</h4>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
