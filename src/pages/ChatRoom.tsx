import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopToolbar from "@/components/TopToolbar";
import BottomNav from "@/components/BottomNav";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import NewMessagesIndicator from "@/components/NewMessagesIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { useChatScroll, cacheMessages, getCachedMessages } from "@/hooks/useChatScroll";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";

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

const ChatRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [roomName, setRoomName] = useState("الغرفة العامة");
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [replyTo, setReplyTo] = useState<{ username: string; text: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const profilesCacheRef = useRef<Record<string, Tables<"profiles">>>({});

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || messages.length === 0) return;
    const oldest = messages[0];
    const { data } = await supabase
      .from("messages").select("*").eq("room_id", roomId)
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
  }, [roomId, messages]);

  const {
    scrollRef, handleScroll, scrollToBottom, scrollToTop,
    showScrollDown, showScrollUp, showNewMessages, dismissNewMessages, isLoadingMore,
  } = useChatScroll({
    conversationId: `room_${roomId}`,
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
    if (!roomId) return;
    supabase.from("rooms").select("name").eq("id", roomId).maybeSingle().then(({ data }) => {
      if (data) setRoomName(data.name);
    });

    const cached = getCachedMessages<MessageWithProfile>(`room_${roomId}`);
    if (cached.length > 0) setMessages(cached);

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages").select("*").eq("room_id", roomId)
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
      cacheMessages(`room_${roomId}`, withProfiles);
      setHasMore(data.length >= PAGE_SIZE);
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as any;
          const profile = await fetchProfile(msg.user_id);
          setMessages(prev => {
            const updated = [...prev, { ...msg, profile }];
            cacheMessages(`room_${roomId}`, updated);
            return updated;
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchProfile]);

  const handleSend = async (text: string, reply?: { username: string; text: string }) => {
    if (!user || !roomId) return;
    const insertData: any = { room_id: roomId, user_id: user.id, text };
    if (reply) {
      insertData.reply_to_username = reply.username;
      insertData.reply_to_text = reply.text;
    }
    await supabase.from("messages").insert(insertData);
  };

  const handleVoiceSend = async (voiceUrl: string) => {
    if (!user || !roomId) return;
    await supabase.from("messages").insert({
      room_id: roomId, user_id: user.id, text: "🎤 رسالة صوتية", voice_url: voiceUrl,
    } as any);
  };

  const handleAvatarClick = (profile: Tables<"profiles"> | null | undefined) => {
    if (profile && profile.user_id !== user?.id) setSelectedUser(profile);
  };

  const handleReply = (msg: MessageWithProfile) => {
    const username = msg.profile?.username || "مجهول";
    setReplyTo({ username, text: msg.text });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopToolbar roomName={roomName} />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide chat-scroll-whatsapp pb-36" style={{ touchAction: "pan-y" }} data-testid="messages-container">
        <div className="flex-grow" />
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex-shrink-0">
          <WelcomeBanner />
        </div>
        <div className="mt-2">
          {messages.map(msg => (
            <ChatMessage
              key={msg.id}
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

export default ChatRoom;
