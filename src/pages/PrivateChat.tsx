import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Send, Image, X, Eye, ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EmojiPicker from "@/components/EmojiPicker";
import VoiceRecorder from "@/components/VoiceRecorder";
import VoicePlayer from "@/components/VoicePlayer";
import NewMessagesIndicator from "@/components/NewMessagesIndicator";
import { useChatScroll, cacheMessages, getCachedMessages } from "@/hooks/useChatScroll";

const PAGE_SIZE = 50;

interface PrivateMsg {
  id: string;
  text: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string | null;
  is_image_viewed?: boolean;
  voice_url?: string | null;
}

interface PartnerProfile {
  username: string;
  avatar_url: string | null;
  status: string | null;
  country: string | null;
  is_online: boolean;
  last_seen: string | null;
}

const PrivateChat = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<PrivateMsg[]>([]);
  const [text, setText] = useState("");
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOlderMessages = useCallback(async () => {
    if (!userId || !user || messages.length === 0) return;
    const oldest = messages[0];
    const { data } = await supabase
      .from("private_messages").select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (!data || data.length === 0) { setHasMore(false); return; }
    if (data.length < PAGE_SIZE) setHasMore(false);
    setMessages(prev => [...(data as PrivateMsg[]).reverse(), ...prev]);
  }, [userId, user, messages]);

  const {
    scrollRef, handleScroll, scrollToBottom, scrollToTop,
    showScrollDown, showScrollUp, showNewMessages, dismissNewMessages, isLoadingMore,
  } = useChatScroll({
    conversationId: `pm_${userId}`,
    messageCount: messages.length,
    onLoadMore: loadOlderMessages,
    hasMore,
  });

  useEffect(() => {
    if (!userId || !user) return;

    supabase.from("profiles").select("username, avatar_url, status, country, is_online, last_seen").eq("user_id", userId).single().then(({ data }) => {
      if (data) setPartner(data as any);
    });

    const cached = getCachedMessages<PrivateMsg>(`pm_${userId}`);
    if (cached.length > 0) setMessages(cached);

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("private_messages").select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (data) {
        const sorted = (data as PrivateMsg[]).reverse();
        setMessages(sorted);
        cacheMessages(`pm_${userId}`, sorted);
        setHasMore(data.length >= PAGE_SIZE);
      }

      await supabase
        .from("private_messages").update({ is_read: true })
        .eq("sender_id", userId).eq("receiver_id", user.id).eq("is_read", false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`private-${user.id}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const msg = payload.new as PrivateMsg;
            if (
              (msg.sender_id === user.id && msg.receiver_id === userId) ||
              (msg.sender_id === userId && msg.receiver_id === user.id)
            ) {
              setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                const updated = [...prev, msg];
                cacheMessages(`pm_${userId}`, updated);
                return updated;
              });
              if (msg.sender_id === userId) {
                supabase.from("private_messages").update({ is_read: true }).eq("id", msg.id);
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as PrivateMsg;
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as any;
            setMessages(prev => prev.filter(m => m.id !== old.id));
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, user]);

  const handleSend = async () => {
    if (!text.trim() || !user || !userId) return;
    const body = text.trim();
    setText("");
    const { data } = await supabase.from("private_messages").insert({ sender_id: user.id, receiver_id: userId, text: body }).select().single();
    if (data) {
      setMessages(prev => {
        if (prev.some(m => m.id === (data as any).id)) return prev;
        const updated = [...prev, data as PrivateMsg];
        cacheMessages(`pm_${userId}`, updated);
        return updated;
      });
    }
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    if (!user || !userId) return;
    const path = `${user.id}/${Date.now()}.webm`;
    const { error } = await supabase.storage.from("voice-messages").upload(path, blob, { contentType: "audio/webm" });
    if (error) return;
    const { data: urlData } = supabase.storage.from("voice-messages").getPublicUrl(path);
    await supabase.from("private_messages").insert({
      sender_id: user.id, receiver_id: userId, text: "🎤 رسالة صوتية", voice_url: urlData.publicUrl,
    } as any);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !userId) return;
    setSendingImage(true);
    const ext = file.name.split('.').pop();
    const path = `private/${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadError) { setSendingImage(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("private_messages").insert({
      sender_id: user.id, receiver_id: userId, text: "📷 صورة", image_url: urlData.publicUrl,
    } as any);
    setSendingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleViewImage = async (msg: PrivateMsg) => {
    if (!msg.image_url) return;
    setViewingImage(msg.image_url);
    if (msg.receiver_id === user?.id && !msg.is_image_viewed) {
      await supabase.from("private_messages").update({ is_image_viewed: true } as any).eq("id", msg.id);
    }
  };

  const handleCloseImage = async () => {
    const msg = messages.find(m => m.image_url === viewingImage);
    if (msg && msg.is_image_viewed) {
      const urlParts = msg.image_url?.split("/avatars/");
      if (urlParts && urlParts[1]) {
        await supabase.storage.from("avatars").remove([decodeURIComponent(urlParts[1])]);
      }
      await supabase.from("private_messages").delete().eq("id", msg.id);
    }
    setViewingImage(null);
  };

  const formatLastSeen = (lastSeen: string | null, isOnline: boolean) => {
    if (isOnline) return "متصل الآن";
    if (!lastSeen) return "غير متصل";
    const d = new Date(lastSeen);
    return `آخر ظهور ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-50 bg-toolbar px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate("/private")} className="text-secondary-foreground">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-cairo font-bold text-secondary-foreground">{partner?.username || "..."}</h1>
          <span className={`text-[10px] font-cairo ${partner?.is_online ? "text-accent" : "text-muted-foreground"}`}>
            {partner ? formatLastSeen(partner.last_seen, partner.is_online) : ""}
          </span>
        </div>
        <div className="w-9 h-9 rounded-full bg-muted border-2 border-accent flex items-center justify-center overflow-hidden">
          {partner?.avatar_url ? (
            <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm">👤</span>
          )}
        </div>
      </div>

      {partner && (
        <div className="bg-card/50 border-b border-border px-4 py-2 flex items-center justify-center gap-4 text-[11px] font-cairo text-muted-foreground">
          {partner.status && <span>💭 {partner.status}</span>}
          {partner.country && <span>📍 {partner.country}</span>}
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide chat-scroll-whatsapp px-4 py-4 pb-20" data-testid="messages-container">
        <div className="flex-grow" />
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-3 flex ${msg.sender_id === user?.id ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
              msg.sender_id === user?.id ? "bg-secondary text-secondary-foreground" : "bg-card border border-border text-foreground"
            }`}>
              {msg.voice_url ? (
                <VoicePlayer voiceUrl={msg.voice_url} />
              ) : msg.image_url && !msg.is_image_viewed ? (
                <button onClick={() => handleViewImage(msg)} className="flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-3 text-primary hover:bg-primary/20 transition-colors">
                  <Eye className="w-5 h-5" />
                  <span className="text-sm font-cairo font-bold">📷 اضغط لعرض الصورة</span>
                </button>
              ) : msg.image_url && msg.is_image_viewed ? (
                <p className="text-xs font-cairo text-muted-foreground italic">🚫 تم فتح الصورة وحذفها</p>
              ) : (
                <p className="text-sm font-cairo">{msg.text}</p>
              )}
              <span className="text-[10px] font-space text-muted-foreground block mt-1">
                {new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showScrollUp && (
        <button onClick={scrollToTop} className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-secondary text-secondary-foreground rounded-full p-2 shadow-lg">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {showNewMessages && <NewMessagesIndicator onClick={() => { scrollToBottom(); dismissNewMessages(); }} />}

      {showScrollDown && !showNewMessages && (
        <button onClick={scrollToBottom} className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full p-2 shadow-lg animate-bounce">
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      {viewingImage && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[200] flex flex-col items-center justify-center" onClick={handleCloseImage}>
          <p className="text-xs font-cairo text-destructive mb-4 animate-pulse">⚠️ الصورة ستختفي بعد إغلاقها</p>
          <img src={viewingImage} alt="" className="max-w-[90vw] max-h-[70vh] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={handleCloseImage} className="mt-4 bg-card border border-border rounded-full px-6 py-2 text-sm font-cairo text-foreground">
            إغلاق وحذف الصورة
          </button>
        </div>
      )}

      <div className="sticky bottom-0 bg-background border-t border-border px-2 py-1.5 flex items-center gap-1.5">
        <button onClick={handleSend} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
          <Send className="w-4 h-4" />
        </button>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="اكتب رسالتك..." className="flex-1 bg-muted border border-border rounded-full px-3 py-1.5 text-xs font-cairo text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" dir="rtl" />
        <EmojiPicker onSelect={(emoji) => setText(prev => prev + emoji)} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        <button onClick={() => fileInputRef.current?.click()} disabled={sendingImage} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50">
          <Image className="w-4 h-4" />
        </button>
        <VoiceRecorder onSend={handleVoiceSend} />
      </div>
    </div>
  );
};

export default PrivateChat;
