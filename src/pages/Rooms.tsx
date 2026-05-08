import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import TopToolbar from "@/components/TopToolbar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import NewMessagesIndicator from "@/components/NewMessagesIndicator";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useChatScroll, cacheMessages, getCachedMessages } from "@/hooks/useChatScroll";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";

const PUBLIC_ROOM_ID = "c4e3b9ac-aa54-4eb7-b992-d1e22e0fc74a";
const PAGE_SIZE = 50;

interface MessageWithProfile {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  room_id: string;
  reply_to_username?: string | null;
  reply_to_text?: string | null;
  voice_url?: string | null;
  profile?: Tables<"profiles"> | null;
}

const Rooms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [replyTo, setReplyTo] = useState<{ username: string; text: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const profilesCacheRef = useRef<Record<string, Tables<"profiles">>>({});

  const loadOlderMessages = useCallback(async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    const { data } = await supabase
      .from("messages").select("*").eq("room_id", PUBLIC_ROOM_ID)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (!data || data.length === 0) { setHasMore(false); return; }
    if (data.length < PAGE_SIZE) setHasMore(false);
    const sorted = data.reverse();
    const userIds = [...new Set(sorted.map(m => m.user_id))];
    const missing = userIds.filter(id => !profilesCacheRef.current[id]);
    if (missing.length) {
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", missing);
      profiles?.forEach(p => { profilesCacheRef.current[p.user_id] = p; });
    }
    const withProfiles = sorted.map(m => ({ ...m, profile: profilesCacheRef.current[m.user_id] || null }));
    setMessages(prev => [...withProfiles, ...prev]);
  }, [messages]);

  const {
    scrollRef, handleScroll, scrollToBottom, scrollToTop,
    showScrollDown, showScrollUp, showNewMessages, dismissNewMessages, isLoadingMore,
  } = useChatScroll({
    conversationId: `room_${PUBLIC_ROOM_ID}`,
    messageCount: messages.length,
    onLoadMore: loadOlderMessages,
    hasMore,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<Tables<"profiles"> | null> => {
    if (profilesCacheRef.current[userId]) return profilesCacheRef.current[userId];
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) profilesCacheRef.current[userId] = data;
    return data;
  }, []);

  useEffect(() => {
    // Load cached messages first for instant display
    const cached = getCachedMessages<MessageWithProfile>(`room_${PUBLIC_ROOM_ID}`);
    if (cached.length > 0) setMessages(cached);

    const fetchMessages = async () => {
      await supabase.rpc("cleanup_old_messages" as any);
      const { data } = await supabase.from("messages").select("*").eq("room_id", PUBLIC_ROOM_ID)
        .order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (!data) return;
      const sorted = data.reverse();
      const userIds = [...new Set(sorted.map(m => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, Tables<"profiles">> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });
      profilesCacheRef.current = { ...profilesCacheRef.current, ...profileMap };
      const withProfiles = sorted.map(m => ({ ...m, profile: profileMap[m.user_id] || null }));
      setMessages(withProfiles);
      cacheMessages(`room_${PUBLIC_ROOM_ID}`, withProfiles);
      setHasMore(data.length >= PAGE_SIZE);
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-public`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${PUBLIC_ROOM_ID}` },
        async (payload) => {
          const msg = payload.new as any;
          const profile = await fetchProfile(msg.user_id);
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            const updated = [...prev, { ...msg, profile }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            cacheMessages(`room_${PUBLIC_ROOM_ID}`, updated);
            return updated;
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProfile]);

  const handleSend = async (text: string, reply?: { username: string; text: string }) => {
    if (!user) return;
    const insertData: any = { room_id: PUBLIC_ROOM_ID, user_id: user.id, text };
    if (reply) {
      insertData.reply_to_username = reply.username;
      insertData.reply_to_text = reply.text;
    }
    const { data } = await supabase.from("messages").insert(insertData).select().single();
    if (data) {
      const profile = await fetchProfile(user.id);
      setMessages(prev => {
        if (prev.some(m => m.id === (data as any).id)) return prev;
        const updated = [...prev, { ...(data as any), profile }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        cacheMessages(`room_${PUBLIC_ROOM_ID}`, updated);
        return updated;
      });
    }
  };

  const addTestMessages = () => {
    const names = ["أبو خالد", "نجمة الشرق", "عاشق الليل", "سكون", "روتشان", "ليلى", "حمزة"];
    const texts = ["مرحبا بالجميع 🌍", "كيف حالكم؟", "الحمد لله بخير", "مساء الخير ✨", "أهلاً وسهلاً", "تمام الحمد لله", "أحلى مسا 🌙", "الله يسعدكم"];
    const countries = ["🇸🇦", "🇪🇬", "🇮🇶", "🇾🇪", "🇲🇦", "🇸🇾"];
    const newMsgs: MessageWithProfile[] = Array.from({ length: 20 }, (_, i) => ({
      id: `test-${Date.now()}-${i}`,
      text: texts[Math.floor(Math.random() * texts.length)],
      created_at: new Date().toISOString(),
      user_id: `fake-${i}`,
      room_id: PUBLIC_ROOM_ID,
      profile: {
        id: `fake-profile-${i}`, user_id: `fake-${i}`,
        username: names[Math.floor(Math.random() * names.length)],
        level: Math.floor(Math.random() * 50) + 1,
        country: countries[Math.floor(Math.random() * countries.length)],
        gender: Math.random() > 0.5 ? "male" : "female",
        avatar_url: null, bio: null, status: null, age: null,
        is_online: true, likes_count: 0,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name_color: null, font_color: null, font_style: null,
      } as any,
    }));
    setMessages(prev => [...prev, ...newMsgs]);
  };

  const handleAvatarClick = (profile: Tables<"profiles"> | null | undefined) => {
    if (profile) setSelectedUser(profile);
  };

  const handleReply = (msg: MessageWithProfile) => {
    const username = msg.profile?.username || "مجهول";
    setReplyTo({ username, text: msg.text });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopToolbar roomName="الدردشة العامة" />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide chat-scroll-whatsapp pb-36" data-testid="messages-container">
        <div className="flex-grow" />
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex-shrink-0">
          <WelcomeBanner />
          <div className="flex justify-center py-2">
            <button onClick={addTestMessages} className="bg-accent/80 text-accent-foreground text-xs font-cairo px-3 py-1 rounded-full">
              🧪 إضافة 20 رسالة تجريبية
            </button>
          </div>
        </div>
        <div className="mt-2">
          {messages.map(msg => (
            <ChatMessage key={msg.id}
              message={{
                id: msg.id,
                username: msg.profile?.username || "مجهول",
                text: msg.text,
                time: new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
                isOwn: msg.user_id === user?.id,
                level: msg.profile?.level || 1,
                country: msg.profile?.country || undefined,
                gender: msg.profile?.gender || undefined,
                avatarUrl: msg.profile?.avatar_url || null,
                nameColor: (msg.profile as any)?.name_color || null,
                fontColor: (msg.profile as any)?.font_color || null,
                fontStyle: (msg.profile as any)?.font_style || null,
                isGuest: msg.profile?.username?.startsWith("زائر_") || false,
                replyToUsername: msg.reply_to_username || null,
                replyToText: msg.reply_to_text || null,
                voiceUrl: msg.voice_url || null,
              }}
              onAvatarClick={() => handleAvatarClick(msg.profile)}
              onUsernameClick={() => handleReply(msg)}
            />
          ))}
        </div>
      </div>

      {showScrollUp && (
        <button onClick={scrollToTop} className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-secondary text-secondary-foreground rounded-full p-2 shadow-lg">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {showNewMessages && <NewMessagesIndicator onClick={() => { scrollToBottom(); dismissNewMessages(); }} />}

      {showScrollDown && !showNewMessages && (
        <button onClick={scrollToBottom} className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full p-2 shadow-lg animate-bounce">
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      <ChatInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      <BottomNav />
      {selectedUser && <UserProfileModal profile={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
};

export default Rooms;
