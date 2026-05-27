import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import TopToolbar from "@/components/TopToolbar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowDown } from "lucide-react";

const PUBLIC_ROOM_ID = "c4e3b9ac-aa54-4eb7-b992-d1e22e0fc74a";
const MAX_MESSAGES = 70;

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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const profilesCacheRef = useRef<Record<string, Tables<"profiles">>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom);
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<Tables<"profiles"> | null> => {
    if (profilesCacheRef.current[userId]) return profilesCacheRef.current[userId];
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) profilesCacheRef.current[userId] = data;
    return data;
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      await supabase.rpc("cleanup_old_messages" as any);
      
      const { data } = await supabase.from("messages").select("*").eq("room_id", PUBLIC_ROOM_ID)
        .order("created_at", { ascending: false }).limit(MAX_MESSAGES);
      if (!data) return;
      const sorted = data.reverse();
      const userIds = [...new Set(sorted.map(m => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, Tables<"profiles">> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });
      profilesCacheRef.current = { ...profilesCacheRef.current, ...profileMap };
      setMessages(sorted.map(m => ({ ...m, profile: profileMap[m.user_id] || null })));
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-public`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${PUBLIC_ROOM_ID}` },
        async (payload) => {
          const msg = payload.new as any;
          const profile = await fetchProfile(msg.user_id);
          setMessages(prev => [...prev.slice(-MAX_MESSAGES + 1), { ...msg, profile }]);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProfile]);

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (text: string, reply?: { username: string; text: string }) => {
    if (!user) return;
    const insertData: any = { room_id: PUBLIC_ROOM_ID, user_id: user.id, text };
    if (reply) {
      insertData.reply_to_username = reply.username;
      insertData.reply_to_text = reply.text;
    }
    await supabase.from("messages").insert(insertData);
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
      <TopToolbar roomName="الدردشة العامة" />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide pb-36 scroll-smooth">
        <WelcomeBanner />
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

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full p-2 shadow-lg animate-bounce"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      <ChatInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
      <BottomNav />
      {selectedUser && <UserProfileModal profile={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
};

export default Rooms;
