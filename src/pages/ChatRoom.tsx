import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import TopToolbar from "@/components/TopToolbar";
import BottomNav from "@/components/BottomNav";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import WelcomeBanner from "@/components/WelcomeBanner";
import UserProfileModal from "@/components/UserProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { useOlderMessages } from "@/hooks/useOlderMessages";
import { useRealtimeResync } from "@/hooks/useRealtimeResync";
import ChatScrollHelpers from "@/components/ChatScrollHelpers";

const INITIAL_PAGE = 30;

interface MessageWithProfile {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  room_id: string;
  reply_to_username?: string | null;
  reply_to_text?: string | null;
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

  const lastSyncRef = useRef<string | null>(null);

  const mergeIncoming = useCallback((incoming: MessageWithProfile[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const fresh = incoming.filter(m => !existing.has(m.id));
      if (!fresh.length) return prev;
      return [...prev, ...fresh].sort((a, b) => {
        const t = a.created_at.localeCompare(b.created_at);
        return t !== 0 ? t : a.id.localeCompare(b.id);
      });
    });
    const latest = incoming[incoming.length - 1]?.created_at;
    if (latest && (!lastSyncRef.current || latest > lastSyncRef.current)) lastSyncRef.current = latest;
  }, []);

  const fetchSince = useCallback(async (since: string) => {
    if (!roomId) return;
    const { data } = await supabase.from("messages").select("*")
      .eq("room_id", roomId).gt("created_at", since)
      .order("created_at", { ascending: true }).limit(200);
    if (!data?.length) return;
    const missing = [...new Set(data.map(m => m.user_id))].filter(id => !profilesCacheRef.current[id]);
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", missing);
      profs?.forEach(p => { profilesCacheRef.current[p.user_id] = p; });
    }
    mergeIncoming(data.map(m => ({ ...m, profile: profilesCacheRef.current[m.user_id] || null })));
  }, [roomId, mergeIncoming]);

  useEffect(() => {
    if (!roomId) return;
    supabase.from("rooms").select("name").eq("id", roomId).maybeSingle().then(({ data }) => {
      if (data) setRoomName(data.name);
    });

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages").select("*").eq("room_id", roomId)
        .order("created_at", { ascending: false }).limit(INITIAL_PAGE);
      if (!data) return;
      const ordered = [...data].reverse();

      const userIds = [...new Set(ordered.map(m => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, Tables<"profiles">> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = p; });
      profilesCacheRef.current = { ...profilesCacheRef.current, ...profileMap };
      setMessages(ordered.map(m => ({ ...m, profile: profileMap[m.user_id] || null })));
      lastSyncRef.current = ordered[ordered.length - 1]?.created_at || new Date().toISOString();
    };
    fetchMessages();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as any;
          const profile = await fetchProfile(msg.user_id);
          mergeIncoming([{ ...msg, profile }]);
        }
      ).subscribe((status) => {
        if (status === "SUBSCRIBED" && lastSyncRef.current) fetchSince(lastSyncRef.current);
      });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchProfile, mergeIncoming, fetchSince]);

  useRealtimeResync(() => { if (lastSyncRef.current) fetchSince(lastSyncRef.current); });

  const { onScroll: onScrollOlder, loading: loadingOlder, error: olderError, retry: retryOlder } =
    useOlderMessages(roomId, scrollRef, messages, setMessages, profilesCacheRef);

  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
    if (near) setUnreadCount(0);
    onScrollOlder(e);
  }, [onScrollOlder]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    setUnreadCount(0);
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg.id;
    if (lastId === lastIdRef.current) return;
    const isInitial = lastIdRef.current === null;
    lastIdRef.current = lastId;

    if (isInitial || isNearBottomRef.current || lastMsg.user_id === user?.id) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setUnreadCount(c => c + 1);
    }
  }, [messages, user?.id]);

  const handleSend = async (text: string, reply?: { username: string; text: string }) => {
    if (!user || !roomId) return;
    const insertData: any = { room_id: roomId, user_id: user.id, text };
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
      <TopToolbar roomName={roomName} />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-hide pb-36">
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
              }}
              onAvatarClick={() => handleAvatarClick(msg.profile)}
              onUsernameClick={() => handleReply(msg)}
            />
          ))}
        </div>
      </div>

      <ChatScrollHelpers
        loadingOlder={loadingOlder}
        olderError={olderError}
        onRetryOlder={retryOlder}
        unreadCount={unreadCount}
        onJumpToBottom={scrollToBottom}
        onJumpToTop={scrollToTop}
        showJumpToTop={isNearBottom}
      />

      <ChatInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      <BottomNav />

      {selectedUser && (
        <UserProfileModal profile={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

export default ChatRoom;
