import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopToolbar from "@/components/TopToolbar";
import BottomNav from "@/components/BottomNav";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

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
  const profilesCacheRef = useRef<Record<string, Tables<"profiles">>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

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

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages").select("*").eq("room_id", roomId)
        .order("created_at", { ascending: true }).limit(100);
      if (!data) return;

      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, Tables<"profiles">> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });
      profilesCacheRef.current = { ...profilesCacheRef.current, ...profileMap };
      setMessages(data.map(m => ({ ...m, profile: profileMap[m.user_id] || null })));
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as any;
          const profile = await fetchProfile(msg.user_id);
          setMessages(prev => [...prev, { ...msg, profile }]);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchProfile]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
      room_id: roomId,
      user_id: user.id,
      text: "🎤 رسالة صوتية",
      voice_url: voiceUrl,
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-36">
        <WelcomeBanner />
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

      <ChatInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
      <BottomNav />

      {selectedUser && (
        <UserProfileModal profile={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

export default ChatRoom;
